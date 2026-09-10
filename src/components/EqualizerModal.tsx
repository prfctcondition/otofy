import React, { useEffect, useRef } from 'react';
import { Sliders, X, Activity } from 'lucide-react';
import { useEqStore } from '../store/eqStore';
import { EQ_BANDS, EQ_PRESETS } from '../audio/presets';
import audioEngine from '../audio/AudioEngine';

interface EqualizerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface VerticalEqSliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onChange: (val: number) => void;
  onReset?: () => void;
}

const VerticalEqSlider: React.FC<VerticalEqSliderProps> = ({
  value,
  min,
  max,
  step,
  disabled = false,
  onChange,
  onReset,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const calculateValueFromPointer = (clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    const rawVal = max - ratio * (max - min);
    const stepped = Math.round(rawVal / step) * step;
    const clamped = Math.max(min, Math.min(max, Number(stepped.toFixed(1))));
    onChange(clamped);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    isDraggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    calculateValueFromPointer(e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || disabled) return;
    calculateValueFromPointer(e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault();
      onChange(Math.min(max, Number((value + step).toFixed(1))));
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault();
      onChange(Math.max(min, Number((value - step).toFixed(1))));
    } else if (e.key === 'Home') {
      e.preventDefault();
      onChange(max);
    } else if (e.key === 'End') {
      e.preventDefault();
      onChange(min);
    } else if (e.key === '0' || e.key === 'Enter') {
      e.preventDefault();
      onReset?.();
    }
  };

  // Top percentage: value == max => 0%, value == min => 100%, value == 0 => 50%
  const percentFromTop = Math.max(0, Math.min(100, ((max - value) / (max - min)) * 100));
  const zeroPercent = ((max - 0) / (max - min)) * 100; // 50%

  const fillTop = Math.min(percentFromTop, zeroPercent);
  const fillHeight = Math.abs(percentFromTop - zeroPercent);

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={() => onReset?.()}
      onKeyDown={handleKeyDown}
      tabIndex={disabled ? -1 : 0}
      role="slider"
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      className={`relative w-8 h-[150px] flex items-center justify-center cursor-pointer select-none touch-none group outline-none focus-visible:ring-1 focus-visible:ring-black/20 dark:focus-visible:ring-white/30 rounded-lg ${
        disabled ? 'cursor-not-allowed' : ''
      }`}
      title="Drag to adjust gain, double-click to reset to 0dB"
    >
      {/* Background Track Rail - strictly centered */}
      <div className="w-1.5 h-full rounded-full bg-slate-200/90 dark:bg-white/20 relative overflow-hidden">
        {/* Subtle active fill from 0dB */}
        <div
          className="absolute left-0 right-0 bg-[#0F172A] dark:bg-white/90 rounded-full transition-all duration-75"
          style={{
            top: `${fillTop}%`,
            height: `${fillHeight}%`,
          }}
        />
      </div>

      {/* 0 dB Center Tick Mark */}
      <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-3 h-0.5 bg-slate-300 dark:bg-white/30 pointer-events-none rounded-full" />

      {/* Thumb: 18px circle 100% centered horizontally on the rail (left: 50%, transform: translate(-50%, -50%)) */}
      <div
        className="absolute left-1/2 w-[18px] h-[18px] rounded-full bg-[#0F172A] dark:bg-white border-[2.5px] border-white dark:border-[#0C0C10] shadow-[0_2px_6px_rgba(0,0,0,0.35)] pointer-events-none transition-transform duration-75 group-hover:scale-110 group-active:scale-120"
        style={{
          top: `${percentFromTop}%`,
          transform: 'translate(-50%, -50%)',
        }}
      />
    </div>
  );
};

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
        const isDark = document.documentElement.classList.contains('dark');
        const grad = ctx.createLinearGradient(0, canvas.height, 0, 0);
        if (isDark) {
          grad.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
          grad.addColorStop(1, 'rgba(255, 255, 255, 0.9)');
        } else {
          grad.addColorStop(0, 'rgba(15, 23, 42, 0.25)');
          grad.addColorStop(1, 'rgba(15, 23, 42, 0.85)');
        }

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white/95 dark:bg-[#0C0C10] backdrop-blur-3xl border border-white/80 dark:border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col p-6 m-4 overflow-hidden relative shadow-[0_25px_60px_rgba(0,0,0,0.35)]">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#0F172A] dark:bg-white rounded-2xl text-white dark:text-black shadow-md">
              <Sliders size={22} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#0F172A] dark:text-white leading-tight">10-Band Equalizer</h2>
              <p className="text-xs text-[#64748B] dark:text-white/70 flex items-center gap-1.5 mt-0.5">
                <Activity size={12} className="text-emerald-500 animate-pulse" />
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
                <div className={`block w-13 h-7 rounded-full transition-colors ${isEnabled ? 'bg-[#0F172A] dark:bg-white' : 'bg-[#94A3B8] dark:bg-white/20'}`} />
                <div className={`dot absolute left-1 top-1 bg-white dark:bg-black w-5 h-5 rounded-full transition-transform shadow-sm ${isEnabled ? 'transform translate-x-6' : ''}`} />
              </div>
            </label>
            <button
              onClick={onClose}
              className="p-2 text-[#64748B] dark:text-white/70 hover:text-[#0F172A] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer"
              title="Close Equalizer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Real-time Spectrum Canvas */}
        <div className="w-full h-14 mb-5 rounded-2xl bg-slate-100/90 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/10 overflow-hidden relative flex items-end px-2 py-1 shadow-inner">
          <canvas ref={canvasRef} width={580} height={48} className="w-full h-full" />
          <div className="absolute top-1.5 right-2.5 text-[10px] font-mono font-bold text-[#64748B] dark:text-white/70 uppercase tracking-wider">
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
              <VerticalEqSlider
                value={bands[i]}
                min={-12}
                max={12}
                step={0.5}
                disabled={!isEnabled}
                onChange={(val) => setBand(i, val)}
                onReset={() => setBand(i, 0)}
              />
              <div className="text-[11px] font-bold text-[#334155] dark:text-white/80 mt-1">
                {bandConfig.label}
              </div>
            </div>
          ))}
        </div>

        {/* Presets (Wrapped Grid - All visible at once!) */}
        <div className="mt-auto pt-4 border-t border-slate-200/80 dark:border-white/10">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-white/70 mb-2.5">
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
                      : 'bg-slate-100 dark:bg-white/[0.06] hover:bg-white dark:hover:bg-white/[0.12] text-[#334155] dark:text-white/80 hover:text-[#0F172A] dark:hover:text-white border border-slate-200 dark:border-white/10 shadow-xs'
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
  );
};
