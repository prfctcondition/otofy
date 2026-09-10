import innertubeService, { extractThumbnailUrl, parseDurationToSec } from './innertubeService.js';
import { cleanArtistAndTitle } from './trackParser.js';

export interface SpotifyTrackItem {
  title: string;
  artist: string;
  artists?: string[];
  durationMs: number;
  durationSec: number;
  previewUrl?: string;
  uri?: string;
}

export interface SpotifyPlaylistDetails {
  id: string;
  title: string;
  creator: string;
  artworkUrl?: string;
  trackCount: number;
  tracks: SpotifyTrackItem[];
}

export interface MatchedTrackResult {
  id: string;
  number: number;
  title: string;
  artist: string;
  artists?: string[];
  album: string;
  duration: string;
  durationSec: number;
  dateAdded: string;
  source: 'YT';
  sourceLabel: string;
  sourceId?: string;
  artworkUrl?: string;
  thumbnail?: string;
  iconName: string;
  gradientFrom: string;
  gradientTo: string;
  unresolved?: boolean;
  needsMatch?: boolean;
  alternatives?: Array<{
    id: string;
    title: string;
    artist: string;
    artists?: string[];
    duration: string;
    durationSec: number;
    sourceId: string;
    artworkUrl?: string;
    thumbnail?: string;
  }>;
  originalSpotifyPreview?: string;
}

