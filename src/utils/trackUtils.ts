/**
 * Universal track title and artist parser for frontend components and stores.
 */

export const KNOWN_ARTISTS_WITH_COMMA = [
  'Tyler, The Creator',
  'Earth, Wind & Fire',
  'Crosby, Stills, Nash & Young',
  'Emerson, Lake & Palmer',
  'Blood, Sweat & Tears',
  'Tony, Toni, Toné!',
];

const COMMA_PLACEHOLDER = '___COMMA_PLACEHOLDER___';
const AMP_PLACEHOLDER = '___AMP_PLACEHOLDER___';

export function cleanArtistAndTitle(
  rawTitle: string,
  rawArtist?: string,
  channelTitle?: string
): { title: string; artist: string } {
  let title = (rawTitle || '').trim();
  let artist = (rawArtist || '').trim();
  let channel = (channelTitle || '').trim()
    .replace(/\s*-\s*topic$/i, '')
    .replace(/vevo$/i, '')
    .replace(/\s*official$/i, '')
    .replace(/\s*mix$/i, '')
    .trim();

  // Strip useless video upload tags, but KEEP music mix versions (slowed, sped up, remix, reverb, instrumental)
  title = title
    .replace(/\[\s*(copyright\s*free|no\s*copyright|ncs(\s*release)?|free(\s*download)?|official\s*(music\s*)?video|official\s*audio|lyrics?\s*(video)?|lyric\s*(music\s*)?video|hd|4k|hq|audio|visualizer)\s*\]/gi, '')
    .replace(/\(\s*(copyright\s*free|no\s*copyright|ncs(\s*release)?|free(\s*download)?|official\s*(music\s*)?video|official\s*audio|lyrics?\s*(video)?|lyric\s*(music\s*)?video|hd|4k|hq|audio|visualizer)\s*\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Clean channel/reposter clutter from artist
  artist = artist
    .replace(/\s*-\s*topic$/i, '')
    .replace(/vevo$/i, '')
    .replace(/\s*official$/i, '')
    .trim();

  const invalidArtists = [
    'unknown artist',
    'unknown',
    'song',
    'video',
    'single',
    'ep',
    'album',
    'various artists',
    'track',
    'audio',
    'undefined',
    'null',
  ];

  if (invalidArtists.includes(artist.toLowerCase())) {
    artist = '';
  }

  const isGenericChannel = (name: string) => {
    const l = name.toLowerCase();
    return (
      l.includes('records') ||
      l.includes('nation') ||
      l.includes('city') ||
      l.includes('trap') ||
      l.includes('chill') ||
      l.includes('upload') ||
      l.includes('leak')
    );
  };

  const splitSeparators = [' - ', ' – ', ' — ', ' // '];

  // If artist is already valid and not a generic channel:
  if (artist && !isGenericChannel(artist)) {
    // Only strip redundant "Artist - " prefix if title starts with the exact artist
    const escapedArtist = artist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const prefixRegex = new RegExp('^' + escapedArtist + '\\s*[-–—]\\s*', 'i');
    if (prefixRegex.test(title)) {
      title = title.replace(prefixRegex, '').trim();
    }
    // DO NOT split title to overwrite the known artist!
  } else {
    // Artist is missing or generic channel: attempt to extract "Artist - Title" from video title
    for (const sep of splitSeparators) {
      if (title.includes(sep)) {
        const parts = title.split(sep);
        if (parts.length >= 2) {
          const potentialArtist = parts[0].trim();
          const potentialTitle = parts.slice(1).join(sep).trim();
          if (potentialArtist.length > 0 && potentialTitle.length > 0 && potentialArtist.length < 50) {
            artist = potentialArtist;
            title = potentialTitle;
            break;
          }
        }
      }
    }
  }

  // Final cleanup of surrounding quotes and YouTube trailer pipe tags
  title = title
    .replace(/\s*\|\s*[^|]+$/, '')
    .replace(/^["'«](.*)["'»]$/, '$1')
    .trim();

  // Clean common beat/freestyle tags from artist
  artist = artist
    .replace(/^\[\s*(free|prod\.?)\s*\]\s*/i, '')
    .replace(/\s*type\s*beat$/i, '')
    .replace(/^["'«](.*)["'»]$/, '$1')
    .replace(/\s*official$/i, '')
    .trim();

  // If artist is still unknown/empty, fallback to channel title
  if (!artist || invalidArtists.includes(artist.toLowerCase())) {
    if (channel && !invalidArtists.includes(channel.toLowerCase()) && !isGenericChannel(channel)) {
      artist = channel;
    }
  }

  if (!artist || invalidArtists.includes(artist.toLowerCase())) {
    artist = channel || 'Unknown Artist';
  }
  if (!title) {
    title = 'Untitled';
  }

  return { title, artist };
}

/**
 * Splits collaborating artists from a combined artist string.
 * Supports popular delimiters: commas `,`, `&`, `feat.`, `ft.`, `featuring`, `/`, `;`
 * Preserves known stage names with commas and explicit artist arrays.
 */
export function splitArtists(artistString?: string, explicitArtists?: string[]): string[] {
  if (Array.isArray(explicitArtists) && explicitArtists.length > 0) {
    return explicitArtists.map((s) => s.trim()).filter(Boolean);
  }
  if (!artistString || typeof artistString !== 'string') return [];

  let escaped = artistString;
  for (const known of KNOWN_ARTISTS_WITH_COMMA) {
    const escapedKnown = known.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    escaped = escaped.replace(new RegExp(escapedKnown, 'gi'), (match) =>
      match.replace(/,/g, COMMA_PLACEHOLDER).replace(/&/g, AMP_PLACEHOLDER)
    );
  }

  const rawParts = escaped
    .split(/\s*(?:,|(?:\s*\/\s*)|(?:\s*;\s*)|(?:\s*&\s*)|\b(?:feat\.?|ft\.?|featuring)\b)\s*/i)
    .map((s) => s.replace(new RegExp(COMMA_PLACEHOLDER, 'g'), ',').replace(new RegExp(AMP_PLACEHOLDER, 'g'), '&').trim())
    .filter((s) => s.length > 0);

  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of rawParts) {
    const lower = part.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      result.push(part);
    }
  }

  return result.length > 0 ? result : [artistString.trim()];
}

export function extractCanonicalTrackId(id: string | undefined | null): string {
  if (!id) return '';
  if (id.startsWith('sc-') || id.startsWith('dm-sc-') || id.includes('-sc-')) {
    const scMatch = id.match(/(\d+)$/);
    if (scMatch) return scMatch[1];
  }
  const ytMatch = id.match(/([a-zA-Z0-9_-]{11})$/);
  if (ytMatch) return ytMatch[1];

  return id
    .replace(/^dm-(?:yt-|sc-)?\d+-\d+-/, '')
    .replace(/^dm-(?:yt-|sc-)?\d+-/, '')
    .replace(/^artist-(?:yt|sc)-[^-]+-\d+-/, '')
    .replace(/^album-(?:yt|sc)-\d+-/, '')
    .replace(/^(?:sc-|yt-|dm-)/, '')
    .trim();
}

export interface MinimalTrackInfo {
  id?: string;
  title?: string;
  artist?: string;
  sourceId?: string;
  durationSec?: number;
}

export function areTracksDuplicate(a: Record<string, any>, b: Record<string, any>): boolean {
  if (!a || !b) return false;
  if (a.id && b.id && a.id === b.id) return true;

  if (a.sourceId && b.sourceId && a.sourceId === b.sourceId) return true;

  const cidA = extractCanonicalTrackId(a.sourceId || a.id);
  const cidB = extractCanonicalTrackId(b.sourceId || b.id);
  if (cidA && cidB && cidA === cidB) return true;

  const { title: tA, artist: aA } = cleanArtistAndTitle(a.title || '', a.artist || '');
  const { title: tB, artist: aB } = cleanArtistAndTitle(b.title || '', b.artist || '');

  const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9а-яё]/gi, '');
  const normTA = norm(tA);
  const normTB = norm(tB);
  const normAA = norm(aA);
  const normAB = norm(aB);

  if (normTA.length >= 2 && normTA === normTB && normAA.length >= 2 && normAA === normAB) {
    if (
      typeof a.durationSec === 'number' &&
      a.durationSec > 0 &&
      typeof b.durationSec === 'number' &&
      b.durationSec > 0
    ) {
      return Math.abs(a.durationSec - b.durationSec) <= 6;
    }
    return true;
  }

  return false;
}

export function filterUniqueTracks<T extends Record<string, any>>(tracks: T[]): T[] {
  const result: T[] = [];
  for (const track of tracks) {
    if (!result.some((existing) => areTracksDuplicate(existing, track))) {
      result.push(track);
    }
  }
  return result;
}

export default { cleanArtistAndTitle, splitArtists, KNOWN_ARTISTS_WITH_COMMA, extractCanonicalTrackId, areTracksDuplicate, filterUniqueTracks };
