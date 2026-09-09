/**
 * Universal track title and artist parser.
 * Handles "Artist - Title" strings, removes noise like [Official Video],
 * cleans YouTube topic/vevo channels, and extracts real artists.
 */
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

  // Strip useless noise from title: [Official Video], [Copyright Free], [No Copyright], [NCS Release], etc.
  title = title
    .replace(/\[\s*(copyright\s*free|no\s*copyright|ncs(\s*release)?|free(\s*download)?|official\s*(music\s*)?video|official\s*audio|lyrics|hd|4k|hq|audio|visualizer|bass\s*boosted|slowed(\s*\+\s*reverb)?)\s*\]/gi, '')
    .replace(/\(\s*(copyright\s*free|no\s*copyright|ncs(\s*release)?|free(\s*download)?|official\s*(music\s*)?video|official\s*audio|lyrics|hd|4k|hq|audio|visualizer|bass\s*boosted|slowed(\s*\+\s*reverb)?)\s*\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Clean channel/reposter clutter from artist
  artist = artist
    .replace(/\s*-\s*topic$/i, '')
    .replace(/vevo$/i, '')
    .replace(/\s*official$/i, '')
    .replace(/\s*mix$/i, '')
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

  // Check if title has quotes like 'TITAN' after Mix/Beat/Genre or standalone
  // e.g. "Dark Techno / EBM / Industrial Bass Mix 'TITAN'" -> "TITAN"
  const quotedMatch = title.match(/(?:mix|beat|wave|bass|techno|phonk|metal|house|cyberpunk|industrial|electro)?\s*['"«]([^'"»]{2,40})['"»]/i);
  if (quotedMatch && quotedMatch[1]) {
    const songName = quotedMatch[1].trim();
    if (songName.length >= 2) {
      title = songName;
    }
  }

  // Check if title has "Artist - Song Title" or "Artist – Song Title"
  const splitSeparators = [' - ', ' – ', ' — ', ' // '];
  for (const sep of splitSeparators) {
    if (title.includes(sep)) {
      const parts = title.split(sep);
      if (parts.length >= 2) {
        const potentialArtist = parts[0].trim();
        const potentialTitle = parts.slice(1).join(sep).trim();

        // If artist was empty/invalid OR resembles a generic uploader/channel
        if (
          !artist ||
          artist.toLowerCase().includes('records') ||
          artist.toLowerCase().includes('nation') ||
          artist.toLowerCase().includes('city') ||
          artist.toLowerCase().includes('trap') ||
          artist.toLowerCase().includes('chill') ||
          artist.toLowerCase().includes('music') ||
          artist.toLowerCase().includes('upload') ||
          artist.toLowerCase().includes('leak')
        ) {
          if (potentialArtist.length > 0 && potentialTitle.length > 0) {
            artist = potentialArtist;
            title = potentialTitle;
            break;
          }
        } else if (
          !artist.toLowerCase().includes(potentialArtist.toLowerCase()) &&
          !potentialArtist.toLowerCase().includes(artist.toLowerCase())
        ) {
          if (potentialArtist.length > 0 && potentialTitle.length > 0 && potentialArtist.length < 50) {
            artist = potentialArtist;
            title = potentialTitle;
            break;
          }
        } else {
          title = potentialTitle;
          break;
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
    .replace(/\s*mix$/i, '')
    .trim();

  // If artist is still unknown/empty, fallback to channel title
  if (!artist || invalidArtists.includes(artist.toLowerCase())) {
    if (channel && !invalidArtists.includes(channel.toLowerCase())) {
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

export default { cleanArtistAndTitle };
