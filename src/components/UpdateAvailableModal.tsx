import React, { useState, useEffect } from 'react';
import { Sparkles, Download, X, ExternalLink, AlertCircle, RotateCcw } from 'lucide-react';
import type { UpdateCheckResult, UpdateDownloadProgress } from '../types';

interface UpdateAvailableModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateInfo: UpdateCheckResult | null;
}

export const UpdateAvailableModal: React.FC<UpdateAvailableModalProps> = ({
  isOpen,
  onClose,
  updateInfo,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<UpdateDownloadProgress | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Reset state when modal opens with new info
  useEffect(() => {
    if (isOpen) {
      setIsDownloading(false);
      setDownloadProgress(null);
      setDownloadError(null);
    }
  }, [isOpen, updateInfo?.latestVersion]);

  // Clean up progress listener on unmount
  useEffect(() => {
    return () => {
      if (isDownloading && window.electronAPI?.cancelUpdateDownload) {
        window.electronAPI.cancelUpdateDownload();
      }
    };
  }, [isDownloading]);

  if (!isOpen || !updateInfo) return null;

  const handleStartUpdate = async () => {
    if (!window.electronAPI?.downloadAndInstallUpdate) {
      if (updateInfo.releaseUrl) {
        window.open(updateInfo.releaseUrl, '_blank');
      }
      return;
    }

    setIsDownloading(true);
    setDownloadError(null);
    setDownloadProgress({ percent: 0, transferred: 0, total: updateInfo.fileSize || 0 });

    let unsubscribe: (() => void) | undefined;
    if (window.electronAPI.onUpdateDownloadProgress) {
      unsubscribe = window.electronAPI.onUpdateDownloadProgress((progress) => {
        setDownloadProgress(progress);
      });
    }

    try {
      const res = await window.electronAPI.downloadAndInstallUpdate();
      if (!res.success) {
        setDownloadError(res.error || 'Failed to download installer.');
        setIsDownloading(false);
      }
    } catch (err: any) {
      setDownloadError(err?.message || 'Download encountered an unexpected error.');
      setIsDownloading(false);
    } finally {
      unsubscribe?.();
    }
  };

  const handleCancelDownload = async () => {
    if (window.electronAPI?.cancelUpdateDownload) {
      await window.electronAPI.cancelUpdateDownload();
    }
    setIsDownloading(false);
    setDownloadProgress(null);
  };

  const handleClose = () => {
    if (isDownloading) {
      handleCancelDownload();
    }
    onClose();
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return null;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  // Helper to render clean release notes without raw markdown clutter
  const renderReleaseNotes = (rawNotes?: string) => {
    if (!rawNotes || !rawNotes.trim()) {
      return (
        <p className="text-xs text-[#475569] dark:text-neutral-400 italic">
          This release includes performance optimizations, UI refinements, and bug fixes.
        </p>
      );
    }

    const lines = rawNotes
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    return (
      <div className="space-y-1.5 text-xs text-[#1E293B] dark:text-neutral-200">
        {lines.map((line, idx) => {
          if (line.startsWith('#')) {
            const heading = line.replace(/^#+\s*/, '');
            return (
              <h4 key={idx} className="font-bold text-[#0F172A] dark:text-white pt-1">
                {heading}
              </h4>
            );
          }
          if (line.startsWith('*') || line.startsWith('-')) {
            const bullet = line.replace(/^[-*]\s*/, '');
            return (
              <div key={idx} className="flex items-start gap-2 pl-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0F172A] dark:bg-white mt-1.5 shrink-0" />
                <span className="leading-relaxed">{bullet}</span>
              </div>
            );
          }
          return (
            <p key={idx} className="leading-relaxed">
              {line}
            </p>
          );
        })}
      </div>
    );
  };

  const fileSizeFormatted = formatFileSize(updateInfo.fileSize);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDownloading) {
          handleClose();
        }
      }}
    >
      <div className="bg-white/95 dark:bg-[#0C0C10] backdrop-blur-3xl border border-white dark:border-neutral-800 rounded-3xl w-full max-w-lg flex flex-col p-6 m-4 relative shadow-[0_25px_60px_rgba(15,23,42,0.18),inset_0_1px_2px_#FFFFFF] dark:shadow-[0_25px_60px_rgba(0,0,0,0.95)]">
        {/* Top Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-[#0F172A] dark:bg-white text-white dark:text-black rounded-2xl shadow-md shrink-0">
              <Sparkles size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-[#0F172A] dark:text-white leading-tight">
                  New Update
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#0F172A] dark:bg-white text-white dark:text-black font-mono shadow-xs">
                  v{updateInfo.latestVersion.replace(/^v/i, '')}
                </span>
              </div>
              <p className="text-xs text-[#64748B] dark:text-neutral-400 mt-0.5">
                A fresh version of Otofy is ready to enhance your experience.
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isDownloading}
            className="p-2 text-[#64748B] dark:text-neutral-400 hover:text-[#0F172A] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer disabled:opacity-40"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Version comparison row */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-neutral-800 mb-4">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-[#64748B] dark:text-neutral-500 text-[11px] font-sans font-medium">
              Current:
            </span>
            <span className="px-2 py-0.5 rounded-lg bg-slate-200/70 dark:bg-neutral-900 text-[#475569] dark:text-neutral-300 font-semibold border border-slate-300/60 dark:border-neutral-800">
              v{updateInfo.currentVersion.replace(/^v/i, '')}
            </span>
            <span className="text-[#64748B] dark:text-neutral-600 font-sans font-bold">→</span>
            <span className="text-[#64748B] dark:text-neutral-500 text-[11px] font-sans font-medium">
              Latest:
            </span>
            <span className="px-2 py-0.5 rounded-lg bg-[#0F172A] dark:bg-white text-white dark:text-black font-bold shadow-xs">
              v{updateInfo.latestVersion.replace(/^v/i, '')}
            </span>
          </div>

          {fileSizeFormatted && (
            <div className="text-[11px] font-mono text-[#0F172A] dark:text-white px-2.5 py-0.5 rounded-lg bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 font-medium">
              {fileSizeFormatted}
            </div>
          )}
        </div>

        {/* Release Notes section */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[11px] font-bold text-[#64748B] dark:text-neutral-400 uppercase tracking-wider">
              Release Notes
            </span>
            {updateInfo.releaseUrl && (
              <a
                href={updateInfo.releaseUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-[#0F172A] dark:text-white hover:underline flex items-center gap-1 font-medium"
              >
                <span>GitHub Release</span>
                <ExternalLink size={12} />
              </a>
            )}
          </div>
          <div className="p-3.5 bg-slate-50 dark:bg-black/60 rounded-2xl border border-slate-200 dark:border-neutral-800 max-h-48 overflow-y-auto pr-2 custom-scrollbar select-text">
            {renderReleaseNotes(updateInfo.releaseNotes)}
          </div>
        </div>

        {/* Downloading Progress Bar */}
        {isDownloading && downloadProgress && (
          <div className="p-4 rounded-2xl bg-slate-100 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 mb-4 space-y-2 animate-in fade-in duration-150">
            <div className="flex items-center justify-between text-xs font-semibold text-[#0F172A] dark:text-white">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#0F172A] dark:bg-white animate-pulse" />
                Downloading official installer...
              </span>
              <span className="font-mono font-bold">{downloadProgress.percent}%</span>
            </div>

            <div className="w-full bg-slate-200 dark:bg-neutral-800 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-[#0F172A] dark:bg-white h-full transition-all duration-200 rounded-full"
                style={{ width: `${Math.max(downloadProgress.percent, 3)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-[#64748B] dark:text-neutral-400 font-mono">
              <span>
                {(downloadProgress.transferred / (1024 * 1024)).toFixed(1)} MB /{' '}
                {(downloadProgress.total / (1024 * 1024)).toFixed(1)} MB
              </span>
              <span className="font-sans text-[10px]">Auto-launches on finish</span>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {downloadError && (
          <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-neutral-900 border border-slate-300 dark:border-neutral-800 text-[#0F172A] dark:text-white text-xs mb-4 flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle size={16} className="text-[#0F172A] dark:text-white shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">
              <p className="font-bold">Download Failed</p>
              <p className="text-[#475569] dark:text-neutral-400 mt-0.5">{downloadError}</p>
            </div>
          </div>
        )}

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {isDownloading ? (
            <button
              onClick={handleCancelDownload}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-[#64748B] dark:text-neutral-400 hover:text-[#0F172A] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-neutral-800 transition-colors cursor-pointer"
            >
              Cancel Download
            </button>
          ) : (
            <>
              <button
                onClick={handleClose}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[#475569] dark:text-neutral-400 hover:text-[#0F172A] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                Remind Me Later
              </button>

              {updateInfo.canAutoInstall ? (
                <button
                  onClick={handleStartUpdate}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#0F172A] hover:bg-[#1E293B] active:bg-[#0F172A] text-white dark:bg-white dark:hover:bg-neutral-200 dark:active:bg-white dark:text-black shadow-md shadow-[#0F172A]/20 dark:shadow-none flex items-center gap-2 transition-all cursor-pointer"
                >
                  {downloadError ? <RotateCcw size={14} /> : <Download size={14} />}
                  <span>{downloadError ? 'Retry Download' : 'Update Now'}</span>
                </button>
              ) : (
                <a
                  href={updateInfo.releaseUrl || 'https://github.com/prfctcondition/otofy/releases'}
                  target="_blank"
                  rel="noreferrer"
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#0F172A] hover:bg-[#1E293B] text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-black shadow-md flex items-center gap-2 transition-all cursor-pointer"
                >
                  <ExternalLink size={14} />
                  <span>Download on GitHub</span>
                </a>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpdateAvailableModal;
