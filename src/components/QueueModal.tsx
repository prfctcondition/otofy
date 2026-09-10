import React, { useEffect } from 'react';
import { ListMusic, X, Play, Trash2, Music, Volume2, FolderPlus } from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';
import { useLibraryStore } from '../store/libraryStore';
import { useContextMenuStore } from '../store/contextMenuStore';
import { PlaceholderArtwork } from './PlaceholderArtwork';

interface QueueModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QueueModal: React.FC<QueueModalProps> = ({ isOpen, onClose }) => {
  const createPlaylistFromTracks = useLibraryStore((state) => state.createPlaylistFromTracks);
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-150 p-4 select-none"
      onClick={onClose}
    >
      <div
        className="bg-white/95 dark:bg-[#0C0C10] backdrop-blur-3xl border border-white dark:border-white/10 rounded-3xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden relative shadow-[0_25px_60px_rgba(0,0,0,0.22),inset_0_1px_2px_#FFFFFF] dark:shadow-[0_25px_60px_rgba(0,0,0,0.8)]"
        onClick={(e) => e.stopPropagation()}
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
              <button
                onClick={handleSaveAsPlaylist}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#0F172A] hover:bg-black dark:bg-white dark:hover:bg-white/90 text-white dark:text-black shadow-xs hover:shadow transition-all cursor-pointer"
                title="Save active queue as a new playlist"
              >
                <FolderPlus size={13} />
                <span>Save as playlist</span>
              </button>
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
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/60">
                    <Volume2 size={13} className="animate-pulse" />
                    Playing
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 shadow-xs">
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

                <span className="text-xs font-semibold text-slate-500 dark:text-white/60 tabular-nums shrink-0">
                  {currentPlaying.duration}
                </span>
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

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-slate-500 dark:text-white/60 tabular-nums">
                          {track.duration}
                        </span>
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
