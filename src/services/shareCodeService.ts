import pako from 'pako';
import type { ShareCodeData, Track } from '../types';

const SHARE_PREFIX = 'OTO';
const CODE_VERSION = 1;

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Format into hyphenated groups: OTO-xxxx-xxxx-xxxx
function formatCode(payload: string): string {
  const chunks: string[] = [];
  for (let i = 0; i < payload.length; i += 4) {
    chunks.push(payload.slice(i, i + 4));
  }
  return `${SHARE_PREFIX}-${chunks.join('-')}`;
}

export function generateShareCode(
  title: string,
  creator: string,
  tracks: Track[]
): string {
  const payload: ShareCodeData = {
    version: CODE_VERSION,
    title,
    creator,
    tracks: tracks.map((t) => ({
      title: t.title,
      artist: t.artist,
      durationSec: t.durationSec || 180,
      source: t.source as 'YT' | 'SC',
      sourceId: t.sourceId || t.id,
    })),
  };

  const json = JSON.stringify(payload);
  const compressed = pako.deflate(new TextEncoder().encode(json));
  const b64 = uint8ToBase64(compressed);
  // Replace + with . and / with _ so - is strictly the chunk separator
  const safe = b64.replace(/\+/g, '.').replace(/\//g, '_').replace(/=+$/, '');
  return formatCode(safe);
}

export function parseShareCode(code: string): ShareCodeData | null {
  try {
    const raw = code.trim();
    // Remove OTO- or ZEN- prefix and all chunk-separator hyphens
    const clean = raw.replace(/^(OTO|ZEN)-/i, '').replace(/-/g, '');
    let restoredB64 = clean.replace(/\./g, '+').replace(/_/g, '/');
    while (restoredB64.length % 4) {
      restoredB64 += '=';
    }

    const compressed = base64ToUint8(restoredB64);
    const json = new TextDecoder().decode(pako.inflate(compressed));
    const data = JSON.parse(json) as ShareCodeData;

    if (!data.title || !Array.isArray(data.tracks)) {
      return null;
    }
    return data;
  } catch (err) {
    console.error('[ShareCode] Failed to parse share code:', err);
    return null;
  }
}
