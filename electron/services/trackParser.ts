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

export default { cleanArtistAndTitle, splitArtists, KNOWN_ARTISTS_WITH_COMMA };