export function parseSpotifyPlaylistId(input: string): string | null {
  if (!input || typeof input !== 'string') return null;
  const clean = input.trim();

  // Match https://open.spotify.com/playlist/{id}
  const urlMatch = clean.match(/open\.spotify\.com\/(?:embed\/)?playlist\/([a-zA-Z0-9]+)/i);
  if (urlMatch && urlMatch[1]) return urlMatch[1];

  // Match spotify:playlist:{id}
  const uriMatch = clean.match(/spotify:playlist:([a-zA-Z0-9]+)/i);
  if (uriMatch && uriMatch[1]) return uriMatch[1];

  // Match raw 22-char ID
  if (/^[a-zA-Z0-9]{22}$/.test(clean)) return clean;

  return null;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export async function inspectSpotifyPlaylist(urlOrId: string): Promise<SpotifyPlaylistDetails> {
  const playlistId = parseSpotifyPlaylistId(urlOrId);
  if (!playlistId) {
    throw new Error('Invalid Spotify playlist URL or ID.');
  }

  const embedUrl = `https://open.spotify.com/embed/playlist/${playlistId}`;
  const response = await fetch(embedUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load Spotify playlist embed (${response.status} ${response.statusText})`);
  }

  const html = await response.text();
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!nextDataMatch || !nextDataMatch[1]) {
    throw new Error('Could not parse Spotify playlist data.');
  }

  const data = JSON.parse(nextDataMatch[1]);
  const entity = data.props?.pageProps?.state?.data?.entity;
  if (!entity) {
    throw new Error('Spotify playlist not found or private.');
  }

  const title = entity.title || entity.name || 'Spotify Playlist';
  const creator = entity.subtitle || entity.authors?.[0]?.name || 'Spotify';
  const artworkUrl =
    entity.coverArt?.sources?.[0]?.url ||
    entity.visualIdentity?.image?.[2]?.url ||
    entity.visualIdentity?.image?.[1]?.url ||
    entity.visualIdentity?.image?.[0]?.url;

  const rawTracks: any[] = entity.trackList || [];
  const tracks: SpotifyTrackItem[] = rawTracks.map((t: any) => {
    const dMs = t.duration || 0;
    const durSec = Math.round(dMs / 1000);
    const rawA = t.subtitle || (Array.isArray(t.artists) ? t.artists.map((a: any) => a.name).join(', ') : '');
    const artistsList = Array.isArray(t.artists) && t.artists.length > 0
      ? t.artists.map((a: any) => (typeof a === 'string' ? a : a.name)).filter(Boolean)
      : (t.subtitle ? [t.subtitle] : ['Unknown Artist']);

    // Spotify metadata is clean and official: preserve title and artist as-is
    return {
      title: t.title || 'Untitled',
      artist: rawA || 'Unknown Artist',
      artists: artistsList,
      durationMs: dMs,
      durationSec: durSec,
      previewUrl: t.audioPreview?.url,
      uri: t.uri,
    };
  });

  return {
    id: playlistId,
    title,
    creator,
    artworkUrl,
    trackCount: tracks.length,
    tracks,
  };
}

export async function matchSpotifyTracks(
  tracks: SpotifyTrackItem[],
  playlistTitle: string,
  onProgress?: (data: {
    current: number;
    total: number;
    matched: number;
    unresolved: number;
    currentTrackTitle: string;
  }) => void
): Promise<MatchedTrackResult[]> {
  const yt = await innertubeService.getInnertube();
  const results: MatchedTrackResult[] = [];
  let matched = 0;
  let unresolved = 0;
  const CONCURRENCY = 4;

  for (let i = 0; i < tracks.length; i += CONCURRENCY) {
    const chunk = tracks.slice(i, i + CONCURRENCY);

    const chunkPromises = chunk.map(async (spTrack, chunkIndex) => {
      const globalIndex = i + chunkIndex;
      const query = `${spTrack.artist} - ${spTrack.title}`;
      let candidates: Array<{
        id: string;
        title: string;
        artist: string;
        artists?: string[];
        duration: string;
        durationSec: number;
        sourceId: string;
        artworkUrl?: string;
        thumbnail?: string;
      }> = [];

      try {
        const searchRes = await yt.music.search(query, { type: 'song' });
        const shelf = searchRes.contents?.[0];
        const items: any[] = shelf && 'contents' in shelf ? (shelf.contents as any[]) : [];

        for (const item of items.slice(0, 5)) {
          const vId = item.id;
          if (!vId) continue;

          // Priority 2: Structured metadata from YouTube Music API
          let candTitle = typeof item.title === 'string' ? item.title : item.title?.text || 'Untitled';
          let candArtist = '';
          let candArtists: string[] = [];
          if (Array.isArray(item.artists) && item.artists.length > 0) {
            candArtists = item.artists.map((a: any) => (typeof a === 'string' ? a : a.name)).filter(Boolean);
            candArtist = candArtists.join(', ');
          } else if (item.author?.name) {
            candArtist = item.author.name.replace(/\s*-\s*topic$/i, '').trim();
            candArtists = [candArtist];
          } else {
            candArtist = spTrack.artist;
            candArtists = spTrack.artists || [spTrack.artist];
          }

          // Strip pure video junk tags from candidate title without removing music version suffixes
          candTitle = candTitle
            .replace(/\[\s*(copyright\s*free|no\s*copyright|ncs(\s*release)?|free(\s*download)?|official\s*(music\s*)?video|official\s*audio|lyrics|hd|4k|hq|audio|visualizer)\s*\]/gi, '')
            .replace(/\(\s*(copyright\s*free|no\s*copyright|ncs(\s*release)?|free(\s*download)?|official\s*(music\s*)?video|official\s*audio|lyrics|hd|4k|hq|audio|visualizer)\s*\)/gi, '')
            .replace(/\s+/g, ' ')
            .trim();

          // If candTitle begins with redundant "candArtist - ", remove the prefix
          if (candArtist) {
            const prefixRegex = new RegExp(`^${candArtist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[-–—]\\s*`, 'i');
            candTitle = candTitle.replace(prefixRegex, '').trim();
          }

          const durStr = item.duration?.text || '0:00';
          const durSec = parseDurationToSec(durStr);
          const artwork = extractThumbnailUrl(item.thumbnails || item.thumbnail);

          candidates.push({
            id: `yt-${vId}`,
            title: candTitle,
            artist: candArtist,
            artists: candArtists,
            duration: durStr,
            durationSec: durSec,
            sourceId: vId,
            artworkUrl: artwork || `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
            thumbnail: artwork || `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
          });
        }
      } catch (err) {
        console.warn(`[SpotifyService] YouTube Music search failed for "${query}":`, err);
      }

      // Sort candidates by duration proximity to original Spotify duration
      candidates.sort((a, b) => {
        const diffA = Math.abs(a.durationSec - spTrack.durationSec);
        const diffB = Math.abs(b.durationSec - spTrack.durationSec);
        return diffA - diffB;
      });

      const bestCandidate = candidates[0];
      const durationDiff = bestCandidate ? Math.abs(bestCandidate.durationSec - spTrack.durationSec) : 999;
      const isConfirmed = Boolean(bestCandidate && durationDiff <= 10);

      // Priority 3: Keep pristine Spotify title and artist when auto-matched!
      const trackItem: MatchedTrackResult = {
        id: isConfirmed ? `yt-${bestCandidate.sourceId}` : `sp-${Date.now()}-${globalIndex}-${Math.random().toString(36).slice(2, 6)}`,
        number: globalIndex + 1,
        title: spTrack.title,
        artist: spTrack.artist,
        artists: spTrack.artists || [spTrack.artist],
        album: playlistTitle || 'Spotify Import',
        duration: isConfirmed ? bestCandidate.duration : formatDuration(spTrack.durationSec),
        durationSec: isConfirmed ? bestCandidate.durationSec : spTrack.durationSec,
        dateAdded: new Date().toISOString(),
        source: 'YT',
        sourceLabel: 'YouTube Music',
        sourceId: isConfirmed ? bestCandidate.sourceId : bestCandidate?.sourceId,
        artworkUrl: bestCandidate?.artworkUrl,
        thumbnail: bestCandidate?.artworkUrl,
        iconName: 'music',
        gradientFrom: '#1E293B',
        gradientTo: '#0F172A',
        unresolved: !isConfirmed,
        needsMatch: !isConfirmed,
        alternatives: candidates.slice(0, 3),
        originalSpotifyPreview: spTrack.previewUrl,
      };

      return { trackItem, isConfirmed };
    });

    const chunkResults = await Promise.all(chunkPromises);

    for (const res of chunkResults) {
      if (res.isConfirmed) {
        matched++;
      } else {
        unresolved++;
      }
      results.push(res.trackItem);

      if (onProgress) {
        onProgress({
          current: results.length,
          total: tracks.length,
          matched,
          unresolved,
          currentTrackTitle: res.trackItem.title,
        });
      }
    }

    // Gentle rate limit pause between batches to protect against YouTube WAF / bot challenges
    if (i + CONCURRENCY < tracks.length) {
      await new Promise((resolve) => setTimeout(resolve, 220));
    }
  }

  return results;
}

export default {
  parseSpotifyPlaylistId,
  inspectSpotifyPlaylist,
  matchSpotifyTracks,
};
