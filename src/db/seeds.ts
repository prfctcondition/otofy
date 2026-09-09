import db from './database';
import type { DbPlaylist } from './database';

export async function seedDatabaseIfEmpty(): Promise<void> {
  const existingPlaylists = await db.playlists.count();
  if (existingPlaylists > 0) return; // Already seeded

  console.log('[ZenMusic] Initializing clean library...');

  // Start with a clean slate: only the default "Liked Songs" playlist
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
