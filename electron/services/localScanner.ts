import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { parseFile } from 'music-metadata';
import {
  readDownloadedIndex,
  writeDownloadedIndex,
  TrackMetadata,
  DownloadFormat,
} from './downloadService.js';

const SUPPORTED_EXTENSIONS = new Set(['.mp3', '.flac', '.opus', '.m4a']);

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export async function scanLocalFiles(downloadsPath: string): Promise<TrackMetadata[]> {
  if (!downloadsPath || !fs.existsSync(downloadsPath)) {
    return [];
  }

  let entries: string[] = [];
  try {
    entries = fs.readdirSync(downloadsPath);
  } catch (err) {
    console.warn('[LocalScanner] Failed to read downloads folder:', err);
    return [];
  }

  const audioFiles = entries.filter((file) => {
    const ext = path.extname(file).toLowerCase();
    return SUPPORTED_EXTENSIONS.has(ext);
  });

  const index = readDownloadedIndex();
  const existingFilesMap = new Map<string, string>(); // normalized path -> trackId

  for (const [id, item] of Object.entries(index)) {
    if (item.filePath && fs.existsSync(item.filePath)) {
      existingFilesMap.set(path.resolve(item.filePath).toLowerCase(), id);
    } else {
      delete index[id];
    }
  }

  let indexModified = false;
  const verifiedTracks: TrackMetadata[] = [];

  for (let i = 0; i < audioFiles.length; i++) {
    const fileName = audioFiles[i];
    const fullPath = path.join(downloadsPath, fileName);
    const normalizedKey = path.resolve(fullPath).toLowerCase();

    // 1. If file is already recognized in our index
    if (existingFilesMap.has(normalizedKey)) {
      const existingId = existingFilesMap.get(normalizedKey)!;
      const entry = index[existingId];
      if (entry && entry.track) {
        verifiedTracks.push(entry.track);
        continue;
      }
    }

    // 2. Foreign or untracked audio file: inspect with music-metadata
    try {
      const metadata = await parseFile(fullPath);
      const ext = path.extname(fileName).toLowerCase();
      const format = (ext === '.flac' ? 'flac' : 'mp3') as DownloadFormat;
      const baseName = path.basename(fileName, ext);

      // Title & Artist resolution
      let title = metadata.common.title?.trim();
      let artist = metadata.common.artist?.trim() || metadata.common.albumartist?.trim();

      if (!title) {
        if (baseName.includes(' - ')) {
          const parts = baseName.split(' - ');
          artist = artist || parts[0].trim();
          title = parts.slice(1).join(' - ').trim();
        } else {
          title = baseName;
        }
      }

      if (!artist) {
        artist = 'Local Artist';
      }

      const album = metadata.common.album?.trim() || 'Local Files';
      const durSec = Math.round(metadata.format.duration || 0);

      // Extract embedded cover art
      let artworkUrl: string | undefined = undefined;
      if (metadata.common.picture && metadata.common.picture.length > 0) {
        const pic = metadata.common.picture[0];
        try {
          artworkUrl = `data:${pic.format};base64,${Buffer.from(pic.data).toString('base64')}`;
        } catch {}
      }

      const fileHash = crypto.createHash('md5').update(fullPath).digest('hex').slice(0, 12);
      const trackId = `local-${fileHash}`;

      let mtime = Date.now();
      try {
        mtime = fs.statSync(fullPath).mtimeMs;
      } catch {}

      const track: TrackMetadata = {
        id: trackId,
        title,
        artist,
        album,
        duration: formatDuration(durSec),
        durationSec: durSec,
        source: 'LOCAL',
        sourceId: fullPath,
        artworkUrl,
      };

      index[trackId] = {
        track,
        filePath: fullPath,
        format,
        downloadedAt: mtime,
      };

      existingFilesMap.set(normalizedKey, trackId);
      verifiedTracks.push(track);
      indexModified = true;
    } catch (parseErr) {
      console.warn(`[LocalScanner] Could not parse metadata for ${fileName}:`, parseErr);
      const ext = path.extname(fileName).toLowerCase();
      const baseName = path.basename(fileName, ext);
      const fileHash = crypto.createHash('md5').update(fullPath).digest('hex').slice(0, 12);
      const trackId = `local-${fileHash}`;

      const track: TrackMetadata = {
        id: trackId,
        title: baseName,
        artist: 'Local Artist',
        album: 'Local Files',
        duration: '0:00',
        durationSec: 0,
        source: 'LOCAL',
        sourceId: fullPath,
      };

      index[trackId] = {
        track,
        filePath: fullPath,
        format: 'mp3',
        downloadedAt: Date.now(),
      };

      verifiedTracks.push(track);
      indexModified = true;
    }
  }

  if (indexModified) {
    writeDownloadedIndex(index);
  }

  return verifiedTracks;
}

export default {
  scanLocalFiles,
};
