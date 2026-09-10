import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  Code2,
  FileCode,
  Sparkles,
  Download,
} from 'lucide-react';
import { FLUTTER_DELIVERABLES } from '../data/flutterCode';

interface FlutterCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FlutterCodeModal: React.FC<FlutterCodeModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const currentFile = FLUTTER_DELIVERABLES[activeTab];

  const handleCopy = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleDownloadAll = () => {
    FLUTTER_DELIVERABLES.forEach((file) => {
      const blob = new Blob([file.code], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200">
      <div
        id="flutter-code-modal"
        className="relative w-full max-w-5xl h-[88vh] flex flex-col bg-white/95 backdrop-blur-2xl border border-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.08] bg-white/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-slate-700 to-slate-900 flex items-center justify-center text-white shadow-md">
              <Code2 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#111827] tracking-tight">
                  Flutter iOS Liquid White Glass Architecture
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200 shadow-sm">
                  Flutter 3.x+ Null-Safe
                </span>
              </div>
              <p className="text-xs text-[#6B7280]">
                6 drop-in production-ready files with dedicated liquid_glass_panel.dart, blur filtering, and edge lighting.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadAll}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-slate-100 text-xs font-semibold text-[#111827] border border-black/10 shadow-sm transition-all active:scale-95"
              title="Download all 6 files"
            >
              <Download size={14} />
              <span>Download All</span>
            </button>
            <button
              id="close-flutter-modal-btn"
              onClick={onClose}
              className="p-2 rounded-full text-[#6B7280] hover:text-[#111827] hover:bg-black/5 transition-colors"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 px-6 pt-3 bg-slate-50/80 border-b border-black/[0.08] overflow-x-auto no-scrollbar">
          {FLUTTER_DELIVERABLES.map((file, idx) => {
            const isActive = activeTab === idx;
            return (
              <button
                key={file.name}
                onClick={() => setActiveTab(idx)}
                className={`flex items-center gap-2 px-4 py-2 rounded-t-xl text-xs font-semibold whitespace-nowrap transition-all border-b-2 ${
                  isActive
                    ? 'bg-white text-[#111827] border-slate-800 shadow-sm'
                    : 'text-[#6B7280] hover:text-[#111827] border-transparent hover:bg-white/50'
                }`}
              >
                <FileCode size={14} className={isActive ? 'text-slate-900' : 'text-[#9CA3AF]'} />
                <span>{file.name}</span>
              </button>
            );
          })}
        </div>

        {/* Sub-header description of active file */}
        <div className="flex items-center justify-between px-6 py-2.5 bg-white border-b border-black/[0.06]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#111827]">{currentFile.name}</span>
            <span className="text-[#9CA3AF]">•</span>
            <span className="text-xs text-[#6B7280]">{currentFile.description}</span>
          </div>

          <button
            onClick={() => handleCopy(currentFile.code, activeTab)}
            className="flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#111827] hover:bg-black text-white text-xs font-bold transition-all shadow-sm active:scale-95"
          >
            {copiedIndex === activeTab ? (
              <>
                <Check size={13} />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy size={13} />
                <span>Copy Code</span>
              </>
            )}
          </button>
        </div>

        {/* Code Content Area */}
        <div className="flex-1 p-6 overflow-y-auto bg-[#0F172A] font-mono text-xs leading-relaxed text-slate-200">
          <pre className="selection:bg-slate-500/40 selection:text-white">
            <code>{currentFile.code}</code>
          </pre>
        </div>

        {/* Footer info note */}
        <div className="px-6 py-3 bg-white/90 border-t border-black/[0.08] flex items-center justify-between text-xs text-[#6B7280]">
          <div className="flex items-center gap-2">
            <Sparkles size={13} className="text-slate-900" />
            <span>
              Engineered with <code className="text-[#111827] font-semibold">BackdropFilter</code>, directional specular gradient borders, and inner sheen reflection.
            </span>
          </div>
          <span className="font-mono text-[11px] text-[#9CA3AF]">lib/ui/{currentFile.name}</span>
        </div>
      </div>
    </div>
  );
};
