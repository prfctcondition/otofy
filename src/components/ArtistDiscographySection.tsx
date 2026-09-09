import React from 'react';
import { Disc, Sparkles, User, Play } from 'lucide-react';
import type { ArtistDetails } from '../types';
import { PlaceholderArtwork } from './PlaceholderArtwork';

interface ArtistDiscographySectionProps {
  details: ArtistDetails;
  onSelectAlbum: (browseId?: string, albumTitle?: string, artistName?: string, source?: 'YT' | 'SC') => void;
  onSelectArtist: (artistName: string, source?: 'YT' | 'SC') => void;
}

export const ArtistDiscographySection: React.FC<ArtistDiscographySectionProps> = ({
  details,
  onSelectAlbum,
  onSelectArtist,
}) => {
  const hasAlbums = details.albums && details.albums.length > 0;
  const hasSingles = details.singles && details.singles.length > 0;
  const hasRelated = details.relatedArtists && details.relatedArtists.length > 0;
  const hasBio = Boolean(details.bio && details.bio.trim().length > 0);

  if (!hasAlbums && !hasSingles && !hasRelated && !hasBio) {
    return null;
  }

  const defaultArtistArt = details.avatarUrl || details.topTracks?.[0]?.artworkUrl;

  return (
    <div className="w-full px-6 py-8 space-y-8 select-none">
      {/* Albums & Discography Shelf */}
      {hasAlbums && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
              <Disc size={18} className="text-violet-600" />
              Albums & Discography
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                {details.albums.length}
              </span>
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {details.albums.map((album, idx) => (
              <div
                key={album.browseId || `album-${idx}`}
                onClick={() => onSelectAlbum(album.browseId, album.title, details.artist)}
                className="group relative flex flex-col p-3 rounded-2xl bg-white/50 hover:bg-white/85 border border-white/80 hover:border-white shadow-[0_4px_16px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] backdrop-blur-md transition-all duration-200 cursor-pointer"
              >
                {/* Album Cover Art */}
                <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-slate-900 shadow-sm mb-2.5">
                  <PlaceholderArtwork
                    icon="disc"
                    imageUrl={album.artworkUrl || defaultArtistArt}
                    gradientFrom="#3B82F6"
                    gradientTo="#1E1B4B"
                    size="100%"
                    rounded="rounded-none"
                    className="w-full h-full group-hover:scale-105 transition-transform duration-300"
                  />

                  {/* Play Button Overlay */}
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-white text-[#0F172A] flex items-center justify-center shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform">
                      <Play size={16} fill="currentColor" className="ml-0.5" />
                    </div>
                  </div>
                </div>

                {/* Album Info */}
                <span className="text-xs font-bold text-[#0F172A] truncate leading-tight group-hover:text-violet-700 transition-colors" title={album.title}>
                  {album.title}
                </span>
                <span className="text-[11px] text-[#64748B] mt-0.5">
                  {album.year ? album.year : 'Album'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Singles & EPs Shelf */}
      {hasSingles && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
              <Sparkles size={18} className="text-pink-600" />
              Singles & EPs
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-pink-100 text-pink-700">
                {details.singles!.length}
              </span>
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {details.singles!.map((single, idx) => (
              <div
                key={single.browseId || `single-${idx}`}
                onClick={() => onSelectAlbum(single.browseId, single.title, details.artist)}
                className="group relative flex flex-col p-3 rounded-2xl bg-white/50 hover:bg-white/85 border border-white/80 hover:border-white shadow-[0_4px_16px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] backdrop-blur-md transition-all duration-200 cursor-pointer"
              >
                <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-slate-900 shadow-sm mb-2.5">
                  <PlaceholderArtwork
                    icon="sparkles"
                    imageUrl={single.artworkUrl || defaultArtistArt}
                    gradientFrom="#DB2777"
                    gradientTo="#4C0519"
                    size="100%"
                    rounded="rounded-none"
                    className="w-full h-full group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-white text-[#0F172A] flex items-center justify-center shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform">
                      <Play size={16} fill="currentColor" className="ml-0.5" />
                    </div>
                  </div>
                </div>

                <span className="text-xs font-bold text-[#0F172A] truncate leading-tight group-hover:text-pink-700 transition-colors" title={single.title}>
                  {single.title}
                </span>
                <span className="text-[11px] text-[#64748B] mt-0.5">
                  {single.year ? single.year : 'Single'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Fans Might Also Like (Related Artists) */}
      {hasRelated && (
        <section className="space-y-3">
          <h3 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
            <User size={18} className="text-indigo-600" />
            Fans Might Also Like
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {details.relatedArtists!.map((rel, idx) => (
              <div
                key={rel.channelId || `rel-${idx}`}
                onClick={() => onSelectArtist(rel.name)}
                className="group flex flex-col items-center p-3 rounded-2xl bg-white/50 hover:bg-white/85 border border-white/80 hover:border-white shadow-[0_4px_16px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] backdrop-blur-md transition-all duration-200 cursor-pointer text-center"
              >
                <div className="relative w-20 h-20 rounded-full overflow-hidden bg-slate-800 border-2 border-white shadow-md mb-2 group-hover:scale-105 transition-transform duration-300">
                  <PlaceholderArtwork
                    icon="user"
                    imageUrl={rel.avatarUrl}
                    gradientFrom="#6366F1"
                    gradientTo="#4338CA"
                    size="100%"
                    rounded="rounded-full"
                    className="w-full h-full"
                  />
                </div>
                <span className="text-xs font-bold text-[#0F172A] truncate w-full group-hover:text-indigo-600 transition-colors" title={rel.name}>
                  {rel.name}
                </span>
                <span className="text-[10px] text-[#64748B] mt-0.5 uppercase tracking-wider font-semibold">
                  Artist
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* About the Artist Bio Card */}
      {hasBio && (
        <section className="rounded-2xl p-5 bg-white/60 backdrop-blur-xl border border-white/90 shadow-[0_4px_20px_rgba(0,0,0,0.04)] space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
              About {details.artist}
            </h4>
            {details.subscribers && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-violet-100/80 text-violet-800 border border-violet-200/50">
                {details.subscribers}
              </span>
            )}
          </div>
          <p className="text-xs leading-relaxed text-[#475569] whitespace-pre-line max-h-48 overflow-y-auto pr-2">
            {details.bio}
          </p>
        </section>
      )}
    </div>
  );
};
