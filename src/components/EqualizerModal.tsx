import React, { useEffect, useRef } from 'react';
import { Sliders, X, Activity } from 'lucide-react';
import { useEqStore } from '../store/eqStore';
import { EQ_BANDS, EQ_PRESETS } from '../audio/presets';
import audioEngine from '../audio/AudioEngine';

interface EqualizerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EqualizerModal: React.FC<EqualizerModalProps> = ({ isOpen, onClose }) => {
  const { isEnabled, bands, selectedPreset, toggleEnabled, setBand, applyPreset } = useEqStore();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Real-time spectrum visualizer
  useEffect(() => {
    if (!isOpen || !isEnabled) return;
    let animId: number;

    const renderSpectrum = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const freqData = audioEngine.getFrequencyData();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barCount = Math.min(freqData.length, 32);
      const barWidth = canvas.width / barCount - 2;

      for (let i = 0; i < barCount; i++) {
        const val = freqData[i] || 0;
        const percent = val / 255;
        const barHeight = Math.max(3, percent * canvas.height);
        const x = i * (barWidth + 2);
        const y = canvas.height - barHeight;

        // Gradient for bars
        const grad = ctx.createLinearGradient(0, canvas.height, 0, 0);
        grad.addColorStop(0, 'rgba(99, 102, 241, 0.4)');
        grad.addColorStop(1, 'rgba(192, 132, 252, 0.9)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(renderSpectrum);
    };

    animId = requestAnimationFrame(renderSpectrum);
    return () => cancelAnimationFrame(animId);
  }, [isOpen, isEnabled]);

  if (!isOpen) return null;

  return (
    <>
      <style>
        {`
          .eq-slider {
            -webkit-appearance: none;
            appearance: none;
            width: 34px;
            height: 150px;
            background: transparent;
            cursor: pointer;
          }
          .eq-slider::-webkit-slider-runnable-track {
            width: 6px;
            background: rgba(15, 23, 42, 0.12);
            border-radius: 9999px;
            margin: auto;
          }
          .dark .eq-slider::-webkit-slider-runnable-track {
            background: rgba(255, 255, 255, 0.15);
          }
          .eq-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: #8B5CF6;
            box-shadow: 0 2px 8px rgba(139, 92, 246, 0.6);
            cursor: grab;
            margin-left: 8px;
          }
        `}
      </style>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
        <div className="bg-white/95 dark:bg-[#0C0C10] backdrop-blur-3xl border border-white/80 dark:border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col p-6 m-4 overflow-hidden relative shadow-[0_25px_60px_rgba(0,0,0,0.35)]">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl text-white shadow-md">
                <Sliders size={22} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-[#0F172A] dark:text-white leading-tight">10-Band Equalizer</h2>
                <p className="text-xs text-[#64748B] dark:text-[#A1A1AA] flex items-center gap-1.5 mt-0.5">
                  <Activity size={12} className="text-violet-600 dark:text-violet-400 animate-pulse" />
                  Web Audio Parametric Engine (-12dB to +12dB)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center cursor-pointer" title="Toggle EQ">
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={isEnabled}
                    onChange={() => toggleEnabled()}
                  />
                  <div className={`block w-13 h-7 rounded-full transition-colors ${isEnabled ? 'bg-violet-600' : 'bg-[#94A3B8] dark:bg-zinc-700'}`} />
                  <div className={`dot absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform shadow-sm ${isEnabled ? 'transform translate-x-6' : ''}`} />
                </div>
              </label>
              <button
                onClick={onClose}
                className="p-2 text-[#64748B] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                title="Close Equalizer"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Real-time Spectrum Canvas */}
          <div className="w-full h-14 mb-5 rounded-2xl bg-slate-100/90 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/10 overflow-hidden relative flex items-end px-2 py-1 shadow-inner">
            <canvas ref={canvasRef} width={580} height={48} className="w-full h-full" />
            <div className="absolute top-1.5 right-2.5 text-[10px] font-mono font-bold text-[#64748B] dark:text-zinc-400 uppercase tracking-wider">
              {isEnabled ? 'Live Spectrum' : 'EQ Bypass'}
            </div>
          </div>

          {/* 10 Vertical Sliders */}
          <div
            className={`flex flex-row justify-between items-center px-2 mb-6 transition-opacity duration-300 ${
              !isEnabled ? 'opacity-40 pointer-events-none' : ''
            }`}
          >
            {EQ_BANDS.map((bandConfig, i) => (
              <div key={bandConfig.frequency} className="flex flex-col items-center gap-2">
                <div className="text-[11px] font-mono font-bold text-[#0F172A] dark:text-white bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 px-1.5 py-0.5 rounded-md min-w-[2.8rem] text-center shadow-xs">
                  {bands[i] > 0 ? '+' : ''}
                  {bands[i].toFixed(1)}
                </div>
                <input
                  type="range"
                  min={-12}
                  max={12}
                  step={0.5}
                  value={bands[i]}
                  onChange={(e) => setBand(i, parseFloat(e.target.value))}
                  className="eq-slider"
                  style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
                />
                <div className="text-[11px] font-bold text-[#334155] dark:text-zinc-400 mt-1">
                  {bandConfig.label}
                </div>
              </div>
            ))}
          </div>

          {/* Presets (Wrapped Grid - All visible at once!) */}
          <div className="mt-auto pt-4 border-t border-slate-200/80 dark:border-white/10">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-[#A1A1AA] mb-2.5">
              Audio Presets
            </h3>
            <div className="flex flex-wrap gap-2">
              {EQ_PRESETS.map((preset) => {
                const isActive = selectedPreset === preset.name && isEnabled;
                return (
                  <button
                    key={preset.name}
                    onClick={() => applyPreset(preset.name)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#0F172A] dark:bg-white text-white dark:text-black shadow-md'
                        : 'bg-slate-100 dark:bg-white/[0.06] hover:bg-white dark:hover:bg-white/[0.12] text-[#334155] dark:text-zinc-300 hover:text-[#0F172A] dark:hover:text-white border border-slate-200 dark:border-white/10 shadow-xs'
                    }`}
                  >
                    {preset.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
