import innertubeService from './innertubeService.js';
import scResolver from './scResolver.js';
import { cleanArtistAndTitle } from './trackParser.js';

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
}

export interface UnifiedSearchResponse {
  artistCard?: {
    name: string;
    avatarUrl?: string;
    subtitle?: string;
    browseId?: string;
    source?: 'YT' | 'SC';
  };
  results: SearchResult[];
}

async function searchAll(query: string, sourceFilter: 'ALL' | 'YT' | 'SC' = 'ALL'): Promise<UnifiedSearchResponse> {
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
      artistCard = {
        ...ytRes.value.artistCard,
        source: 'YT',
      };
    }
    results.push(...ytRes.value.songs);
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

    return {
    artistCard,
    results: cleanedResults,
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
