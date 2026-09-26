import React, { useState, useEffect } from 'react';
import { Waves, Sparkles, User, CheckCircle2 } from 'lucide-react';
import { useTranslation } from '../i18n';
import { useSettingsStore } from '../store/settingsStore';
import { usePlayerStore } from '../store/playerStore';
import { useLibraryStore } from '../store/libraryStore';
import { useToastStore } from '../store/toastStore';
import { generateWaveTracks } from '../services/waveService';

interface WaveGeneratingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WaveGeneratingModal: React.FC<WaveGeneratingModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t, language } = useTranslation();
  const settingsStore = useSettingsStore();
  const playerStore = usePlayerStore();
  const libraryStore = useLibraryStore();
  const toastStore = useToastStore();

  const [progress, setProgress] = useState<number>(10);
  const [currentStep, setCurrentStep] = useState<string>('analyzing');
  const favoriteArtists = settingsStore.favoriteArtists || [];
  const favoriteAvatars = settingsStore.favoriteArtistAvatars || {};

  useEffect(() => {
    if (!isOpen || favoriteArtists.length === 0) return;

    let isMounted = true;
    setProgress(15);
    setCurrentStep('analyzing');

    generateWaveTracks(favoriteArtists, true, (step, percent) => {
      if (isMounted) {
        setCurrentStep(step);
        setProgress((prev) => Math.max(prev, percent));
      }
    })
      .then(async (tracks) => {
        if (!isMounted) return;

        setProgress(100);
        setCurrentStep('done');

        // Short pause so the user sees the completed state
        await new Promise((resolve) => setTimeout(resolve, 600));
        if (!isMounted) return;

        const waveName = t.wave?.title || 'My Wave';
        const stationTitle = t.wave?.stationStarted || 'My Wave started';

        settingsStore.setOnboardingCompleted(true);
        settingsStore.setIsWaveGeneratingModalOpen(false);
        onClose();

        if (tracks && tracks.length > 0) {
          libraryStore.setCustomPlaylistView(waveName, tracks, {
            creator: 'Otofy',
            description: `${t.wave?.artistsPrefix || 'Based on: '}${favoriteArtists.join(', ')}`,
            iconName: 'waves',
            gradientFrom: '#1E293B',
            gradientTo: '#0F172A',
          });
          await playerStore.playTrack(tracks[0], tracks);
          toastStore.success(stationTitle, `${waveName} (${tracks.length})`);
        }
      })
      .catch((err) => {
        console.warn('[WaveGeneratingModal] Wave build failed:', err);
        if (!isMounted) return;
        settingsStore.setOnboardingCompleted(true);
        settingsStore.setIsWaveGeneratingModalOpen(false);
        onClose();
        const errorTitle = language === 'ru' ? 'Ошибка' : 'Error';
        toastStore.error(errorTitle, 'Failed to build My Wave');
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, favoriteArtists]);

  if (!isOpen) return null;

  const getStepText = () => {
    switch (currentStep) {
      case 'analyzing':
        return t.wave?.stepAnalyzing || 'Analyzing your favorite artists...';
      case 'matching':
        return t.wave?.stepMatching || 'Finding matching tracks and signature sounds...';
      case 'flow':
        return t.wave?.stepFlow || 'Calibrating endless personal flow...';
      case 'ready':
      case 'done':
        return t.wave?.stepDone || 'My Wave is ready! Starting playback...';
      default:
        return t.wave?.stepAnalyzing || 'Preparing your personal station...';
    }
  };

  return (
    <div
      id="wave-generating-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#F8FAFC]/95 dark:bg-[#060608]/95 backdrop-blur-3xl select-none animate-fade-in text-[#0F172A] dark:text-white"
    >
      <div className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full bg-black/[0.03] dark:bg-white/[0.04] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-black/[0.02] dark:bg-white/[0.03] blur-3xl" />

      <div className="relative z-10 w-full max-w-xl flex flex-col items-center text-center">
        <div className="relative mb-8">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-[#0F172A] text-white dark:bg-white dark:text-black flex items-center justify-center shadow-[0_12px_40px_rgba(15,23,42,0.25)] dark:shadow-[0_0_50px_rgba(255,255,255,0.25)] transition-transform duration-300 scale-100 hover:scale-105">
            <Waves size={44} className="animate-pulse" />
          </div>

          <div className="absolute inset-0 rounded-3xl border border-black/15 dark:border-white/30 animate-ping opacity-25 pointer-events-none" />
        </div>

        <div className="flex items-center gap-1.5 mb-6 h-6">
          <div className="w-1 h-3 rounded-full bg-[#0F172A] dark:bg-white animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-1 h-5 rounded-full bg-[#0F172A] dark:bg-white animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-1 h-6 rounded-full bg-[#0F172A] dark:bg-white animate-bounce" style={{ animationDelay: '300ms' }} />
          <div className="w-1 h-4 rounded-full bg-[#0F172A] dark:bg-white animate-bounce" style={{ animationDelay: '450ms' }} />
          <div className="w-1 h-2 rounded-full bg-[#0F172A] dark:bg-white animate-bounce" style={{ animationDelay: '200ms' }} />
        </div>

        <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-2 text-[#0F172A] dark:text-white">
          {t.wave?.generatingTitle || 'Creating Your Wave'}
        </h2>

        <p className="text-sm sm:text-base text-[#475569] dark:text-white/70 max-w-md min-h-[48px] flex items-center justify-center font-medium">
          {getStepText()}
        </p>

        <div className="w-full max-w-md mt-6">
          <div className="flex items-center justify-between text-xs font-semibold mb-2 text-[#64748B] dark:text-white/60">
            <span className="flex items-center gap-1.5">
              <Sparkles size={13} className="text-[#0F172A] dark:text-white" />
              <span>{t.wave?.badge || 'Personal Stream'}</span>
            </span>
            <span className="font-mono tabular-nums font-bold">
              {progress}%
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-black/[0.08] dark:bg-white/10 overflow-hidden shadow-inner">
            <div
              className="h-full bg-[#0F172A] dark:bg-white rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {favoriteArtists.length > 0 && (
          <div className="flex items-center justify-center gap-2.5 mt-8 flex-wrap max-w-md">
            {favoriteArtists.slice(0, 5).map((artistName) => {
              const avatar = favoriteAvatars[artistName];
              return (
                <div
                  key={artistName}
                  className="inline-flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-white/80 dark:bg-white/[0.08] border border-black/5 dark:border-white/10 shadow-xs"
                >
                  <div className="w-6 h-6 rounded-full overflow-hidden bg-black/10 dark:bg-white/10 shrink-0 flex items-center justify-center">
                    {avatar ? (
                      <img
                        src={avatar}
                        alt={artistName}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <User size={13} className="text-slate-600 dark:text-white/70" />
                    )}
                  </div>
                  <span className="text-xs font-semibold text-[#0F172A] dark:text-white/90 truncate max-w-[120px]">
                    {artistName}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
