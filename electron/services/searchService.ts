import innertubeService, { parseSubscriberCount } from './innertubeService.js';
import scResolver from './scResolver.js';
import { cleanArtistAndTitle } from './trackParser.js';
import { detectMusicUrl } from './urlDetector.js';

export interface SearchResult {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: string;
  durationSec: number;
  source: 'YT' | 'SC';
  sourceLabel: string;
  artworkUrl?: string;
  sourceId: string;
  releaseDate?: string;
  releaseYear?: string;
  artistBrowseId?: string;
  artistUrl?: string;
  albumBrowseId?: string;
  externalUrl?: string;
  views?: number;
  playbackCount?: number;
}

export interface UnifiedSearchResponse {
  artistCard?: {
    name: string;
    avatarUrl?: string;
    subtitle?: string;
    browseId?: string;
    externalUrl?: string;
    source?: 'YT' | 'SC';
  };
  results: SearchResult[];
}

async function searchAll(query: string, sourceFilter: 'ALL' | 'YT' | 'SC' = 'ALL'): Promise<UnifiedSearchResponse> {
  // 0. Direct URL Detection & Resolution (bypasses fuzzy text search)
  const detected = detectMusicUrl(query);
  if (detected) {
    // 0a. YouTube Channel / Handle
    if (detected.type === 'yt_channel' || detected.type === 'yt_handle') {
      try {
        const targetId = detected.type === 'yt_channel' ? detected.channelId : detected.handle;
        const artistDetails = await innertubeService.getArtist(targetId);
        if (artistDetails) {
          const artistCard: UnifiedSearchResponse['artistCard'] = {
            name: artistDetails.artist,
            avatarUrl: artistDetails.avatarUrl,
            subtitle: artistDetails.subscribers || 'Official YouTube Channel',
            browseId: artistDetails.channelId || artistDetails.browseId,
            externalUrl: artistDetails.externalUrl || detected.rawUrl,
            source: 'YT',
          };
          const results: SearchResult[] = (artistDetails.topTracks || []).map((t) => ({
            ...t,
            source: 'YT' as const,
            sourceLabel: 'YouTube Music',
          }));
          return { artistCard, results };
        }
      } catch (err) {
        console.warn('[searchService] Direct YT channel resolution failed:', err);
      }
    }

    // 0b. YouTube Playlist / Album
    if (detected.type === 'yt_playlist') {
      try {
        const albumDetails = await innertubeService.getAlbum(detected.playlistId);
        if (albumDetails && albumDetails.tracks.length > 0) {
          const results: SearchResult[] = albumDetails.tracks.map((t) => ({
            ...t,
            source: 'YT' as const,
            sourceLabel: 'YouTube Music',
          }));
          const artistCard: UnifiedSearchResponse['artistCard'] = {
            name: albumDetails.title,
            avatarUrl: albumDetails.artworkUrl,
            subtitle: `${albumDetails.artist} • Album / Playlist (${results.length} songs)`,
            browseId: albumDetails.browseId,
            externalUrl: albumDetails.externalUrl || detected.rawUrl,
            source: 'YT',
          };
          return { artistCard, results };
        }
      } catch (err) {
        console.warn('[searchService] Direct YT playlist resolution failed:', err);
      }
    }

    // 0c. YouTube Track / Video
    if (detected.type === 'yt_track') {
      try {
        const yt = await innertubeService.getInnertube();
        const info = await yt.getInfo(detected.videoId);
        if (info && info.basic_info) {
          const b = info.basic_info;
          const durSec = b.duration || 0;
          const mins = Math.floor(durSec / 60);
          const secs = durSec % 60;
          const durStr = `${mins}:${secs.toString().padStart(2, '0')}`;
          const rawArt = b.thumbnail?.[0]?.url || `https://i.ytimg.com/vi/${detected.videoId}/hqdefault.jpg`;
          const rawArtist = b.author || '';
          const { title, artist } = cleanArtistAndTitle(b.title || 'Untitled', rawArtist);

          const trackResult: SearchResult = {
            id: detected.videoId,
            title,
            artist: artist || rawArtist,
            album: `${artist || rawArtist} Single`,
            duration: durStr,
            durationSec: durSec,
            source: 'YT',
            sourceLabel: 'YouTube Music',
            artworkUrl: rawArt,
            sourceId: detected.videoId,
            externalUrl: `https://music.youtube.com/watch?v=${detected.videoId}`,
            artistBrowseId: b.channel_id,
            artistUrl: b.channel_id ? `https://music.youtube.com/channel/${b.channel_id}` : undefined,
          };
          return { results: [trackResult] };
        }
      } catch (err) {
        console.warn('[searchService] Direct YT track resolution failed:', err);
      }
    }

    // 0d. SoundCloud URL (User, Playlist, or Track)
    if (detected.type === 'sc_url') {
      try {
        const resolved = await scResolver.resolveUrl(detected.scUrl);
        if (resolved) {
          // User / Artist
          if (resolved.kind === 'user' || (resolved.username && !resolved.title)) {
            const userDetails = await scResolver.getArtistDetails(String(resolved.id));
            if (userDetails) {
              const artistCard: UnifiedSearchResponse['artistCard'] = {
                name: userDetails.artist,
                avatarUrl: userDetails.avatarUrl,
                subtitle: userDetails.subscribers || 'SoundCloud Artist',
                browseId: userDetails.browseId,
                externalUrl: userDetails.externalUrl || detected.scUrl,
                source: 'SC',
              };
              const results: SearchResult[] = userDetails.topTracks.map((t) => ({
                ...t,
                source: 'SC' as const,
                sourceLabel: 'SoundCloud',
              }));
              return { artistCard, results };
            }
          }

          // Playlist / Album
          if (resolved.kind === 'playlist' || Array.isArray(resolved.tracks)) {
            const albumData = await scResolver.getAlbum(String(resolved.id));
            if (albumData) {
              const artistCard: UnifiedSearchResponse['artistCard'] = {
                name: albumData.title,
                avatarUrl: albumData.artworkUrl,
                subtitle: `${albumData.artist} • SoundCloud Album (${albumData.tracks.length} tracks)`,
                browseId: albumData.browseId,
                externalUrl: albumData.externalUrl || detected.scUrl,
                source: 'SC',
              };
              const results: SearchResult[] = albumData.tracks.map((t) => ({
                ...t,
                source: 'SC' as const,
                sourceLabel: 'SoundCloud',
              }));
              return { artistCard, results };
            }
          }

          // Track
          if (resolved.kind === 'track' || (resolved.id && resolved.duration)) {
            const durSec = Math.round((resolved.duration || 0) / 1000);
            const rawArt = resolved.artwork_url || resolved.user?.avatar_url || '';
            const rawArtist =
              resolved.publisher_metadata?.artist ||
              resolved.publisher_metadata?.album_artist ||
              resolved.user?.username ||
              '';
            const { title, artist } = cleanArtistAndTitle(resolved.title || 'Untitled', rawArtist);

            const singleTrack: SearchResult = {
              id: String(resolved.id),
              title,
              artist,
              album: resolved.publisher_metadata?.album_title || '',
              duration: scResolver.formatDuration(durSec),
              durationSec: durSec,
              source: 'SC',
              sourceLabel: 'SoundCloud',
              artworkUrl: rawArt ? rawArt.replace('-large.', '-t500x500.') : undefined,
              sourceId: String(resolved.id),
              releaseDate: resolved.release_date || resolved.created_at,
              releaseYear: resolved.release_date ? new Date(resolved.release_date).getFullYear().toString() : undefined,
              artistBrowseId: resolved.user?.id ? String(resolved.user.id) : undefined,
              artistUrl: resolved.user?.permalink_url,
              externalUrl: resolved.permalink_url || detected.scUrl,
            };
            return { results: [singleTrack] };
          }
        }
      } catch (err) {
        console.warn('[searchService] Direct SC URL resolution failed:', err);
      }
    }

    // 0e. Spotify Link
    if (detected.type === 'spotify_entity') {
      try {
        const oembedRes = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(detected.rawUrl)}`);
        if (oembedRes.ok) {
          const oembedData: any = await oembedRes.json();
          const entityTitle = oembedData.title || '';
          if (entityTitle) {
            const queryClean = entityTitle.replace(/\s*-\s*song and lyrics by.*$/i, '').trim();
            if (queryClean) {
              return await searchAll(queryClean, sourceFilter);
            }
          }
        }
      } catch (err) {
        console.warn('[searchService] Spotify oembed resolution failed:', err);
      }
    }
  }

  const shouldSearchYT = sourceFilter === 'ALL' || sourceFilter === 'YT';
  const shouldSearchSC = sourceFilter === 'ALL' || sourceFilter === 'SC';

  const [ytRes, scRes] = await Promise.allSettled([
    shouldSearchYT ? innertubeService.search(query) : Promise.resolve(null),
    shouldSearchSC ? scResolver.search(query) : Promise.resolve(null),
  ]);

  const results: SearchResult[] = [];
  let artistCard: UnifiedSearchResponse['artistCard'] | undefined;

  if (ytRes.status === 'fulfilled' && ytRes.value) {
    if (ytRes.value.artistCard) {
      const bId = ytRes.value.artistCard.browseId;
      artistCard = {
        ...ytRes.value.artistCard,
        source: 'YT',
        externalUrl: bId && bId.startsWith('UC') ? `https://music.youtube.com/channel/${bId}` : ytRes.value.artistCard.externalUrl,
      };
    }
    results.push(...ytRes.value.songs);
  }

  // If no artistCard returned from YouTube search, try scoped artist resolution
  if (!artistCard && shouldSearchYT && query.trim().length >= 2) {
    try {
      const aDetails = await innertubeService.getArtist(query);
      if (aDetails && (aDetails.topTracks.length > 0 || aDetails.albums.length > 0) && aDetails.channelId?.startsWith('UC')) {
        const subs = parseSubscriberCount(aDetails.subscribers);
        if (subs >= 25_000 || aDetails.artist.toLowerCase().trim() === query.trim().toLowerCase()) {
          artistCard = {
            name: aDetails.artist,
            avatarUrl: aDetails.avatarUrl,
            subtitle: aDetails.subscribers || 'Official Artist',
            browseId: aDetails.channelId,
            source: 'YT',
            externalUrl: `https://music.youtube.com/channel/${aDetails.channelId}`,
          };
        }
      }
    } catch {}
  }

  if (scRes.status === 'fulfilled' && scRes.value) {
    results.push(...(scRes.value as any[]).map((r: any) => ({
      ...r,
      sourceLabel: 'SoundCloud',
    })));

    // If no artistCard from YouTube, try to find SoundCloud artist
    if (!artistCard && shouldSearchSC) {
      try {
        const scArtist = await scResolver.getArtistDetails(query);
        if (scArtist && scArtist.topTracks.length > 0) {
          artistCard = {
            name: scArtist.artist,
            avatarUrl: scArtist.avatarUrl,
            subtitle: scArtist.subscribers || 'SoundCloud Artist',
            browseId: scArtist.browseId,
            source: 'SC',
            externalUrl: scArtist.externalUrl,
          };
        }
      } catch {}
    }
  }

  // Strictly prioritize YouTube Music first, followed by SoundCloud
  const yt = results.filter((r) => r.source === 'YT');
  const sc = results.filter((r) => r.source === 'SC');

  const orderedResults = sourceFilter === 'SC' ? sc : sourceFilter === 'YT' ? yt : [...yt, ...sc];

  const cleanedResults = orderedResults.map((r) => {
    const { title, artist } = cleanArtistAndTitle(r.title, r.artist);
    return {
      ...r,
      title,
      artist,
    };
  });

  const cleanQ = query.trim().toLowerCase();

  // If we have an artistCard, check whether an overshadowing viral track exists BEFORE scoring!
  // ONLY obscure artists (< 25k subscribers) can be overshadowed by a viral track with the same name.
  // Established artists (>= 25k subscribers, like BONES or Michael Jackson) must NEVER be suppressed!
  if (artistCard) {
    const artistSubs = parseSubscriberCount(artistCard.subtitle);
    const isObscureArtist = artistSubs < 25_000;
    if (isObscureArtist) {
      const viralTrack = cleanedResults.find((t) => {
        const tTitle = (t.title || '').toLowerCase().trim();
        const tViews = t.views || t.playbackCount || 0;
        const matches = tTitle === cleanQ || tTitle.startsWith(cleanQ);
        return matches && tViews >= 1_000_000 && (artistSubs < 10_000 || tViews > artistSubs * 20);
      });
      if (viralTrack) {
        artistCard = undefined;
      }
    }
  }

  const hasConfirmedArtist = Boolean(
    artistCard &&
    (artistCard.name.toLowerCase().trim() === cleanQ ||
     cleanQ === artistCard.name.toLowerCase().trim().replace(/[^a-z0-9]/g, ''))
  );

  // Weighted scoring for each track in search results
  const scoredResults = cleanedResults.map((track, originalIndex) => {
    let score = 0;
    const tTitle = (track.title || '').toLowerCase().trim();
    const tArtist = (track.artist || '').toLowerCase().trim();
    const views = track.views || track.playbackCount || 0;

    // If an established official artist matches the query, songs BY this artist take supreme priority!
    if (hasConfirmedArtist) {
      if (tArtist === cleanQ) {
        score += 2_000_000_000;
      } else if (tArtist.startsWith(cleanQ)) {
        score += 800_000_000;
      } else if (tArtist.includes(cleanQ)) {
        score += 400_000_000;
      }
    }

    // Exact title match: massive priority
    if (tTitle === cleanQ) {
      score += 1_000_000_000;
    } else if (tTitle.startsWith(cleanQ)) {
      score += 500_000_000;
    } else if (tTitle.includes(cleanQ)) {
      score += 100_000_000;
    }

    // Exact word match bonus (e.g. "Ark" as a standalone word)
    const escapedQ = cleanQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const wordBoundary = new RegExp(`(^|\\s|[-_\\[(])${escapedQ}($|\\s|[-_\\])])`, 'i');
    if (wordBoundary.test(tTitle)) {
      score += 80_000_000;
    }

    // General artist match (when not already boosted by hasConfirmedArtist)
    if (!hasConfirmedArtist) {
      if (tArtist === cleanQ) {
        score += 200_000_000;
      } else if (tArtist.startsWith(cleanQ)) {
        score += 50_000_000;
      } else if (tArtist.includes(cleanQ)) {
        score += 20_000_000;
      }
    }

    // Popularity scaling: log scale + raw count bonus
    if (views > 0) {
      score += Math.round(Math.log10(views + 1) * 20_000_000);
      score += Math.min(views, 200_000_000);
    }

    // Source weighting: slight priority to YT when scores are close
    if (track.source === 'YT') {
      score += 5_000_000;
    }

    // Preserve relative order for identical scores
    score -= originalIndex * 10;

    return { track, score };
  });

  scoredResults.sort((a, b) => b.score - a.score);
  const finalResults = scoredResults.map((s) => s.track);

  return {
    artistCard,
    results: finalResults,
  };
}

export interface SearchPlaylistResult {
  id: string;
  title: string;
  creator: string;
  songCount?: number;
  artworkUrl?: string;
  source: 'YT' | 'SC';
  sourceLabel: string;
}

async function searchPlaylists(
  query: string,
  sourceFilter: 'ALL' | 'YT' | 'SC' = 'ALL'
): Promise<SearchPlaylistResult[]> {
  const shouldSearchYT = sourceFilter === 'ALL' || sourceFilter === 'YT';
  const shouldSearchSC = sourceFilter === 'ALL' || sourceFilter === 'SC';

  const [ytRes, scRes] = await Promise.allSettled([
    shouldSearchYT ? innertubeService.searchPlaylists(query) : Promise.resolve([]),
    shouldSearchSC ? scResolver.searchPlaylists(query) : Promise.resolve([]),
  ]);

  const yt = ytRes.status === 'fulfilled' ? ytRes.value : [];
  const sc = scRes.status === 'fulfilled' ? scRes.value : [];

  if (sourceFilter === 'SC') return sc;
  if (sourceFilter === 'YT') return yt;
  return [...yt, ...sc];
}

export default { searchAll, searchPlaylists };
