import type { MoodsAndGenresSection, Track, SearchResult } from '../types';

export interface SearchArtistItem {
  id?: string;
  name: string;
  avatarUrl?: string;
  thumbnailUrl?: string;
  subscribers?: string;
  genre?: string;
  browseId?: string;
}

function normalizeToTrack(raw: any, index: number = 0): Track {
  const source = raw.source || 'YT';
  return {
    id: raw.id || `track-${index}-${Date.now()}`,
    title: raw.title || 'Unknown Title',
    artist: raw.artist || 'Unknown Artist',
    album: raw.album || '',
    duration: raw.duration || '3:30',
    durationSec: raw.durationSec || 210,
    source,
    sourceLabel: raw.sourceLabel || (source === 'SC' ? 'SoundCloud' : 'YouTube'),
    sourceId: raw.sourceId || raw.id,
    artworkUrl: raw.artworkUrl || raw.thumbnail || '',
    streamUrl: raw.streamUrl,
    externalUrl: raw.externalUrl,
    number: raw.number || index + 1,
    dateAdded: raw.dateAdded || 'Recently',
    iconName: 'music',
    gradientFrom: raw.gradientFrom || 'from-neutral-800',
    gradientTo: raw.gradientTo || 'to-neutral-900',
  };
}

export async function apiGetMoodsAndGenres(lang: string = 'en'): Promise<MoodsAndGenresSection[]> {
  try {
    if (window.electronAPI?.getMoodsAndGenres) {
      const data = await window.electronAPI.getMoodsAndGenres(lang);
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.warn('[musicApiService] electron getMoodsAndGenres failed:', err);
  }

  try {
    const res = await fetch(`/api/music/moods-and-genres?lang=${encodeURIComponent(lang)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.warn('[musicApiService] fetch moods-and-genres failed:', err);
  }

  return [];
}

export async function apiGetGenreTracks(query: string): Promise<Track[]> {
  const cleanQ = query.trim();
  if (!cleanQ) return [];

  try {
    if (window.electronAPI?.getGenreTracks) {
      const data = await window.electronAPI.getGenreTracks(cleanQ);
      if (Array.isArray(data) && data.length > 0) {
        return data.map((t: any, idx: number) => normalizeToTrack(t, idx));
      }
    }
  } catch (err) {
    console.warn('[musicApiService] electron getGenreTracks failed:', err);
  }

  try {
    const res = await fetch(`/api/music/genre-tracks?query=${encodeURIComponent(cleanQ)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map((t: any, idx: number) => normalizeToTrack(t, idx));
      }
    }
  } catch (err) {
    console.warn('[musicApiService] fetch genre-tracks failed:', err);
  }

  // Fallback: search for genre mix tracks
  try {
    const searchResp = await apiSearchMusic(`${cleanQ} mix`, 'YT');
    if (searchResp.results && searchResp.results.length > 0) {
      return searchResp.results;
    }
  } catch {}

  return [];
}

export async function apiSearchMusic(
  query: string,
  source: 'YT' | 'SC' | 'ALL' = 'YT'
): Promise<{ results: Track[]; artistCard?: any }> {
  const cleanQ = query.trim();
  if (!cleanQ) return { results: [] };

  try {
    if (window.electronAPI?.searchMusic) {
      const data = await window.electronAPI.searchMusic(cleanQ, source);
      if (data && typeof data === 'object' && 'results' in data) {
        return {
          results: (data.results || []).map((t: any, idx: number) => normalizeToTrack(t, idx)),
          artistCard: data.artistCard,
        };
      }
      if (Array.isArray(data)) {
        return { results: data.map((t: any, idx: number) => normalizeToTrack(t, idx)) };
      }
    }
  } catch (err) {
    console.warn('[musicApiService] electron searchMusic failed:', err);
  }

  try {
    const res = await fetch(`/api/music/search?q=${encodeURIComponent(cleanQ)}&source=${source}`);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object' && 'results' in data) {
        return {
          results: (data.results || []).map((t: any, idx: number) => normalizeToTrack(t, idx)),
          artistCard: data.artistCard,
        };
      }
      if (Array.isArray(data)) {
        return { results: data.map((t: any, idx: number) => normalizeToTrack(t, idx)) };
      }
    }
  } catch (err) {
    console.warn('[musicApiService] fetch search failed:', err);
  }

  return { results: [] };
}

export async function apiGetRelatedTracks(
  trackId: string,
  source: 'YT' | 'SC' = 'YT',
  artist?: string,
  title?: string
): Promise<Track[]> {
  try {
    if (window.electronAPI?.getRelatedTracks) {
      const data = await window.electronAPI.getRelatedTracks(trackId, source, artist, title);
      if (Array.isArray(data) && data.length > 0) {
        return data.map((t: any, idx: number) => normalizeToTrack(t, idx));
      }
    }
  } catch (err) {
    console.warn('[musicApiService] electron getRelatedTracks failed:', err);
  }

  try {
    const res = await fetch(
      `/api/music/related-tracks?id=${encodeURIComponent(trackId)}&source=${source}&artist=${encodeURIComponent(artist || '')}&title=${encodeURIComponent(title || '')}`
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map((t: any, idx: number) => normalizeToTrack(t, idx));
      }
    }
  } catch (err) {
    console.warn('[musicApiService] fetch related-tracks failed:', err);
  }

  return [];
}

export async function apiSearchArtists(query: string): Promise<SearchArtistItem[]> {
  const cleanQ = query.trim();
  if (!cleanQ) return [];

  try {
    if (window.electronAPI?.searchArtists) {
      const data = await window.electronAPI.searchArtists(cleanQ);
      if (Array.isArray(data) && data.length > 0) {
        return data.map((item) => ({
          ...item,
          thumbnailUrl: item.avatarUrl,
        }));
      }
    }
  } catch (err) {
    console.warn('[musicApiService] electron searchArtists failed:', err);
  }

  try {
    const res = await fetch(`/api/music/search-artists?q=${encodeURIComponent(cleanQ)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map((item) => ({
          ...item,
          thumbnailUrl: item.avatarUrl,
        }));
      }
    }
  } catch (err) {
    console.warn('[musicApiService] fetch search-artists failed:', err);
  }

  // Fallback: search general music and extract artists
  try {
    const sResp = await apiSearchMusic(cleanQ, 'YT');
    const artists: SearchArtistItem[] = [];
    if (sResp.artistCard) {
      artists.push({
        name: sResp.artistCard.name,
        avatarUrl: sResp.artistCard.avatarUrl,
        thumbnailUrl: sResp.artistCard.avatarUrl,
        subscribers: sResp.artistCard.subtitle,
        genre: 'Artist',
      });
    }
    const seenNames = new Set<string>(artists.map((a) => a.name.toLowerCase()));
    for (const track of sResp.results) {
      if (track.artist && !seenNames.has(track.artist.toLowerCase())) {
        seenNames.add(track.artist.toLowerCase());
        artists.push({
          name: track.artist,
          avatarUrl: track.artworkUrl,
          thumbnailUrl: track.artworkUrl,
          subscribers: 'Artist',
          genre: 'Artist',
        });
      }
      if (artists.length >= 8) break;
    }
    return artists;
  } catch {}

  return [];
}
