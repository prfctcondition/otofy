import fs from 'fs';
import path from 'path';
import os from 'os';
import ffmpeg from 'fluent-ffmpeg';
import installer from '@ffmpeg-installer/ffmpeg';
import { app } from 'electron';
import ytResolver from './ytResolver.js';
import scResolver from './scResolver.js';

// Configure ffmpeg path safely for dev and packaged environments
let ffmpegPath = installer.path;
if (app && app.isPackaged) {
  ffmpegPath = ffmpegPath.replace('app.asar', 'app.asar.unpacked');
}
ffmpeg.setFfmpegPath(ffmpegPath);

export interface TrackMetadata {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: string;
  durationSec?: number;
  source: 'YT' | 'SC' | 'LOCAL';
  sourceId?: string;
  artworkUrl?: string;
}

export type DownloadFormat = 'mp3' | 'flac';

export function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getExpectedFilename(track: TrackMetadata, format: DownloadFormat = 'mp3'): string {
  const artist = sanitizeFilename(track.artist || 'Unknown Artist');
  const title = sanitizeFilename(track.title || 'Untitled');
  return `${artist} - ${title}.${format}`;
}

export function checkTrackDownloaded(
  track: TrackMetadata,
  downloadsPath: string
): { downloaded: boolean; format?: DownloadFormat; filePath?: string } {
  if (!downloadsPath || !fs.existsSync(downloadsPath)) {
    return { downloaded: false };
  }

  const mp3File = path.join(downloadsPath, getExpectedFilename(track, 'mp3'));
  if (fs.existsSync(mp3File)) {
    return { downloaded: true, format: 'mp3', filePath: mp3File };
  }

  const flacFile = path.join(downloadsPath, getExpectedFilename(track, 'flac'));
  if (fs.existsSync(flacFile)) {
    return { downloaded: true, format: 'flac', filePath: flacFile };
  }

  return { downloaded: false };
}

async function downloadArtworkToTemp(artworkUrl?: string): Promise<string | null> {
  if (!artworkUrl) return null;
  try {
    const res = await fetch(artworkUrl);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const tempPath = path.join(os.tmpdir(), `otofy-art-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`);
    fs.writeFileSync(tempPath, Buffer.from(arrayBuffer));
    return tempPath;
  } catch (err) {
    console.warn('[DownloadService] Failed to download artwork to temp:', err);
    return null;
  }
}

// Map tracking active ffmpeg commands so downloads can be tracked or cancelled
const activeDownloads = new Map<string, ffmpeg.FfmpegCommand>();

export async function downloadTrack(
  track: TrackMetadata,
  format: DownloadFormat = 'mp3',
  downloadsPath: string,
  onProgress: (progress: number, status: 'downloading' | 'completed' | 'error', error?: string, filePath?: string) => void
): Promise<string> {
  const trackId = track.id;
  if (activeDownloads.has(trackId)) {
    throw new Error('Track is already downloading');
  }

  if (!fs.existsSync(downloadsPath)) {
    fs.mkdirSync(downloadsPath, { recursive: true });
  }

  const filename = getExpectedFilename(track, format);
  const targetFilePath = path.join(downloadsPath, filename);
  const tempOutput = path.join(os.tmpdir(), `otofy-dl-${Date.now()}-${filename}`);

  // Resolve audio stream URL
  const rawId = track.sourceId || track.id;
  const cleanId = rawId
    .replace(/^dm-(?:yt-|sc-)?\d+-\d+-/, '')
    .replace(/^dm-(?:yt-|sc-)?\d+-/, '')
    .replace(/^artist-(?:yt|sc)-[^-]+-\d+-/, '')
    .replace(/^album-(?:yt|sc)-\d+-/, '')
    .replace(/^(?:sc-|yt-|dm-)/, '');

  let streamUrl = '';
  if (track.source === 'SC') {
    const scRes = await scResolver.resolve(cleanId);
    streamUrl = scRes.url;
  } else {
    const ytRes = await ytResolver.resolve(cleanId, track.title, track.artist);
    streamUrl = ytRes.url;
  }

  if (!streamUrl) {
    throw new Error('Unable to resolve audio stream URL');
  }

  onProgress(5, 'downloading');

  let artworkTempPath: string | null = null;
  if (track.artworkUrl) {
    artworkTempPath = await downloadArtworkToTemp(track.artworkUrl);
  }

  return new Promise<string>((resolve, reject) => {
    const command = ffmpeg(streamUrl);
    activeDownloads.set(trackId, command);

    command.inputOptions([
      '-user_agent',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ]);

    const title = track.title || 'Untitled';
    const artist = track.artist || 'Unknown Artist';
    const album = track.album || '';

    if (artworkTempPath && format === 'mp3') {
      command.input(artworkTempPath);
      command.outputOptions(
        '-map', '0:a',
        '-map', '1:0',
        '-c:v', 'copy',
        '-id3v2_version', '3',
        '-metadata', `title=${title}`,
        '-metadata', `artist=${artist}`,
        '-metadata', `album=${album}`,
        '-metadata:s:v', 'title=Album cover',
        '-metadata:s:v', 'comment=Cover (front)'
      );
    } else {
      command.outputOptions(
        '-metadata', `title=${title}`,
        '-metadata', `artist=${artist}`,
        '-metadata', `album=${album}`
      );
    }

    if (format === 'mp3') {
      command.audioCodec('libmp3lame').audioBitrate(320);
    } else if (format === 'flac') {
      command.audioCodec('flac');
    }

    command.output(tempOutput);

    command.on('progress', (p) => {
      let percent = Math.round(p.percent || 0);
      if (percent < 10) percent = 10;
      if (percent > 98) percent = 98;
      onProgress(percent, 'downloading');
    });

    command.on('end', () => {
      activeDownloads.delete(trackId);
      try {
        if (artworkTempPath && fs.existsSync(artworkTempPath)) {
          fs.unlinkSync(artworkTempPath);
        }
      } catch {}

      try {
        // Atomic move from tempOutput to final target path
        if (fs.existsSync(targetFilePath)) {
          fs.unlinkSync(targetFilePath);
        }
        fs.copyFileSync(tempOutput, targetFilePath);
        fs.unlinkSync(tempOutput);

        onProgress(100, 'completed', undefined, targetFilePath);

        // Save track to persistent downloads index
        try {
          const index = readDownloadedIndex();
          index[track.id] = {
            track,
            filePath: targetFilePath,
            format,
            downloadedAt: Date.now(),
          };
          writeDownloadedIndex(index);
        } catch (idxErr) {
          console.warn('[DownloadService] Failed to update downloaded index:', idxErr);
        }

        resolve(targetFilePath);
      } catch (copyErr: any) {
        onProgress(0, 'error', copyErr?.message || 'Failed to finalize downloaded file');
        reject(copyErr);
      }
    });

    command.on('error', (err: any) => {
      activeDownloads.delete(trackId);
      try {
        if (artworkTempPath && fs.existsSync(artworkTempPath)) {
          fs.unlinkSync(artworkTempPath);
        }
      } catch {}
      try {
        if (fs.existsSync(tempOutput)) {
          fs.unlinkSync(tempOutput);
        }
      } catch {}

      onProgress(0, 'error', err?.message || 'FFmpeg conversion failed');
      reject(err);
    });

    command.run();
  });
}

