import React from 'react';
import { Download, Pause, Play, X, Check, Loader2 } from 'lucide-react';
import { useDownloadStore } from '../store/downloadStore';

export const BatchDownloadBanner: React.FC = () => {
  const { batchState, pauseAll, resumeAll, cancelAll, dismissBatch } = useDownloadStore();

  if (!batchState || (!batchState.active && batchState.completed === 0 && batchState.failed === 0)) {
    return null;
  }

  const percent = batchState.total > 0 ? Math.round((batchState.completed / batchState.total) * 100) : 0;

  return (
    <div className="fixed bottom-28 right-6 z-40 w-84 md:w-96 bg-white/95 dark:bg-[#121218]/95 backdrop-blur-2xl border border-black/10 dark:border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.35)] p-3.5 flex flex-col gap-2.5 select-none animate-in slide-in-from-bottom-5 duration-200 text-[#0F172A] dark:text-white">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-black/5 dark:bg-white/10 text-[#0F172A] dark:text-white flex items-center justify-center shrink-0">
            {batchState.active ? (
              batchState.isPaused ? (
                <Pause size={14} className="text-amber-500" />
              ) : (
                <Loader2 size={14} className="animate-spin text-[#0F172A] dark:text-white" />
              )
            ) : (
              <Check size={14} className="text-[#0F172A] dark:text-white" />
            )}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold truncate leading-tight">
              {batchState.active
                ? batchState.isPaused
                  ? 'Download Paused'
                  : 'Downloading Playlist'
                : 'Download Completed'}
            </h4>
            <p className="text-[11px] text-[#64748B] dark:text-white/60 truncate leading-tight">
              {batchState.playlistTitle}
            </p>
          </div>
        </div>

        <button
          onClick={dismissBatch}
          className="p-1 rounded-lg text-[#64748B] dark:text-white/40 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
          title="Dismiss"
        >
          <X size={15} />
        </button>
      </div>

      {/* Progress Info */}
      <div className="flex items-center justify-between text-[11px] font-medium text-[#475569] dark:text-white/70">
        <span className="truncate max-w-[200px]">
          {batchState.active && batchState.currentTrackTitle
            ? batchState.currentTrackTitle
            : `${batchState.completed} of ${batchState.total} tracks`}
        </span>
        <span className="tabular-nums font-bold text-[#0F172A] dark:text-white">
          {batchState.completed} / {batchState.total} ({percent}%)
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1.5 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 rounded-full ${
            batchState.isPaused
              ? 'bg-amber-500'
              : 'bg-[#0F172A] dark:bg-white'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Actions */}
      {batchState.active && (
        <div className="flex items-center justify-end gap-2 pt-0.5">
          {batchState.isPaused ? (
            <button
              onClick={resumeAll}
              className="px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-[#0F172A] dark:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Play size={12} fill="currentColor" />
              <span>Resume All</span>
            </button>
          ) : (
            <button
              onClick={pauseAll}
              className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Pause size={12} fill="currentColor" />
              <span>Pause All</span>
            </button>
          )}

          <button
            onClick={cancelAll}
            className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <X size={12} />
            <span>Cancel All</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default BatchDownloadBanner;
