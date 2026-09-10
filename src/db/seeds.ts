import db from './database';
import type { DbPlaylist } from './database';

export async function seedDatabaseIfEmpty(): Promise<void> {
  const downloadsExists = await db.playlists.get('pl-downloads');
  if (!downloadsExists) {
    await db.playlists.put({
      id: 'pl-downloads',
      title: 'Downloads',
      type: 'Playlist',
      creator: 'System',
      songCount: 0,
      duration: '0m',
      isPinned: true,
      iconName: 'download',
      gradientFrom: '#10B981',
      gradientTo: '#059669',
      isDailyMix: false,
      description: 'Tracks downloaded to your local device for offline listening.',
      updatedAt: Date.now(),
    });
  }

  const existingPlaylists = await db.playlists.count();
  if (existingPlaylists > 1) return; // Already seeded

  console.log('[ZenMusic] Initializing clean library...');

  // Start with a clean slate: Liked Songs playlist
  const initialPlaylist: DbPlaylist = {
    id: 'pl-liked',
    title: 'Liked Songs',
    type: 'Playlist',
    creator: 'You',
    songCount: 0,
    duration: '0m',
    isPinned: true,
    iconName: 'heart',
    gradientFrom: '#4F46E5',
    gradientTo: '#9333EA',
    isDailyMix: false,
    description: 'Your personal collection of saved and favorite songs.',
    updatedAt: Date.now(),
  };

  await db.playlists.put(initialPlaylist);
  console.log('[ZenMusic] Clean library initialized.');
}
