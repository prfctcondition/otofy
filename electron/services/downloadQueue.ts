import path from 'path';
import { fileURLToPath } from 'url';
import { Notification, WebContents } from 'electron';
import downloadService, { DownloadFormat, TrackMetadata } from './downloadService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface QueueTask {
  track: TrackMetadata;
  format: DownloadFormat;
  status: 'queued' | 'downloading' | 'paused' | 'completed' | 'error' | 'cancelled';
  progress: number;
  error?: string;
  filePath?: string;
  isBatch?: boolean;
  batchId?: string;
}

export interface BatchDownloadState {
  active: boolean;
  batchId?: string;
  playlistTitle: string;
  total: number;
  completed: number;
  failed: number;
  currentTrackTitle?: string;
  isPaused: boolean;
}

export class DownloadQueueManager {
  private concurrencyLimit = 3;
  private queue: QueueTask[] = [];
  private activeTasks = new Map<string, QueueTask>();
  private allTasks = new Map<string, QueueTask>();
  private batchState: BatchDownloadState | null = null;
  private sender: WebContents | null = null;
  private downloadsPath: string = '';

  constructor(downloadsPath: string) {
    this.downloadsPath = downloadsPath;
  }

  public setDownloadsPath(newPath: string) {
    this.downloadsPath = newPath;
  }

  public setSender(sender: WebContents | null) {
    this.sender = sender;
  }

  private sendProgress(task: QueueTask) {
    if (this.sender && !this.sender.isDestroyed()) {
      this.sender.send('download:progress', {
        trackId: task.track.id,
        progress: task.progress,
        status: task.status,
        error: task.error,
        filePath: task.filePath,
      });
    }
  }

  private sendBatchProgress() {
    if (this.sender && !this.sender.isDestroyed() && this.batchState) {
      this.sender.send('download:batch-progress', { ...this.batchState });
    }
  }

  private showBatchNotification() {
    if (!this.batchState) return;
    try {
      if (Notification.isSupported()) {
        const iconPath = path.join(__dirname, '../../public/icon.png');
        const notif = new Notification({
          title: 'Playlist Downloaded',
          body: `Playlist "${this.batchState.playlistTitle}" successfully downloaded (${this.batchState.completed} tracks).`,
          icon: iconPath,
        });
        notif.show();
      }
    } catch (err) {
      console.warn('[DownloadQueue] Failed to show OS notification:', err);
    }
  }

  public enqueueTrack(track: TrackMetadata, format: DownloadFormat = 'mp3', isBatch = false, batchId?: string) {
    const existing = this.allTasks.get(track.id);
    if (existing && (existing.status === 'downloading' || existing.status === 'queued')) {
      return;
    }

    const task: QueueTask = {
      track,
      format,
      status: 'queued',
      progress: 0,
      isBatch,
      batchId,
    };

    this.allTasks.set(track.id, task);
    this.queue.push(task);
    this.sendProgress(task);
    this.processQueue();
  }

  public enqueueBatch(tracks: TrackMetadata[], format: DownloadFormat = 'mp3', playlistTitle: string) {
    const batchId = `batch-${Date.now()}`;
    const validTracks = tracks.filter((t) => {
      const status = downloadService.checkTrackDownloaded(t, this.downloadsPath);
      return !status.downloaded;
    });

    if (validTracks.length === 0) {
      // All tracks already downloaded
      this.batchState = {
        active: false,
        batchId,
        playlistTitle,
        total: tracks.length,
        completed: tracks.length,
        failed: 0,
        isPaused: false,
      };
      this.sendBatchProgress();
      return;
    }

    this.batchState = {
      active: true,
      batchId,
      playlistTitle,
      total: validTracks.length,
      completed: 0,
      failed: 0,
      currentTrackTitle: validTracks[0]?.title,
      isPaused: false,
    };

    for (const track of validTracks) {
      this.enqueueTrack(track, format, true, batchId);
    }

    this.sendBatchProgress();
  }

  public pauseTrack(trackId: string) {
    const task = this.allTasks.get(trackId);
    if (!task) return;

    if (task.status === 'queued') {
      task.status = 'paused';
      // Remove from pending queue
      const qIndex = this.queue.findIndex((t) => t.track.id === trackId);
      if (qIndex !== -1) this.queue.splice(qIndex, 1);
      this.sendProgress(task);
    } else if (task.status === 'downloading') {
      task.status = 'paused';
      downloadService.cancelActiveDownload(trackId);
      this.activeTasks.delete(trackId);
      this.sendProgress(task);
      this.processQueue();
    }
  }

  public resumeTrack(trackId: string) {
    const task = this.allTasks.get(trackId);
    if (!task || task.status !== 'paused') return;

    task.status = 'queued';
    this.queue.push(task);
    this.sendProgress(task);
    this.processQueue();
  }

