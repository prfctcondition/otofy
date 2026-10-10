// Universal track title and artist parser for frontend components and stores.

export const KNOWN_ARTISTS_WITH_COMMA = [
  'Tyler, The Creator',
  'Earth, Wind & Fire',
  'Crosby, Stills, Nash & Young',
  'Emerson, Lake & Palmer',
  'Blood, Sweat & Tears',
  'Tony, Toni, Toné!',
  'Король и Шут',
  'Время и Стекло',
  'Потап и Настя',
  'Miyagi & Andy Panda',
  'Miyagi & Эндшпиль',
  'HammAli & Navai',
  'Artik & Asti',
];

export const KNOWN_TRANSLITERATED_ARTISTS: Record<string, string> = {
  'мейсон': 'Mason',
  'скриллекс': 'Skrillex',
  'дипло': 'Diplo',
  'эминем': 'Eminem',
  'дрейк': 'Drake',
  'кендрик ламар': 'Kendrick Lamar',
  'тейлор свифт': 'Taylor Swift',
  'канье уэст': 'Kanye West',
  'билли айлиш': 'Billie Eilish',
  'зе викенд': 'The Weeknd',
  'дафт панк': 'Daft Punk',
  'продиджи': 'The Prodigy',
  'нирвана': 'Nirvana',
  'металлика': 'Metallica',
  'рамштайн': 'Rammstein',
  'линкин парк': 'Linkin Park',
};

export function normalizeLocalizedArtistName(name: string): string {
  const trimmed = (name || '').trim();
  const mapped = KNOWN_TRANSLITERATED_ARTISTS[trimmed.toLowerCase()];
  return mapped || trimmed;
}

const COMMA_PLACEHOLDER = '___COMMA_PLACEHOLDER___';
const AMP_PLACEHOLDER = '___AMP_PLACEHOLDER___';
const RU_AND_PLACEHOLDER = '___RU_AND_PLACEHOLDER___';

function escapeRegexLiteral(str: string): string {
  return str.replace(/[.+?^${}()|[\]\\-]/g, '\\$&');
}

export function cleanArtistAndTitle(
  rawTitle: string,
  rawArtist?: string,
  channelTitle?: string
): { title: string; artist: string } {
  let title = (rawTitle || '').trim();
  let artist = (rawArtist || '').trim();
  let channel = (channelTitle || '')
    .trim()
    .replace(/\s{0,}-\s{0,}topic$/i, '')
    .replace(/vevo$/i, '')
    .replace(/\s{0,}official$/i, '')
    .replace(/\s{0,}mix$/i, '')
    .trim();

  // Strip useless video upload tags, but KEEP music mix versions (slowed, sped up, remix, reverb, instrumental)
  title = title
    .replace(
      /\[\s{0,}(copyright\s{0,}free|no\s{0,}copyright|ncs(\s{0,}release)?|free(\s{0,}download)?|official\s{0,}(music\s{0,})?video|official\s{0,}audio|lyrics?\s{0,}(video)?|lyric\s{0,}(music\s{0,})?video|hd|4k|hq|audio|visualizer)\s{0,}\]/gi,
      ''
    )
    .replace(
      /\(\s{0,}(copyright\s{0,}free|no\s{0,}copyright|ncs(\s{0,}release)?|free(\s{0,}download)?|official\s{0,}(music\s{0,})?video|official\s{0,}audio|lyrics?\s{0,}(video)?|lyric\s{0,}(music\s{0,})?video|hd|4k|hq|audio|visualizer)\s{0,}\)/gi,
      ''
    )
    .replace(/\s+/g, ' ')
    .trim();

  // Clean channel/reposter clutter from artist
  artist = artist
    .replace(/\s{0,}-\s{0,}topic$/i, '')
    .replace(/vevo$/i, '')
    .replace(/\s{0,}official$/i, '')
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
    const escapedArtist = escapeRegexLiteral(artist);
    const prefixRegex = new RegExp('^' + escapedArtist + '\\s{0,}[-–—]\\s{0,}', 'i');
    if (prefixRegex.test(title)) {
      title = title.replace(prefixRegex, '').trim();
    }
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
    .replace(/\s{0,}\|\s{0,}[^|]+$/, '')
    .replace(/^["'«]([\s\S]{0,})["'»]$/, '$1')
    .trim();

  // Clean common beat/freestyle tags from artist
  artist = artist
    .replace(/^\[\s{0,}(free|prod\.?)\s{0,}\]\s{0,}/i, '')
    .replace(/\s{0,}type\s{0,}beat$/i, '')
    .replace(/^["'«]([\s\S]{0,})["'»]$/, '$1')
    .replace(/\s{0,}official$/i, '')
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

  const normalizedParts = splitArtists(artist);
  if (normalizedParts.length > 0) {
    artist = normalizedParts.join(', ');
  }

  return { title, artist };
}

export function splitArtists(artistString?: string, explicitArtists?: string[]): string[] {
  if (Array.isArray(explicitArtists) && explicitArtists.length > 0) {
    const cleaned = explicitArtists
      .flatMap((a) => splitArtists(a))
      .map((s) => normalizeLocalizedArtistName(s))
      .filter(Boolean);
    const seenExplicit = new Set<string>();
    const deduped: string[] = [];
    for (const item of cleaned) {
      const low = item.toLowerCase();
      if (!seenExplicit.has(low)) {
        seenExplicit.add(low);
        deduped.push(item);
      }
    }
    if (deduped.length > 0) return deduped;
  }
  if (!artistString || typeof artistString !== 'string') return [];

  let escaped = artistString;
  for (const known of KNOWN_ARTISTS_WITH_COMMA) {
    const escapedKnown = escapeRegexLiteral(known);
    escaped = escaped.replace(new RegExp(escapedKnown, 'gi'), (match) =>
      match
        .replace(/,/g, COMMA_PLACEHOLDER)
        .replace(/&/g, AMP_PLACEHOLDER)
        .replace(/\s+и\s+/gi, RU_AND_PLACEHOLDER)
    );
  }

  const rawParts = escaped
    .split(/(?:,|\/|;|&|\s+и\s+|\s+and\s+|\b(?:feat\.?|ft\.?|featuring)\b)/i)
    .map((s) =>
      normalizeLocalizedArtistName(
        s
          .replace(new RegExp(COMMA_PLACEHOLDER, 'g'), ',')
          .replace(new RegExp(AMP_PLACEHOLDER, 'g'), '&')
          .replace(new RegExp(RU_AND_PLACEHOLDER, 'g'), ' и ')
          .trim()
      )
    )
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

  return result.length > 0 ? result : [normalizeLocalizedArtistName(artistString)];
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

  const norm = (s: string) => (s || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
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

export default {
  cleanArtistAndTitle,
  splitArtists,
  normalizeLocalizedArtistName,
  KNOWN_ARTISTS_WITH_COMMA,
  extractCanonicalTrackId,
  areTracksDuplicate,
  filterUniqueTracks,
};
