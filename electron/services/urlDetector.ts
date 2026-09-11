/**
 * URL Detector and Parser for Otofy Search
 * Identifies direct links to channels, albums, tracks, and profiles.
 */

export type DetectedUrlType =
  | { type: 'yt_channel'; channelId: string; rawUrl: string }
  | { type: 'yt_handle'; handle: string; rawUrl: string }
  | { type: 'yt_playlist'; playlistId: string; rawUrl: string }
  | { type: 'yt_track'; videoId: string; rawUrl: string }
  | { type: 'sc_url'; scUrl: string }
  | { type: 'spotify_entity'; entityType: 'artist' | 'album' | 'track' | 'playlist'; id: string; rawUrl: string }
  | null;

export function detectMusicUrl(query: string): DetectedUrlType {
  const q = (query || '').trim();
  if (
    !q.startsWith('http://') &&
    !q.startsWith('https://') &&
    !q.startsWith('music.youtube.com') &&
    !q.startsWith('youtube.com') &&
    !q.startsWith('youtu.be') &&
    !q.startsWith('soundcloud.com') &&
    !q.startsWith('open.spotify.com')
  ) {
    return null;
  }

  const urlStr = q.startsWith('http') ? q : `https://${q}`;
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');

  // YouTube / YouTube Music
  if (host === 'youtube.com' || host === 'music.youtube.com' || host === 'm.youtube.com') {
    // 1. Channel
    const channelMatch = parsed.pathname.match(/\/channel\/(UC[\w-]+)/i);
    if (channelMatch) {
      return { type: 'yt_channel', channelId: channelMatch[1], rawUrl: urlStr };
    }

    // 2. Handle
    const handleMatch = parsed.pathname.match(/^\/@([a-zA-Z0-9_.-]+)/i);
    if (handleMatch) {
      return { type: 'yt_handle', handle: handleMatch[1], rawUrl: urlStr };
    }

    // 3. Playlist / Album
    const listId = parsed.searchParams.get('list');
    const isWatch = parsed.pathname.includes('/watch');
    if (listId && !isWatch) {
      return { type: 'yt_playlist', playlistId: listId, rawUrl: urlStr };
    }

    // 4. Video / Track
    const vId = parsed.searchParams.get('v');
    if (vId && /^[a-zA-Z0-9_-]{11}$/.test(vId)) {
      return { type: 'yt_track', videoId: vId, rawUrl: urlStr };
    }
  }

  if (host === 'youtu.be') {
    const vId = parsed.pathname.replace(/^\//, '').split('/')[0];
    if (vId && /^[a-zA-Z0-9_-]{11}$/.test(vId)) {
      return { type: 'yt_track', videoId: vId, rawUrl: urlStr };
    }
  }

  // SoundCloud
  if (host === 'soundcloud.com' || host === 'm.soundcloud.com' || host === 'on.soundcloud.com') {
    return { type: 'sc_url', scUrl: urlStr };
  }

  // Spotify
  if (host === 'open.spotify.com') {
    const spMatch = parsed.pathname.match(/\/(artist|album|track|playlist)\/([a-zA-Z0-9]+)/i);
    if (spMatch) {
      return {
        type: 'spotify_entity',
        entityType: spMatch[1].toLowerCase() as any,
        id: spMatch[2],
        rawUrl: urlStr,
      };
    }
  }

  return null;
}
