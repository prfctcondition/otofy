import React from 'react';
import { splitArtists } from '../utils/trackUtils';

interface ArtistLinksProps {
  artist: string;
  artists?: string[];
  source?: 'YT' | 'SC';
  browseId?: string;
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
  onSelectArtist,
  className = 'text-xs text-[#64748B] dark:text-white/80 truncate',
  artistClassName = 'cursor-pointer hover:underline hover:text-[#0F172A] dark:hover:text-white transition-colors',
  separatorClassName = 'text-[#94A3B8] dark:text-white/40',
  prefix,
  suffix,
}) => {
  const artists = splitArtists(artist, explicitArtists);
  if (!artists.length) return null;

  return (
    <span className={className}>
      {prefix}
      {artists.map((art, idx) => (
        <React.Fragment key={`${art}-${idx}`}>
          <span
            className={artistClassName}
            title={`View ${art}`}
            onClick={(e) => {
              e.stopPropagation();
              onSelectArtist?.(art, source, idx === 0 ? browseId : undefined);
            }}
          >
            {art}
          </span>
          {idx < artists.length - 1 && <span className={separatorClassName}>, </span>}
        </React.Fragment>
      ))}
      {suffix}
    </span>
  );
};

export default ArtistLinks;
