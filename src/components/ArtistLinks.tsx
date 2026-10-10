import React from 'react';
import { splitArtists } from '../utils/trackUtils';

interface ArtistLinksProps {
  artist: string;
  artists?: string[];
  source?: 'YT' | 'SC';
  browseId?: string;
  artistBrowseIds?: Record<string, string>;
  onSelectArtist?: (artist: string, source?: 'YT' | 'SC', browseId?: string) => void;
  className?: string;
  artistClassName?: string;
  separatorClassName?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}

export const ArtistLinks: React.FC<ArtistLinksProps> = ({
  artist,
  artists: explicitArtists,
  source = 'YT',
  browseId,
  artistBrowseIds,
  onSelectArtist,
  className = 'text-xs text-[#64748B] dark:text-white/80 truncate',
  artistClassName = 'cursor-pointer hover:underline hover:text-[#142347] dark:hover:text-white transition-colors',
  separatorClassName = 'text-[#94A3B8] dark:text-white/40',
  prefix,
  suffix,
}) => {
  const artists = splitArtists(artist, explicitArtists);
  if (!artists.length) return null;

  return (
    <span className={className}>
      {prefix}
      {artists.map((art, idx) => {
        const resolvedBrowseId =
          artistBrowseIds?.[art] ||
          artistBrowseIds?.[art.toLowerCase()] ||
          (idx === 0 ? browseId : undefined);
        return (
          <React.Fragment key={`${art}-${idx}`}>
            <span
              className={artistClassName}
              title={`View ${art}`}
              draggable={false}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onSelectArtist?.(art, source, resolvedBrowseId);
              }}
            >
              {art}
            </span>
            {idx < artists.length - 1 && <span className={separatorClassName}>, </span>}
          </React.Fragment>
        );
      })}
      {suffix}
    </span>
  );
};

export default ArtistLinks;
