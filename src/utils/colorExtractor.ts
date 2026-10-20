export interface ExtractedColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
}

const colorCache = new Map<string, ExtractedColors>();

function toHex(n: number): string {
  const clamped = Math.max(0, Math.min(255, Math.round(n)));
  return clamped.toString(16).padStart(2, '0');
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function getFallbackColors(from?: string, to?: string): ExtractedColors {
  const p = from || '#1E1B4B';
  const s = to || '#142347';
  return {
    primary: p,
    secondary: s,
    accent: '#38BDF8',
    background: '#090D16',
  };
}

export function extractColorsFromImage(
  imageUrl?: string | null,
  fallbackFrom?: string,
  fallbackTo?: string
): Promise<ExtractedColors> {
  const fallback = getFallbackColors(fallbackFrom, fallbackTo);
  if (!imageUrl || typeof window === 'undefined') {
    return Promise.resolve(fallback);
  }

  const cached = colorCache.get(imageUrl);
  if (cached) {
    return Promise.resolve(cached);
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    let resolved = false;
    const finish = (result: ExtractedColors) => {
      if (resolved) return;
      resolved = true;
      colorCache.set(imageUrl, result);
      resolve(result);
    };

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          finish(fallback);
          return;
        }

        ctx.drawImage(img, 0, 0, 16, 16);
        const imgData = ctx.getImageData(0, 0, 16, 16);
        const pixels = imgData.data;

        interface Bucket {
          rSum: number;
          gSum: number;
          bSum: number;
          count: number;
          satSum: number;
        }

        const buckets = new Map<number, Bucket>();

        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const a = pixels[i + 3];

          if (a < 128) continue;

          const brightness = (r + g + b) / 3;
          if (brightness < 30 || brightness > 235) continue;

          const maxC = Math.max(r, g, b);
          const minC = Math.min(r, g, b);
          const saturation = maxC - minC;
          if (saturation < 18) continue;

          const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
          const existing = buckets.get(key);
          if (existing) {
            existing.rSum += r;
            existing.gSum += g;
            existing.bSum += b;
            existing.count += 1;
            existing.satSum += saturation;
          } else {
            buckets.set(key, {
              rSum: r,
              gSum: g,
              bSum: b,
              count: 1,
              satSum: saturation,
            });
          }
        }

        if (buckets.size === 0) {
          finish(fallback);
          return;
        }

        const sorted = Array.from(buckets.values()).sort((a, b) => {
          const scoreA = a.count / (1 / (a.satSum / a.count + 1));
          const scoreB = b.count / (1 / (b.satSum / b.count + 1));
          return scoreB - scoreA;
        });

        const top1 = sorted[0];
        const r1 = top1.rSum / top1.count;
        const g1 = top1.gSum / top1.count;
        const b1 = top1.bSum / top1.count;
        const primary = rgbToHex(r1, g1, b1);

        let secondary = fallback.secondary;
        if (sorted.length > 1) {
          const top2 = sorted[1];
          const r2 = top2.rSum / top2.count;
          const g2 = top2.gSum / top2.count;
          const b2 = top2.bSum / top2.count;
          secondary = rgbToHex(r2, g2, b2);
        } else {
          secondary = rgbToHex(b1, r1, g1);
        }

        const boostR = Math.min(255, r1 + 35);
        const boostG = Math.min(255, g1 + 35);
        const boostB = Math.min(255, b1 + 35);
        const accent = rgbToHex(boostR, boostG, boostB);

        finish({
          primary,
          secondary,
          accent,
          background: '#090D16',
        });
      } catch {
        finish(fallback);
      }
    };

    img.onerror = () => {
      finish(fallback);
    };

    img.src = imageUrl;
  });
}
