import React, { useState, useRef } from 'react';
import { Plus, X, Upload, Trash2 } from 'lucide-react';
import { useLibraryStore } from '../store/libraryStore';

interface CreatePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GRADIENTS = [
  { from: '#8B5CF6', to: '#4F46E5', name: 'Violet Indigo' },
  { from: '#38BDF8', to: '#06B6D4', name: 'Sky Cyan' },
  { from: '#34D399', to: '#0D9488', name: 'Emerald Teal' },
  { from: '#FB7185', to: '#F97316', name: 'Rose Orange' },
  { from: '#E879F9', to: '#C026D3', name: 'Fuchsia Pink' },
  { from: '#FBBF24', to: '#EAB308', name: 'Amber Yellow' },
  { from: '#475569', to: '#0F172A', name: 'Slate Dark' },
];

export const CreatePlaylistModal: React.FC<CreatePlaylistModalProps> = ({ isOpen, onClose }) => {
  const [title, setTitle] = useState('');
  const [creator, setCreator] = useState('You');
  const [selectedGradient, setSelectedGradient] = useState(0);
  const [customArtwork, setCustomArtwork] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createPlaylist = useLibraryStore((state) => state.createPlaylist);

  if (!isOpen) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 500;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const minDim = Math.min(img.width, img.height);
          const startX = (img.width - minDim) / 2;
          const startY = (img.height - minDim) / 2;
          ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, size, size);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
          setCustomArtwork(dataUrl);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleCreate = () => {
    if (!title.trim()) return;

    createPlaylist({
      title: title.trim(),
      creator: creator.trim() || 'You',
      gradientFrom: GRADIENTS[selectedGradient].from,
      gradientTo: GRADIENTS[selectedGradient].to,
      artworkUrl: customArtwork || undefined,
    });

    handleClose();
  };

  const handleClose = () => {
    setTitle('');
    setCreator('You');
    setSelectedGradient(0);
    setCustomArtwork(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const currentGrad = GRADIENTS[selectedGradient];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white/95 dark:bg-[#0C0C10] backdrop-blur-3xl border border-white dark:border-white/10 rounded-3xl w-full max-w-md flex flex-col p-6 m-4 relative shadow-[0_25px_60px_rgba(0,0,0,0.18),inset_0_1px_2px_#FFFFFF] dark:shadow-[0_25px_60px_rgba(0,0,0,0.8)]">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl text-white shadow-md">
              <Plus size={22} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#0F172A] dark:text-white leading-tight">Create Playlist</h2>
              <p className="text-xs text-[#64748B] dark:text-white/60">Personalize your music collection</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-[#64748B] dark:text-white/70 hover:text-[#0F172A] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#64748B] dark:text-white/60 uppercase tracking-wider mb-1.5 ml-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My Awesome Playlist"
              className="w-full px-4 py-3 bg-slate-50 dark:bg-white/[0.06] border border-slate-200 dark:border-white/15 focus:bg-white dark:focus:bg-white/[0.1] focus:border-violet-500 rounded-xl focus:outline-none text-[#0F172A] dark:text-white font-semibold text-sm placeholder:font-normal placeholder:text-slate-400 dark:placeholder:text-white/40 shadow-xs transition-all"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#64748B] dark:text-white/60 uppercase tracking-wider mb-1.5 ml-1">
              Creator
            </label>
            <input
              type="text"
              value={creator}
              onChange={(e) => setCreator(e.target.value)}
              placeholder="You"
              className="w-full px-4 py-3 bg-slate-50 dark:bg-white/[0.06] border border-slate-200 dark:border-white/15 focus:bg-white dark:focus:bg-white/[0.1] focus:border-violet-500 rounded-xl focus:outline-none text-[#0F172A] dark:text-white font-semibold text-sm placeholder:font-normal placeholder:text-slate-400 dark:placeholder:text-white/40 shadow-xs transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#64748B] dark:text-white/60 uppercase tracking-wider mb-2 ml-1">
              Theme Color
            </label>
            <div className="flex gap-2.5 flex-wrap">
              {GRADIENTS.map((grad, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setSelectedGradient(idx);
                  }}
                  style={{
                    background: `linear-gradient(135deg, ${grad.from} 0%, ${grad.to} 100%)`,
                  }}
                  className={`w-9 h-9 rounded-full transition-all shadow-xs cursor-pointer ${
                    selectedGradient === idx && !customArtwork
                      ? 'scale-110 ring-3 ring-violet-500 ring-offset-2 ring-offset-white dark:ring-offset-black'
                      : 'hover:scale-105 opacity-80 hover:opacity-100'
                  }`}
                  title={grad.name}
                />
              ))}
            </div>
          </div>

          {/* Custom Artwork Upload */}
          <div>
            <label className="block text-xs font-bold text-[#64748B] dark:text-white/60 uppercase tracking-wider mb-2 ml-1">
              Custom Cover (1:1 Square)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
              onChange={handleImageUpload}
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-dashed border-slate-300 dark:border-white/20 bg-slate-50 hover:bg-slate-100 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-xs font-medium text-slate-700 dark:text-white/80 transition-all cursor-pointer"
              >
                <Upload size={14} />
                <span>{customArtwork ? 'Change Image' : 'Upload Image (PNG, JPG, WEBP)'}</span>
              </button>
              {customArtwork && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomArtwork(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                >
                  <Trash2 size={13} />
                  <span>Remove Cover</span>
                </button>
              )}
            </div>
          </div>

          {/* Live Preview Card */}
          <div className="mt-4 p-4 rounded-2xl bg-white dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/10 shadow-xs flex items-center gap-4">
            {customArtwork ? (
              <img
                src={customArtwork}
                alt="Playlist cover"
                className="w-14 h-14 rounded-xl object-cover shadow-md shrink-0 border border-white/10"
              />
            ) : (
              <div
                style={{
                  background: `linear-gradient(135deg, ${currentGrad.from} 0%, ${currentGrad.to} 100%)`,
                }}
                className="w-14 h-14 rounded-xl shadow-md flex items-center justify-center text-white shrink-0"
              >
                <Plus size={22} className="opacity-80" />
              </div>
            )}
            <div className="min-w-0">
              <h4 className="font-bold text-[#0F172A] dark:text-white text-base truncate">
                {title || 'Playlist Title'}
              </h4>
              <p className="text-xs text-[#64748B] dark:text-white/60 truncate">by {creator || 'You'}</p>
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={!title.trim()}
            className="w-full py-3.5 mt-4 px-4 bg-[#0F172A] hover:bg-black dark:bg-white dark:text-black dark:hover:bg-white/90 active:scale-[0.99] text-white rounded-xl text-sm font-bold shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Create Playlist
          </button>
        </div>
      </div>
    </div>
  );
};
