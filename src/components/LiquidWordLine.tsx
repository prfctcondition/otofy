import React, { useEffect, useState } from 'react';
import { audioEngine } from '../audio/AudioEngine';
import type { LrcLine } from '../services/lyricsService';

interface LiquidWordLineProps {
  line: LrcLine;
  isActive: boolean;
  themeMode?: 'dark' | 'light';
  hasWordSync?: boolean;
}

export const LiquidWordLine: React.FC<LiquidWordLineProps> = ({
  line,
  isActive,
  themeMode = 'dark',
  hasWordSync = true,
}) => {
  const [smoothTime, setSmoothTime] = useState<number>(() => audioEngine.currentTime);
  const [isLingerActive, setIsLingerActive] = useState<boolean>(false);

  useEffect(() => {
    if (isActive) {
      setIsLingerActive(true);
      return;
    }

    // Grace period for the last word of a line to finish its smooth glow fade-out
    const timer = setTimeout(() => {
      setIsLingerActive(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [isActive]);

  useEffect(() => {
    if (!isActive && !isLingerActive) return;

    let rafId: number = 0;
    const updateTime = () => {
      setSmoothTime(audioEngine.currentTime);
      rafId = requestAnimationFrame(updateTime);
    };

    rafId = requestAnimationFrame(updateTime);
    return () => cancelAnimationFrame(rafId);
  }, [isActive, isLingerActive]);

  if (!hasWordSync || !line.words || line.words.length === 0 || (!isActive && !isLingerActive)) {
    return <span>{line.text}</span>;
  }

  const isLight = themeMode === 'light';
  const solidColor = isLight ? '#142347' : '#FFFFFF';
  const dimmedColor = isLight ? 'rgba(20, 35, 71, 0.35)' : 'rgba(255, 255, 255, 0.35)';
  const glowColorPrefix = isLight ? 'rgba(20, 35, 71, ' : 'rgba(255, 255, 255, ';
  const maxBlur = isLight ? 6 : 14;
  const maxAlpha = isLight ? 0.2 : 0.75;

  return (
    <span>
      {line.words.map((w, idx) => {
        const separator = idx < line.words!.length - 1 ? ' ' : '';
        const duration = Math.max(0.01, w.end - w.begin);
        const fadeInDuration = Math.min(0.14, duration / 2.5);
        const fadeOutDuration = Math.min(0.18, Math.max(0.10, duration / 2));

        let glow = 0;
        let isPast = false;
        let isFuture = false;
        let pct = '0.0';

        if (smoothTime < w.begin) {
          isFuture = true;
          glow = 0;
        } else if (smoothTime >= w.begin && smoothTime < w.end) {
          // Word is actively being sung
          const progress = Math.max(0, Math.min(1, (smoothTime - w.begin) / duration));
          pct = (progress / 0.01).toFixed(1);

          const timeIn = smoothTime - w.begin;
          glow = Math.min(1, timeIn / Math.max(0.001, fadeInDuration));
        } else {
          // Word has finished
          isPast = true;
          pct = '100.0';

          const timeSinceEnd = smoothTime - w.end;
          if (timeSinceEnd < fadeOutDuration) {
            glow = Math.max(0, 1 - timeSinceEnd / fadeOutDuration);
          } else {
            glow = 0;
          }
        }

        const blur = (glow / (1 / maxBlur)).toFixed(1);
        const alpha = (glow / (1 / maxAlpha)).toFixed(3);
        const filterStyle =
          glow > 0.005
            ? 'drop-shadow(0 0 ' + blur + 'px ' + glowColorPrefix + alpha + '))'
            : undefined;

        if (isFuture) {
          return (
            <React.Fragment key={idx}>
              <span style={{ color: dimmedColor }}>{w.text}</span>
              {separator}
            </React.Fragment>
          );
        }

        if (isPast) {
          return (
            <React.Fragment key={idx}>
              <span
                style={{
                  color: solidColor,
                  filter: filterStyle,
                  willChange: glow > 0.005 ? 'filter' : undefined,
                }}
              >
                {w.text}
              </span>
              {separator}
            </React.Fragment>
          );
        }

        // Active word: Smooth liquid gradient fill from left to right with blooming glow
        return (
          <React.Fragment key={idx}>
            <span
              style={{
                backgroundImage:
                  'linear-gradient(to right, ' +
                  solidColor +
                  ' 0%, ' +
                  solidColor +
                  ' ' +
                  pct +
                  '%, ' +
                  dimmedColor +
                  ' ' +
                  pct +
                  '%, ' +
                  dimmedColor +
                  ' 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: filterStyle,
                willChange: 'filter',
              }}
            >
              {w.text}
            </span>
            {separator}
          </React.Fragment>
        );
      })}
    </span>
  );
};
