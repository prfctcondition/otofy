import React, { useEffect } from 'react';
import { ListMusic, X, Play, Trash2, Music, Volume2 } from 'lucide-react';
import { usePlayerStore } from '../store/playerStore';
import { PlaceholderArtwork } from './PlaceholderArtwork';

interface QueueModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QueueModal: React.FC<QueueModalProps> = ({ isOpen, onClose }) => {
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-150 p-4 select-none"
      onClick={onClose}
    >
      <div
        className="bg-white/95 backdrop-blur-3xl border border-white rounded-3xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden relative shadow-[0_25px_60px_rgba(0,0,0,0.22),inset_0_1px_2px_#FFFFFF]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-black/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
              <ListMusic size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#0F172A] leading-tight">Play Queue</h2>
              <p className="text-xs text-[#64748B]">
                {queue.length} {queue.length === 1 ? 'song' : 'songs'} in active queue
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {queue.length > 1 && (
              <button
                onClick={clearQueue}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 border border-slate-200/80 hover:border-red-200 transition-colors"
                title="Clear upcoming tracks from queue"
              >
                <Trash2 size={13} />
                <span>Clear Queue</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-slate-100/80 hover:bg-slate-200/80 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors"
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
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Now Playing
                </span>
                {isPlaying && (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
                    <Volume2 size={13} className="animate-pulse" />
                    Playing
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-violet-50/80 border border-violet-100/80 shadow-xs">
                <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-sm shrink-0 border border-white">
                  {currentPlaying.artworkUrl ? (
                    <img
                      src={currentPlaying.artworkUrl}
                      alt={currentPlaying.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <PlaceholderArtwork
                      icon={currentPlaying.iconName || 'music'}
                      gradientFrom={currentPlaying.gradientFrom || '#6366F1'}
                      gradientTo={currentPlaying.gradientTo || '#9333EA'}
                      size={48}
                      rounded="rounded-xl"
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-[#0F172A] truncate">
                    {currentPlaying.title}
                  </h4>
                  <p className="text-xs text-slate-600 truncate mt-0.5">
                    {currentPlaying.artist}
                  </p>
                </div>

                <span className="text-xs font-semibold text-slate-500 tabular-nums shrink-0">
                  {currentPlaying.duration}
                </span>
              </div>
            </div>
          )}

          {/* Upcoming Tracks in Queue */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Next in Queue ({upcomingTracks.length})
              </span>
            </div>

            {upcomingTracks.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <Music size={24} className="text-slate-400 opacity-60" />
                <span>Queue is empty. Select any playlist or track to queue more songs.</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                {upcomingTracks.map((track, i) => {
                  const actualIndex = queueIndex + 1 + i;
                  return (
                    <div
                      key={`${track.id}-${actualIndex}`}
                      className="group flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-slate-100/80 transition-all border border-transparent hover:border-slate-200/60"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="w-5 text-center text-xs font-bold text-slate-400 group-hover:hidden">
                          {i + 1}
                        </span>
                        <button
                          onClick={() => jumpToQueueIndex(actualIndex)}
                          className="w-5 hidden group-hover:flex items-center justify-center text-violet-600 hover:scale-110 transition-transform"
                          title="Play now"
                        >
                          <Play size={14} fill="currentColor" />
                        </button>

                        <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-slate-200 shadow-2xs">
                          {track.artworkUrl ? (
                            <img
                              src={track.artworkUrl}
                              alt={track.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <PlaceholderArtwork
                              icon={track.iconName || 'music'}
                              gradientFrom={track.gradientFrom || '#3B82F6'}
                              gradientTo={track.gradientTo || '#8B5CF6'}
                              size={40}
                              rounded="rounded-lg"
                            />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-[#0F172A] truncate group-hover:text-violet-600 transition-colors">
                            {track.title}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {track.artist}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-slate-500 tabular-nums">
                          {track.duration}
                        </span>
                        <button
                          onClick={() => removeFromQueue(actualIndex)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
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
