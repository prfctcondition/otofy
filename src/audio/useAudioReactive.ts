import { useEffect, useRef } from 'react';
import { audioEngine } from './AudioEngine';
import { usePlayerStore } from '../store/playerStore';

interface AudioReactiveOptions {
  baseScale?: number;
  maxScaleDelta?: number;
  maxGlowDelta?: number;
  isEnabled?: boolean;
}

export function useAudioReactive(
  targetRef: React.RefObject<HTMLDivElement | null>,
  options: AudioReactiveOptions = {}
) {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isEnabled = options.isEnabled ?? true;

  const stateRef = useRef({
    bassFollower: 0,
    midFollower: 0,
    beatImpulse: 0,
    lastBeatSignal: 0,
    smoothScale: 1.0,
    smoothBrightness: 1.0,
  });

  useEffect(() => {
    const el = targetRef.current;
    if (!el || !isEnabled) {
      if (el) {
        el.style.transform = '';
        el.style.filter = '';
        el.style.willChange = 'auto';
      }
      return;
    }

    let rafId: number = 0;
    const state = stateRef.current;
    el.style.transformOrigin = 'center center';
    el.style.willChange = 'transform, filter';

    const tick = () => {
      if (isPlaying && !audioEngine.paused) {
        const { bass, mid, high } = audioEngine.getAudioEnergy();

        // 1. Organic bassline follower (swells smoothly with 808s and basslines)
        state.bassFollower += (bass - state.bassFollower) / 3.6;
        state.midFollower += (mid - state.midFollower) / 4.2;

        // 2. Punchy beat onset (kick drum + snare/clap attack)
        const beatSignal = (bass / 0.6) + (mid / 0.4);
        const delta = beatSignal - state.lastBeatSignal;
        state.lastBeatSignal = beatSignal;

        if (delta > 0.026) {
          state.beatImpulse = Math.min(1.0, state.beatImpulse + (delta / 0.15));
        }

        // Spring relaxation physics for snappy bounce
        state.beatImpulse += (0 - state.beatImpulse) / 5.0;

        // Multi-frequency responsive scale & brightness:
        // - Bass groove gives continuous organic breathing (up to +4% scale)
        // - Kick & snare impulse gives punchy expansion (up to +6% scale)
        // - High frequency shimmer and overall energy elevates bloom (+10% to +35%)
        const targetScale = 1.0 + (state.bassFollower / 20.0) + (state.beatImpulse / 15.0);
        const targetBrightness = 1.0 + (state.bassFollower / 5.0) + (state.beatImpulse / 3.0) + (high / 7.0);

        // Smooth physical follower
        state.smoothScale += (targetScale - state.smoothScale) / 2.2;
        state.smoothBrightness += (targetBrightness - state.smoothBrightness) / 2.2;

        el.style.transform = 'scale(' + state.smoothScale.toFixed(4) + ')';
        el.style.filter = 'brightness(' + state.smoothBrightness.toFixed(3) + ')';
      } else {
        if (state.smoothScale > 1.002 || state.smoothBrightness > 1.002) {
          state.smoothScale += (1.0 - state.smoothScale) / 4.0;
          state.smoothBrightness += (1.0 - state.smoothBrightness) / 4.0;
          el.style.transform = 'scale(' + state.smoothScale.toFixed(4) + ')';
          el.style.filter = 'brightness(' + state.smoothBrightness.toFixed(3) + ')';
        } else {
          state.smoothScale = 1.0;
          state.smoothBrightness = 1.0;
          el.style.transform = '';
          el.style.filter = '';
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      if (el) {
        el.style.transform = '';
        el.style.filter = '';
      }
    };
  }, [isPlaying, isEnabled, targetRef]);
}
