import React, { useEffect, useState } from 'react';
import { ListMusic, X, Play, Trash2, Music, Volume2, FolderPlus, Plus } from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';
import { useLibraryStore } from '../store/libraryStore';
import { useContextMenuStore } from '../store/contextMenuStore';
import { useToastStore } from '../store/toastStore';
import type { Track } from '../types';
import { PlaceholderArtwork } from './PlaceholderArtwork';

interface QueueModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QueueModal: React.FC<QueueModalProps> = ({ isOpen, onClose }) => {
  const createPlaylistFromTracks = useLibraryStore((state) => state.createPlaylistFromTracks);
  const playlists = useLibraryStore((state) => state.playlists);
  const addTrackToPlaylist = useLibraryStore((state) => state.addTrackToPlaylist);
  const openCreatePlaylistModal = useLibraryStore((state) => state.openCreatePlaylistModal);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [isAddQueueOpen, setIsAddQueueOpen] = useState(false);

  const userPlaylists = React.useMemo(() => {
    return playlists.filter((p) => p.type === 'Playlist' && p.creator !== 'System');
  }, [playlists]);

  const handleAddTrackToPlaylist = async (playlistId: string, track: Track) => {
    await addTrackToPlaylist(playlistId, track);
    setOpenDropdownId(null);
    const target = playlists.find((p) => p.id === playlistId);
    useToastStore.getState().success('Track added', `Added "${track.title}" to ${target?.title || 'playlist'}`);
  };

  const handleAddAllQueueToPlaylist = async (playlistId: string) => {
    if (queue.length === 0) return;
    const target = playlists.find((p) => p.id === playlistId);
    let addedCount = 0;
    for (const track of queue) {
      const added = await addTrackToPlaylist(playlistId, track);
      if (added !== false) {
        addedCount++;
      }
    }
    setIsAddQueueOpen(false);
    useToastStore
      .getState()
      .success(
        'Queue Added',
        `Added ${addedCount} ${addedCount === 1 ? 'track' : 'tracks'} to "${target?.title || 'playlist'}"`
      );
  };

  const handleCreateNewPlaylistFromQueue = () => {
    setIsAddQueueOpen(false);
    onClose();
    openCreatePlaylistModal(queue);
  };
  const {
    queue,
    queueIndex,
    activeTrack,
    isPlaying,
    jumpToQueueIndex,
    removeFromQueue,
    clearQueue,
  } = usePlayerStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentPlaying = activeTrack || queue[queueIndex];
  const upcomingTracks = queue.slice(queueIndex + 1);