function getMetadataIndexPath(): string {
  try {
    return path.join(app.getPath('userData'), 'downloaded_tracks.json');
  } catch {
    return path.join(os.homedir(), '.otofy-downloads.json');
  }
}

export function readDownloadedIndex(): Record<
  string,
  { track: TrackMetadata; filePath: string; format: DownloadFormat; downloadedAt: number }
> {
  try {
    const metaPath = getMetadataIndexPath();
    if (fs.existsSync(metaPath)) {
      const content = fs.readFileSync(metaPath, 'utf8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.warn('[DownloadService] readDownloadedIndex error:', err);
  }
  return {};
}

export function writeDownloadedIndex(
  data: Record<string, { track: TrackMetadata; filePath: string; format: DownloadFormat; downloadedAt: number }>
): void {
  try {
    const metaPath = getMetadataIndexPath();
    const dir = path.dirname(metaPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(metaPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.warn('[DownloadService] writeDownloadedIndex error:', err);
  }
}

export function removeDownloadedTrack(
  track: TrackMetadata,
  downloadsPath: string
): { removed: boolean; filePath?: string } {
  let removed = false;
  let targetPath: string | undefined;

  const status = checkTrackDownloaded(track, downloadsPath);
  if (status.downloaded && status.filePath && fs.existsSync(status.filePath)) {
    try {
      fs.unlinkSync(status.filePath);
      targetPath = status.filePath;
      removed = true;
    } catch (err) {
      console.warn('[DownloadService] Failed to unlink file:', status.filePath, err);
    }
  }

  // Also check direct index
  const index = readDownloadedIndex();
  if (index[track.id]) {
    const idxPath = index[track.id].filePath;
    if (idxPath && fs.existsSync(idxPath)) {
      try {
        fs.unlinkSync(idxPath);
        targetPath = idxPath;
        removed = true;
      } catch {}
    }
    delete index[track.id];
    writeDownloadedIndex(index);
  }

  return { removed, filePath: targetPath };
}

export function getDownloadedTracks(downloadsPath: string): TrackMetadata[] {
  const index = readDownloadedIndex();
  const validTracks: TrackMetadata[] = [];
  let indexModified = false;

  for (const [id, item] of Object.entries(index)) {
    if (item.filePath && fs.existsSync(item.filePath)) {
      validTracks.push(item.track);
    } else {
      delete index[id];
      indexModified = true;
    }
  }

  if (indexModified) {
    writeDownloadedIndex(index);
  }

  return validTracks;
}

export default {
  downloadTrack,
  checkTrackDownloaded,
  removeDownloadedTrack,
  getDownloadedTracks,
  getExpectedFilename,
  sanitizeFilename,
};
