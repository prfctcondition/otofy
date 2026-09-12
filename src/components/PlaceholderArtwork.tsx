import React from 'react';
import {
  Disc,
  Music,
  Waves,
  Headphones,
  Radio,
  Mic,
  Zap,
  Sparkles,
  Flame,
  Heart,
  User,
  Sliders,
  Download,
  History,
} from 'lucide-react';
import { IconType } from '../types';

interface PlaceholderArtworkProps {
  icon: IconType;
  imageUrl?: string;
  source?: string;
  sourceId?: string;
  gradientFrom?: string;
  gradientTo?: string;
  size?: number | string; // e.g. 40, 48, 56, 120, 240
  iconSize?: number;
  rounded?: string;
  className?: string;
  specularBorder?: boolean;
}

const failedImageUrls = new Set<string>();

const extractYtVideoId = (str?: string): string | undefined => {
  if (!str || typeof str !== 'string') return undefined;
  const trimmed = str.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const withoutPrefix = trimmed.replace(/^(yt|sc)[-_]/i, '').trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(withoutPrefix)) return withoutPrefix;
  const vMatch = trimmed.match(/(?:v=|\/vi\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (vMatch) return vMatch[1];
  const endMatch = trimmed.match(/[-_]([a-zA-Z0-9_-]{11})$/);
  if (endMatch) return endMatch[1];
  return undefined;
};

export const PlaceholderArtwork: React.FC<PlaceholderArtworkProps> = React.memo(({
  icon,
  imageUrl,
  source,
  sourceId,
  gradientFrom = '#1E1E24',
  gradientTo = '#0E0E12',
  size = 40,
  iconSize,
  rounded = 'rounded-md',
  className = '',
  specularBorder = true,
}) => {
  const [imageError, setImageError] = React.useState(false);

  const ytFallbackUrl = React.useMemo(() => {
    const vId = extractYtVideoId(sourceId) || extractYtVideoId(imageUrl);
    const isYtSource = source === 'YT' || source?.toLowerCase().includes('youtube') || Boolean(vId);
    if (vId && isYtSource) {
      const url = `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`;
      return failedImageUrls.has(url) ? undefined : url;
    }
    return undefined;
  }, [source, sourceId, imageUrl]);

  const normalizedImgUrl = React.useMemo(() => {
    if (!imageUrl || typeof imageUrl !== 'string') return undefined;
    let clean = imageUrl.trim();
    if (clean.startsWith('//')) {
      clean = `https:${clean}`;
    }
    return failedImageUrls.has(clean) ? undefined : clean;
  }, [imageUrl]);

  const [currentImgUrl, setCurrentImgUrl] = React.useState<string | undefined>(
    normalizedImgUrl || ytFallbackUrl
  );

  React.useEffect(() => {
    setImageError(false);
    setCurrentImgUrl(normalizedImgUrl || ytFallbackUrl);
  }, [normalizedImgUrl, ytFallbackUrl]);

  const handleImageError = () => {
    if (currentImgUrl) {
      failedImageUrls.add(currentImgUrl);
    }
    if (currentImgUrl !== ytFallbackUrl && ytFallbackUrl) {
      setCurrentImgUrl(ytFallbackUrl);
    } else {
      setImageError(true);
    }
  };

  const computedSize = typeof size === 'number' ? `${size}px` : size;
  const computedIconSize = iconSize ?? (typeof size === 'number' ? Math.round(size * 0.44) : 20);

  const hasImage = Boolean(currentImgUrl && !imageError);

  const renderIcon = () => {
    const props = {
      size: computedIconSize,
      className: 'text-white/80 drop-shadow-sm transition-transform duration-300 group-hover:scale-105',
    };

    switch (icon) {
      case 'disc':
        return <Disc {...props} />;
      case 'music':
        return <Music {...props} />;
      case 'waves':
        return <Waves {...props} />;
      case 'headphones':
        return <Headphones {...props} />;
      case 'radio':
        return <Radio {...props} />;
      case 'mic':
        return <Mic {...props} />;
      case 'zap':
        return <Zap {...props} />;
      case 'sparkles':
        return <Sparkles {...props} />;
      case 'flame':
        return <Flame {...props} />;
      case 'heart':
        return <Heart {...props} fill="currentColor" />;
      case 'user':
        return <User {...props} />;
      case 'sliders':
        return <Sliders {...props} />;
      case 'download':
        return <Download {...props} />;
      case 'history':
        return <History {...props} />;
      default:
        return <Music {...props} />;
    }
  };

  return (
    <div
      className={`relative shrink-0 overflow-hidden flex items-center justify-center select-none ${rounded} ${className}`}
      style={{
        width: computedSize,
        height: computedSize,
        background: hasImage ? '#0F172A' : `linear-gradient(135deg, ${gradientFrom} 0%, ${gradientTo} 100%)`,
      }}
    >
      {/* Real Image Artwork */}
      {hasImage && (
        <img
          src={currentImgUrl}
          alt="Artwork"
          onError={handleImageError}
          className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none"
          draggable={false}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
        />
      )}

      {/* Subtle Specular Sheen Diagonal Reflection */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.18] via-transparent to-black/30 z-10" />

      {/* Hair-thin 0.5px Specular Border */}
      {specularBorder && (
        <div className="pointer-events-none absolute inset-0 rounded-[inherit] border border-white/[0.15] z-10" />
      )}

      {/* Minimal Monochrome Icon Fallback */}
      {!hasImage && <div className="relative z-10">{renderIcon()}</div>}
    </div>
  );
});