  const handleSaveAsPlaylist = async () => {
    if (queue.length === 0) return;
    const dateStr = new Date().toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
    const defaultTitle = `Queue Mix · ${dateStr}`;
    const newPl = await createPlaylistFromTracks(defaultTitle, queue);
    onClose();
    useContextMenuStore.getState().openEditPlaylist(newPl);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-black/85 backdrop-blur-md animate-in fade-in duration-150 p-4 select-none"
      onClick={() => {
        setOpenDropdownId(null);
        setIsAddQueueOpen(false);
        onClose();
      }}
    >
      <div
        className="bg-white/95 dark:bg-black backdrop-blur-3xl border border-white dark:border-white/10 rounded-3xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden relative shadow-[0_25px_60px_rgba(0,0,0,0.22),inset_0_1px_2px_#FFFFFF] dark:shadow-[0_25px_60px_rgba(0,0,0,0.9)]"
        onClick={() => {
          setOpenDropdownId(null);
          setIsAddQueueOpen(false);
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-black/[0.06] dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#0F172A] dark:bg-white text-white dark:text-black flex items-center justify-center shadow-md">
              <ListMusic size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#0F172A] dark:text-white leading-tight">Play Queue</h2>
              <p className="text-xs text-[#64748B] dark:text-white/60">
                {queue.length} {queue.length === 1 ? 'song' : 'songs'} in active queue
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {queue.length > 0 && (
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenDropdownId(null);
                    setIsAddQueueOpen((prev) => !prev);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#0F172A] hover:bg-black dark:bg-white dark:hover:bg-white/90 text-white dark:text-black shadow-xs hover:shadow transition-all cursor-pointer"
                  title="Add all queue tracks to a playlist"
                >
                  <FolderPlus size={14} />
                  <span>Add to playlist</span>
                </button>

                {isAddQueueOpen && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 top-full mt-2 w-64 max-h-72 overflow-y-auto py-2 rounded-2xl bg-white dark:bg-black border border-slate-200 dark:border-white/10 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100 custom-scrollbar"
                  >
                    <div className="px-3.5 pb-1.5 mb-1 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-white/50">
                        Add Queue ({queue.length})
                      </span>
                    </div>

                    <button
                      onClick={() => handleCreateNewPlaylistFromQueue()}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-xs font-bold text-[#0F172A] dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <div className="w-6 h-6 rounded-lg bg-[#0F172A]/5 dark:bg-white/10 flex items-center justify-center shrink-0">
                        <Plus size={14} className="text-[#0F172A] dark:text-white" />
                      </div>
                      <span className="truncate">Create new playlist</span>
                    </button>

                    <div className="my-1.5 border-t border-slate-100 dark:border-white/10" />

                    <div className="px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-white/40">
                      Existing Playlists
                    </div>

                    {userPlaylists.length === 0 ? (
                      <div className="px-3.5 py-2 text-xs text-slate-400 dark:text-white/40 italic">
                        No playlists created yet
                      </div>
                    ) : (
                      userPlaylists.map((pl) => (
                        <button
                          key={pl.id}
                          onClick={() => handleAddAllQueueToPlaylist(pl.id)}
                          className="w-full flex items-center justify-between px-3.5 py-2 text-left text-xs font-semibold text-[#0F172A] dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                        >
                          <span className="truncate pr-2">{pl.title}</span>
                          <span className="text-[10px] text-slate-400 dark:text-white/40 shrink-0 font-normal">
                            {pl.songCount} {pl.songCount === 1 ? 'song' : 'songs'}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
            {queue.length > 1 && (
              <button
                onClick={clearQueue}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-slate-600 dark:text-white/70 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 border border-slate-200/80 dark:border-white/10 hover:border-red-200 dark:hover:border-red-900 transition-colors cursor-pointer"
                title="Clear upcoming tracks from queue"
              >
                <Trash2 size={13} />
                <span>Clear Queue</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-slate-100/80 dark:bg-white/10 hover:bg-slate-200/80 dark:hover:bg-white/20 text-slate-600 dark:text-white/80 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Currently Playing Track */}
          {currentPlaying && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-white/60">
                  Now Playing
                </span>
                {isPlaying && (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-[#0F172A] dark:text-white bg-slate-100 dark:bg-white/10 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-white/15">
                    <Volume2 size={13} className="animate-pulse" />
                    Playing
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 shadow-xs relative">
                <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-sm shrink-0 border border-white dark:border-white/10">
                  {currentPlaying.artworkUrl ? (
                    <img
                      src={currentPlaying.artworkUrl}
                      alt={currentPlaying.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <PlaceholderArtwork
                      icon={currentPlaying.iconName || 'music'}
                      gradientFrom={currentPlaying.gradientFrom || '#334155'}
                      gradientTo={currentPlaying.gradientTo || '#0F172A'}
                      size={48}
                      rounded="rounded-xl"
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-[#0F172A] dark:text-white truncate">
                    {currentPlaying.title}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-white/70 truncate mt-0.5">
                    {currentPlaying.artist}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-semibold text-slate-500 dark:text-white/60 tabular-nums">
                    {currentPlaying.duration}
                  </span>
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenDropdownId(openDropdownId === 'now-playing' ? null : 'now-playing');
                      }}
                      className="p-1.5 rounded-lg text-slate-500 dark:text-white/60 hover:text-[#0F172A] dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-white/15 transition-all cursor-pointer"
                      title="Add to playlist"
                    >
                      <FolderPlus size={15} />
                    </button>
                    {openDropdownId === 'now-playing' && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-full mt-1.5 w-48 max-h-52 overflow-y-auto py-1.5 rounded-xl bg-white dark:bg-black border border-slate-200 dark:border-white/10 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100 custom-scrollbar"
                      >
                        <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-white/50 border-b border-slate-100 dark:border-white/10">
                          Add to Playlist
                        </div>
                        {userPlaylists.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-slate-400 dark:text-white/40 italic">
                            No playlists created yet
                          </div>
                        ) : (
                          userPlaylists.map((pl) => (
                            <button
                              key={pl.id}
                              onClick={() => handleAddTrackToPlaylist(pl.id, currentPlaying)}
                              className="w-full px-3 py-1.5 text-left text-xs font-semibold text-[#0F172A] dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 truncate transition-colors cursor-pointer"
                            >
                              {pl.title}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Upcoming Tracks in Queue */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-white/60">
                Next in Queue ({upcomingTracks.length})
              </span>
            </div>

            {upcomingTracks.length === 0 ? (
              <div className="py-8 text-center text-slate-500 dark:text-white/60 text-xs flex flex-col items-center justify-center gap-2 border border-dashed border-slate-200 dark:border-white/10 rounded-2xl bg-slate-50/50 dark:bg-white/[0.03]">
                <Music size={24} className="text-slate-400 dark:text-white/40 opacity-60" />
                <span>Queue is empty. Select any playlist or track to queue more songs.</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                {upcomingTracks.map((track, i) => {
                  const actualIndex = queueIndex + 1 + i;
                  return (
                    <div
                      key={`${track.id}-${actualIndex}`}
                      className="group flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-slate-100/80 dark:hover:bg-white/[0.06] transition-all border border-transparent hover:border-slate-200/60 dark:hover:border-white/10"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="w-5 text-center text-xs font-bold text-slate-400 dark:text-white/50 group-hover:hidden">
                          {i + 1}
                        </span>
                        <button
                          onClick={() => jumpToQueueIndex(actualIndex)}
                          className="w-5 hidden group-hover:flex items-center justify-center text-[#0F172A] dark:text-white hover:scale-110 transition-transform cursor-pointer"
                          title="Play now"
                        >
                          <Play size={14} fill="currentColor" />
                        </button>

                        <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-slate-200 dark:border-white/10 shadow-2xs">
                          {track.artworkUrl ? (
                            <img
                              src={track.artworkUrl}
                              alt={track.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <PlaceholderArtwork
                              icon={track.iconName || 'music'}
                              gradientFrom={track.gradientFrom || '#334155'}
                              gradientTo={track.gradientTo || '#0F172A'}
                              size={40}
                              rounded="rounded-lg"
                            />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-[#0F172A] dark:text-white truncate group-hover:text-black dark:group-hover:text-white transition-colors">
                            {track.title}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-white/60 truncate mt-0.5">
                            {track.artist}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-slate-500 dark:text-white/60 tabular-nums">
                          {track.duration}
                        </span>

                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDropdownId(openDropdownId === `queue-${actualIndex}` ? null : `queue-${actualIndex}`);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-400 dark:text-white/50 hover:text-[#0F172A] dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10 transition-all cursor-pointer"
                            title="Add to playlist"
                          >
                            <FolderPlus size={14} />
                          </button>

                          {openDropdownId === `queue-${actualIndex}` && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 top-full mt-1.5 w-48 max-h-52 overflow-y-auto py-1.5 rounded-xl bg-white dark:bg-black border border-slate-200 dark:border-white/10 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100 custom-scrollbar"
                            >
                              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-white/50 border-b border-slate-100 dark:border-white/10">
                                Add to Playlist
                              </div>
                              {userPlaylists.length === 0 ? (
                                <div className="px-3 py-2 text-xs text-slate-400 dark:text-white/40 italic">
                                  No playlists created yet
                                </div>
                              ) : (
                                userPlaylists.map((pl) => (
                                  <button
                                    key={pl.id}
                                    onClick={() => handleAddTrackToPlaylist(pl.id, track)}
                                    className="w-full px-3 py-1.5 text-left text-xs font-semibold text-[#0F172A] dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 truncate transition-colors cursor-pointer"
                                  >
                                    {pl.title}
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => removeFromQueue(actualIndex)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-400 dark:text-white/50 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all cursor-pointer"
                          title="Remove from queue"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
