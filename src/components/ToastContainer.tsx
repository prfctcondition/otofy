import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useToastStore, Toast } from '../store/toastStore';

export const ToastContainer: React.FC = () => {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div
      id="toast-container"
      className="fixed top-16 right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

interface ToastItemProps {
  toast: Toast;
  onDismiss: () => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const getIcon = () => {
    switch (toast.type) {
      case 'error':
        return <AlertCircle size={18} className="text-rose-600 shrink-0" />;
      case 'warning':
        return <AlertTriangle size={18} className="text-amber-600 shrink-0" />;
      case 'success':
        return <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />;
      case 'info':
      default:
        return <Info size={18} className="text-sky-600 shrink-0" />;
    }
  };

  const getBorderColor = () => {
    switch (toast.type) {
      case 'error':
        return 'border-rose-300/80 bg-white/90 text-rose-950 shadow-[0_10px_25px_-5px_rgba(244,63,94,0.15),0_4px_10px_rgba(0,0,0,0.05)]';
      case 'warning':
        return 'border-amber-300/80 bg-white/90 text-amber-950 shadow-[0_10px_25px_-5px_rgba(245,158,11,0.15),0_4px_10px_rgba(0,0,0,0.05)]';
      case 'success':
        return 'border-emerald-300/80 bg-white/90 text-emerald-950 shadow-[0_10px_25px_-5px_rgba(16,185,129,0.15),0_4px_10px_rgba(0,0,0,0.05)]';
      case 'info':
      default:
        return 'border-white/90 bg-white/90 text-[#0F172A] shadow-[0_10px_25px_-5px_rgba(0,0,0,0.12),0_4px_10px_rgba(0,0,0,0.05)]';
    }
  };

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl border backdrop-blur-2xl transition-all duration-200 transform translate-y-0 opacity-100 animate-in fade-in slide-in-from-top-2 ${getBorderColor()}`}
      role="alert"
    >
      <div className="pt-0.5">{getIcon()}</div>
      <div className="flex-1 min-w-0 pr-1">
        <h5 className="text-xs font-bold leading-tight">{toast.title}</h5>
        {toast.message && (
          <p className="text-[11px] opacity-80 mt-1 leading-snug break-words">
            {toast.message}
          </p>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="p-1 rounded-full opacity-60 hover:opacity-100 hover:bg-black/5 transition-opacity"
        title="Dismiss"
        aria-label="Close notification"
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default ToastContainer;
