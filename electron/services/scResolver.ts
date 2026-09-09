import { cleanArtistAndTitle } from './trackParser.js';

export interface SCResolveResult {
  url: string;
  format: string;
  duration: number;
}

export interface SCSearchResult {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: string;
  durationSec: number;
  source: 'SC';
  artworkUrl?: string;
  sourceId: string;
}

let cachedClientId: string | null = null;
let clientIdExpiresAt = 0;

// Fallback client ID in case live extraction fails
const FALLBACK_CLIENT_ID = 'y7xP5e50k2cT7Uo3n30zG6jPffV4d00B';

export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export async function getClientId(): Promise<string> {
  const now = Date.now();
  if (cachedClientId && now < clientIdExpiresAt) {
    return cachedClientId;
  }

  try {
    const htmlRes = await fetch('https://soundcloud.com', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (htmlRes.ok) {
      const html = await htmlRes.text();
      const scriptUrls: string[] = [];
      const scriptRegex = /<script[^>]+src="([^">]+\.js)"[^>]*>/gi;
      let match: RegExpExecArray | null;

      while ((match = scriptRegex.exec(html)) !== null) {
        if (match[1].includes('sndcdn.com/assets/')) {
          scriptUrls.push(match[1]);
        }
      }

      // Check scripts backwards as vendor/client scripts are typically near the bottom
      for (let i = scriptUrls.length - 1; i >= 0; i--) {
        const scriptUrl = scriptUrls[i];
        try {
          const scriptRes = await fetch(scriptUrl);
          if (!scriptRes.ok) continue;
          const scriptText = await scriptRes.text();
          const idMatch =
            scriptText.match(/client_id[:=]["']([a-zA-Z0-9]{32})["']/) ||
            scriptText.match(/client_id=([a-zA-Z0-9]{32})/);
          if (idMatch && idMatch[1]) {
            cachedClientId = idMatch[1];
            clientIdExpiresAt = now + 3600 * 1000; // 1-hour TTL
            return cachedClientId;
          }
        } catch {
          // Continue scanning next script
        }
      }
    }
  } catch (err) {
    console.warn('Could not extract SoundCloud client_id from soundcloud.com:', err);
  }

  if (cachedClientId) {
    return cachedClientId;
  }

  return FALLBACK_CLIENT_ID;
}

export async function fetchSC(urlPath: string, params: Record<string, string | number> = {}): Promise<Response> {
  let clientId = await getClientId();
  const buildUrl = (cid: string) => {
    const sp = new URLSearchParams({
      ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
      client_id: cid,
    });
    const sep = urlPath.includes('?') ? '&' : '?';
    return `${urlPath}${sep}${sp.toString()}`;
  };

  let res = await fetch(buildUrl(clientId));
  if (!res.ok && (res.status === 401 || res.status === 403 || res.status === 500)) {
    cachedClientId = null;
    clientIdExpiresAt = 0;
    clientId = await getClientId();
    res = await fetch(buildUrl(clientId));
  }
  return res;
}

export async function resolve(trackId: string, skipSnippetFallback = false): Promise<SCResolveResult> {
  const trackRes = await fetchSC(`https://api-v2.soundcloud.com/tracks/${encodeURIComponent(trackId)}`);

  if (!trackRes.ok) {
    throw new Error(`SoundCloud track API failed: ${trackRes.statusText}`);
  }

  const trackData: any = await trackRes.json();

  // Check if track is a SoundCloud Go+ 30s preview snippet
  const isSnippet =
    trackData?.policy === 'SNIP' ||
    trackData?.snipped === true ||
    (trackData?.duration <= 35000 && (trackData?.full_duration > 60000 || !trackData?.full_duration));

  if (isSnippet && !skipSnippetFallback) {
    try {
      const q = `${trackData.title || ''} ${trackData.user?.username || ''}`.trim();
      if (q) {
        const hits = await search(q);
        const fullCandidates = hits.filter((h) => h.durationSec > 45 && h.id !== String(trackId));
        for (const candidate of fullCandidates.slice(0, 5)) {
          try {
            const fullRes = await resolve(candidate.sourceId, true);
            if (fullRes && fullRes.duration > 35) {
              return fullRes;
            }
          } catch {
            // Try next candidate
          }
        }
      }
    } catch (err) {
      console.warn('[scResolver] Snippet auto-fallback failed:', err);
    }
  }

  const transcodings: any[] = trackData?.media?.transcodings || [];

  if (!transcodings.length) {
    throw new Error(`No transcodings found for SoundCloud track: ${trackId}`);
  }

  // Sort transcodings: progressive unencrypted first, then regular hls, skipping encrypted
  const sortedTranscodings = [...transcodings].sort((a, b) => {
    const isProgA = a.format?.protocol === 'progressive' ? 2 : 0;
    const isProgB = b.format?.protocol === 'progressive' ? 2 : 0;
    const isEncA = a.format?.protocol?.includes('encrypted') ? -5 : 0;
    const isEncB = b.format?.protocol?.includes('encrypted') ? -5 : 0;
    return (isProgB + isEncB) - (isProgA + isEncA);
  });

  const clientId = await getClientId();
  for (const transcoding of sortedTranscodings) {
    if (!transcoding.url) continue;
    try {
      const sep = transcoding.url.includes('?') ? '&' : '?';
      const streamRes = await fetch(`${transcoding.url}${sep}client_id=${clientId}`);
      if (!streamRes.ok) continue;

      const streamData: any = await streamRes.json();
      if (!streamData?.url) continue;
      if (streamData.url.includes('/cbcs/') || streamData.url.includes('/ctrs/')) continue;
      // Never stream preview audio files
      if (streamData.url.includes('/preview/') || streamData.url.includes('preview-media')) continue;

      const format =
        transcoding.preset?.includes('opus') || transcoding.format?.mime_type?.includes('opus')
          ? 'opus'
          : 'mp3';

      const durationSec = Math.round((trackData.duration || transcoding.duration || 0) / 1000);

      return {
        url: streamData.url,
        format,
        duration: durationSec,
      };
    } catch {
      continue;
    }
  }

  throw new Error(`No accessible stream URL found for SoundCloud track: ${trackId}`);
}

export async function search(query: string): Promise<SCSearchResult[]> {
  const response = await fetchSC('https://api-v2.soundcloud.com/search/tracks', {
    q: query,
    limit: 25,
  });

  if (!response.ok) {
    console.warn(`[scResolver] SoundCloud search failed with status: ${response.status}`);
    return [];
  }

  const data: any = await response.json();
  const collection: any[] = data?.collection || [];

  // Filter out Go+ 30s preview snippets
  const validCollection = collection.filter((item: any) => {
    if (item.policy === 'SNIP' || item.snipped === true) return false;
    const durSec = Math.round((item.duration || 0) / 1000);
    if (durSec <= 35 && (item.full_duration > 60000 || !item.full_duration)) return false;
    return true;
  });

  return validCollection.map((item: any) => {
    const durationSec = Math.round((item.duration || 0) / 1000);
    const rawArtwork: string = item.artwork_url || item.user?.avatar_url || '';
    const artworkUrl = rawArtwork ? rawArtwork.replace('-large.', '-t500x500.') : undefined;

    const rawArtist =
      item.publisher_metadata?.artist ||
      item.publisher_metadata?.album_artist ||
      item.user?.username;
    const { title, artist } = cleanArtistAndTitle(item.title || 'Untitled', rawArtist);

    return {
      id: String(item.id),
      title,
      artist,
      album: item.publisher_metadata?.album_title || '',
      duration: formatDuration(durationSec),
      durationSec,
      source: 'SC',
      artworkUrl,
      sourceId: String(item.id),
    };
  });
}

export async function getArtistDetails(artistNameOrId: string) {
  let user: any = null;

  // Check if artistNameOrId is numeric user ID
  if (/^\d+$/.test(artistNameOrId)) {
    try {
      const uRes = await fetchSC(`https://api-v2.soundcloud.com/users/${artistNameOrId}`);
      if (uRes.ok) user = await uRes.json();
    } catch {}
  }

  if (!user) {
    try {
      const uSearch = await fetchSC('https://api-v2.soundcloud.com/search/users', {
        q: artistNameOrId,
        limit: 1,
      });
      if (uSearch.ok) {
        const uData = await uSearch.json();
        user = uData.collection?.[0];
      }
    } catch {}
  }

  // Fallback: search tracks to extract user profile
  if (!user) {
    try {
      const tSearch = await fetchSC('https://api-v2.soundcloud.com/search/tracks', {
        q: artistNameOrId,
        limit: 5,
      });
      if (tSearch.ok) {
        const tData = await tSearch.json();
        const candidate = tData.collection?.find((t: any) => t.user?.id);
        if (candidate) {
          user = candidate.user;
        }
      }
    } catch {}
  }

  if (!user) {
    return {
      artist: artistNameOrId,
      topTracks: [],
      albums: [],
      singles: [],
    };
  }

  const artistName = user.username || artistNameOrId;
  let avatarUrl: string | undefined = (user.avatar_url || '').replace('-large.', '-t500x500.');
  if (avatarUrl && avatarUrl.includes('default_avatar')) {
    avatarUrl = undefined;
  }
  const bio = user.description;
  const subscribers = user.followers_count ? `${user.followers_count.toLocaleString()} followers` : undefined;

  const [tracksRes, albumsRes] = await Promise.allSettled([
    fetchSC(`https://api-v2.soundcloud.com/users/${user.id}/tracks`, { limit: 100 }),
    fetchSC(`https://api-v2.soundcloud.com/users/${user.id}/albums`, { limit: 20 }),
  ]);

  const topTracks: SCSearchResult[] = [];
  if (tracksRes.status === 'fulfilled' && tracksRes.value.ok) {
    const tData: any = await tracksRes.value.json();
    for (const item of tData.collection || []) {
      if (item.policy === 'SNIP' || item.snipped === true) continue;
      const durSec = Math.round((item.duration || 0) / 1000);
      if (durSec <= 35 && item.full_duration > 60000) continue;

      const rawArt = item.artwork_url || item.user?.avatar_url || '';
      topTracks.push({
        id: String(item.id),
        title: item.title || 'Untitled',
        artist: item.user?.username || artistName,
        album: `${artistName} Top Tracks`,
        duration: formatDuration(durSec),
        durationSec: durSec,
        source: 'SC',
        artworkUrl: rawArt ? rawArt.replace('-large.', '-t500x500.') : avatarUrl,
        sourceId: String(item.id),
      });
    }
  }

  if (!avatarUrl && topTracks.length > 0 && topTracks[0].artworkUrl) {
    avatarUrl = topTracks[0].artworkUrl;
  }

  const albums: Array<{ title: string; year?: string; artworkUrl?: string; browseId?: string; type?: string }> = [];
  if (albumsRes.status === 'fulfilled' && albumsRes.value.ok) {
    const aData: any = await albumsRes.value.json();
    for (const item of aData.collection || []) {
      const rawArt = item.artwork_url || (item.tracks?.[0]?.artwork_url) || avatarUrl || topTracks[0]?.artworkUrl || '';
      albums.push({
        title: item.title || 'Album',
        year: item.release_date ? new Date(item.release_date).getFullYear().toString() : '',
        artworkUrl: rawArt ? rawArt.replace('-large.', '-t500x500.') : (avatarUrl || topTracks[0]?.artworkUrl),
        browseId: String(item.id),
        type: 'Album',
      });
    }
  }

  // Fallback: If no albums from user/albums, check topTracks
  if (albums.length === 0 && topTracks.length > 0) {
    const seenAlbums = new Set<string>();
    for (const t of topTracks) {
      if (t.album && !t.album.includes('Top Track') && !seenAlbums.has(t.album.toLowerCase())) {
        seenAlbums.add(t.album.toLowerCase());
        albums.push({
          title: t.album,
          year: '',
          artworkUrl: t.artworkUrl || avatarUrl,
          browseId: t.album,
          type: 'Album',
        });
      }
    }
  }

  return {
    artist: artistName,
    avatarUrl,
    bio,
    browseId: String(user.id),
    subscribers,
    topTracks,
    albums,
    singles: [],
  };
}

export async function getAlbum(playlistId: string) {
  let resolvedId = playlistId.trim();

  if (!/^\d+$/.test(resolvedId)) {
    try {
      const pSearch = await fetchSC('https://api-v2.soundcloud.com/search/albums', {
        q: resolvedId,
        limit: 1,
      });
      if (pSearch.ok) {
        const pData = await pSearch.json();
        const first = pData.collection?.[0];
        if (first?.id) {
          resolvedId = String(first.id);
        }
      }
    } catch (e) {
      console.warn('[scResolver] Album search error:', e);
    }
  }

  const res = await fetchSC(`https://api-v2.soundcloud.com/playlists/${resolvedId}`);
  if (!res.ok) throw new Error(`SoundCloud playlist failed: ${res.statusText}`);
  const data: any = await res.json();

  const title = data.title || 'Playlist';
  const artist = data.user?.username || 'Unknown Artist';
  const rawArt = data.artwork_url || (data.tracks?.[0]?.artwork_url) || '';
  const artworkUrl = rawArt ? rawArt.replace('-large.', '-t500x500.') : undefined;

  const validTracks = (data.tracks || []).filter((t: any) => {
    if (t.policy === 'SNIP' || t.snipped === true) return false;
    const durSec = Math.round((t.duration || 0) / 1000);
    if (durSec <= 35 && t.full_duration > 60000) return false;
    return true;
  });

  const tracks: SCSearchResult[] = validTracks.map((t: any) => {
    const durSec = Math.round((t.duration || 0) / 1000);
    const tArt = t.artwork_url || t.user?.avatar_url || '';
    return {
      id: String(t.id),
      title: t.title || 'Untitled',
      artist: t.user?.username || artist,
      album: title,
      duration: formatDuration(durSec),
      durationSec: durSec,
      source: 'SC' as const,
      artworkUrl: tArt ? tArt.replace('-large.', '-t500x500.') : artworkUrl,
      sourceId: String(t.id),
    };
  });

  return {
    title,
    artist,
    artworkUrl,
    browseId: playlistId,
    tracks,
  };
}

export async function getGenreTracks(genre: string): Promise<SCSearchResult[]> {
  const res = await fetchSC('https://api-v2.soundcloud.com/search/tracks', {
    q: genre,
    limit: 50,
  });
  if (!res.ok) return [];
  const data: any = await res.json();

  const collection: any[] = data.collection || [];
  const valid = collection.filter((item: any) => {
    if (item.policy === 'SNIP' || item.snipped === true) return false;
    const durSec = Math.round((item.duration || 0) / 1000);
    if (durSec <= 35 && (item.full_duration > 60000 || !item.full_duration)) return false;
    return true;
  });

  return valid.map((item: any) => {
    const durSec = Math.round((item.duration || 0) / 1000);
    const rawArtwork: string = item.artwork_url || item.user?.avatar_url || '';
    const artworkUrl = rawArtwork ? rawArtwork.replace('-large.', '-t500x500.') : undefined;

    const rawArtist =
      item.publisher_metadata?.artist ||
      item.publisher_metadata?.album_artist ||
      item.user?.username;
    const { title, artist } = cleanArtistAndTitle(item.title || 'Untitled', rawArtist);

    return {
      id: String(item.id),
      title,
      artist,
      album: item.publisher_metadata?.album_title || genre,
      duration: formatDuration(durSec),
      durationSec: durSec,
      source: 'SC' as const,
      artworkUrl,
      sourceId: String(item.id),
    };
  });
}

export default { resolve, search, getArtistDetails, getAlbum, getGenreTracks, getClientId, formatDuration, fetchSC };
