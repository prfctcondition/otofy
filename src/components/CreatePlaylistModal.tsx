import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useLibraryStore } from '../store/libraryStore';

interface CreatePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GRADIENTS = [
  { from: 'from-violet-500', to: 'to-indigo-600', hex: '#6366F1' },
  { from: 'from-blue-400', to: 'to-cyan-500', hex: '#06B6D4' },
  { from: 'from-emerald-400', to: 'to-teal-600', hex: '#10B981' },
  { from: 'from-rose-400', to: 'to-orange-500', hex: '#F43F5E' },
  { from: 'from-fuchsia-500', to: 'to-pink-600', hex: '#D946EF' },
  { from: 'from-amber-400', to: 'to-yellow-500', hex: '#F59E0B' },
  { from: 'from-slate-700', to: 'to-slate-900', hex: '#334155' },
];

export const CreatePlaylistModal: React.FC<CreatePlaylistModalProps> = ({ isOpen, onClose }) => {
  const [title, setTitle] = useState('');
  const [creator, setCreator] = useState('You');
  const [selectedGradient, setSelectedGradient] = useState(0);
  const createPlaylist = useLibraryStore((state) => state.createPlaylist);

  if (!isOpen) return null;

  const handleCreate = () => {
    if (!title.trim()) return;

    createPlaylist({
      title: title.trim(),
      creator: creator.trim() || 'You',
      gradientFrom: GRADIENTS[selectedGradient].from,
      gradientTo: GRADIENTS[selectedGradient].to,
    });

    setTitle('');
    setCreator('You');
    setSelectedGradient(0);
    onClose();
  };

  const handleClose = () => {
    setTitle('');
    setCreator('You');
    setSelectedGradient(0);
    onClose();
  };

  const currentGrad = GRADIENTS[selectedGradient];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white/92 backdrop-blur-3xl border border-white rounded-3xl w-full max-w-md flex flex-col p-6 m-4 relative shadow-[0_25px_60px_rgba(0,0,0,0.18),inset_0_1px_2px_#FFFFFF]">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl text-white shadow-md">
              <Plus size={22} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#0F172A] leading-tight">Create Playlist</h2>
              <p className="text-xs text-[#64748B]">Personalize your music collection</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1.5 ml-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My Awesome Playlist"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:border-violet-500 rounded-xl focus:outline-none text-[#0F172A] font-semibold text-sm placeholder:font-normal placeholder:text-slate-400 shadow-xs transition-all"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1.5 ml-1">
              Creator
            </label>
            <input
              type="text"
              value={creator}
              onChange={(e) => setCreator(e.target.value)}
              placeholder="You"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:border-violet-500 rounded-xl focus:outline-none text-[#0F172A] font-semibold text-sm placeholder:font-normal placeholder:text-slate-400 shadow-xs transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2 ml-1">
              Theme
            </label>
            <div className="flex gap-2.5 flex-wrap">
              {GRADIENTS.map((grad, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedGradient(idx)}
                  className={`w-9 h-9 rounded-full bg-gradient-to-br ${grad.from} ${grad.to} transition-all shadow-xs ${
                    selectedGradient === idx
                      ? 'scale-110 ring-3 ring-violet-500 ring-offset-2 ring-offset-white'
                      : 'hover:scale-105 opacity-80 hover:opacity-100'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Live Preview Card */}
          <div className="mt-4 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-4">
            <div
              className={`w-14 h-14 rounded-xl shadow-md bg-gradient-to-br ${currentGrad.from} ${currentGrad.to} flex items-center justify-center text-white shrink-0`}
            >
              <Plus size={22} className="opacity-80" />
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-[#0F172A] text-base truncate">
                {title || 'Playlist Title'}
              </h4>
              <p className="text-xs text-[#64748B] truncate">by {creator || 'You'}</p>
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={!title.trim()}
            className="w-full py-3.5 mt-4 px-4 bg-[#0F172A] hover:bg-black active:scale-[0.99] text-white rounded-xl text-sm font-bold shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Create Playlist
          </button>
        </div>
      </div>
    </div>
  );
};