  public cancelTrack(trackId: string) {
    const task = this.allTasks.get(trackId);
    if (!task) return;

    if (task.status === 'downloading') {
      downloadService.cancelActiveDownload(trackId);
      this.activeTasks.delete(trackId);
    }

    const qIndex = this.queue.findIndex((t) => t.track.id === trackId);
    if (qIndex !== -1) this.queue.splice(qIndex, 1);

    task.status = 'cancelled';
    this.allTasks.delete(trackId);

    // Notify UI that track is now idle
    if (this.sender && !this.sender.isDestroyed()) {
      this.sender.send('download:progress', {
        trackId: task.track.id,
        progress: 0,
        status: 'idle',
      });
    }

    if (task.isBatch && this.batchState && this.batchState.active) {
      this.batchState.total = Math.max(0, this.batchState.total - 1);
      this.checkBatchComplete();
      this.sendBatchProgress();
    }

    this.processQueue();
  }

  public pauseAll() {
    if (this.batchState) {
      this.batchState.isPaused = true;
      this.sendBatchProgress();
    }

    // Pause all queued items
    for (const task of [...this.queue]) {
      task.status = 'paused';
      this.sendProgress(task);
    }
    this.queue = [];

    // Pause all active tasks
    for (const [id, task] of this.activeTasks.entries()) {
      task.status = 'paused';
      downloadService.cancelActiveDownload(id);
      this.sendProgress(task);
    }
    this.activeTasks.clear();
  }

  public resumeAll() {
    if (this.batchState) {
      this.batchState.isPaused = false;
      this.sendBatchProgress();
    }

    // Re-queue all paused tasks
    for (const task of this.allTasks.values()) {
      if (task.status === 'paused') {
        task.status = 'queued';
        this.queue.push(task);
        this.sendProgress(task);
      }
    }

    this.processQueue();
  }

  public cancelAll() {
    for (const [id, task] of this.activeTasks.entries()) {
      downloadService.cancelActiveDownload(id);
      if (this.sender && !this.sender.isDestroyed()) {
        this.sender.send('download:progress', {
          trackId: task.track.id,
          progress: 0,
          status: 'idle',
        });
      }
    }
    this.activeTasks.clear();

    for (const task of this.queue) {
      if (this.sender && !this.sender.isDestroyed()) {
        this.sender.send('download:progress', {
          trackId: task.track.id,
          progress: 0,
          status: 'idle',
        });
      }
    }
    this.queue = [];
    this.allTasks.clear();

    if (this.batchState) {
      this.batchState.active = false;
      this.sendBatchProgress();
      this.batchState = null;
    }
  }

  public getBatchState(): BatchDownloadState | null {
    return this.batchState;
  }

  private checkBatchComplete() {
    if (!this.batchState || !this.batchState.active) return;
    const { total, completed, failed } = this.batchState;
    if (completed + failed >= total) {
      this.batchState.active = false;
      this.sendBatchProgress();
      this.showBatchNotification();
    }
  }

  private processQueue() {
    if (this.batchState?.isPaused) return;

    while (this.activeTasks.size < this.concurrencyLimit && this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task || task.status === 'paused' || task.status === 'cancelled') continue;

      task.status = 'downloading';
      task.progress = 5;
      this.activeTasks.set(task.track.id, task);
      this.sendProgress(task);

      if (this.batchState && this.batchState.active) {
        this.batchState.currentTrackTitle = task.track.title;
        this.sendBatchProgress();
      }

      downloadService
        .downloadTrack(task.track, task.format, this.downloadsPath, (progress, status, error, filePath) => {
          task.progress = progress;
          if (status === 'completed') {
            task.status = 'completed';
            task.filePath = filePath;
            this.activeTasks.delete(task.track.id);
            this.sendProgress(task);

            if (task.isBatch && this.batchState && this.batchState.active) {
              this.batchState.completed++;
              this.checkBatchComplete();
              this.sendBatchProgress();
            }

            this.processQueue();
          } else if (status === 'error') {
            task.status = 'error';
            task.error = error;
            this.activeTasks.delete(task.track.id);
            this.sendProgress(task);

            if (task.isBatch && this.batchState && this.batchState.active) {
              this.batchState.failed++;
              this.checkBatchComplete();
              this.sendBatchProgress();
            }

            this.processQueue();
          } else {
            // 'downloading' progress
            this.sendProgress(task);
          }
        })
        .catch((err) => {
          if (err.message === 'DOWNLOAD_CANCELLED') {
            // Handled via cancellation, ignore
            return;
          }
          task.status = 'error';
          task.error = err?.message || 'Download failed';
          this.activeTasks.delete(task.track.id);
          this.sendProgress(task);

          if (task.isBatch && this.batchState && this.batchState.active) {
            this.batchState.failed++;
            this.checkBatchComplete();
            this.sendBatchProgress();
          }

          this.processQueue();
        });
    }
  }
}

export default DownloadQueueManager;
