import { create } from 'zustand';

export type ToastType = 'error' | 'warning' | 'info' | 'success';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  error: (title: string, message?: string, duration?: number) => void;
  warning: (title: string, message?: string, duration?: number) => void;
  success: (title: string, message?: string, duration?: number) => void;
  info: (title: string, message?: string, duration?: number) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).slice(2, 9);
    const newToast: Toast = { ...toast, id, duration: toast.duration ?? 4500 };
    set((state) => ({ toasts: [...state.toasts, newToast] }));

    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
      }, newToast.duration);
    }
    return id;
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  error: (title, message, duration) => {
    useToastStore.getState().addToast({ type: 'error', title, message, duration: duration ?? 5000 });
  },
  warning: (title, message, duration) => {
    useToastStore.getState().addToast({ type: 'warning', title, message, duration: duration ?? 4000 });
  },
  success: (title, message, duration) => {
    useToastStore.getState().addToast({ type: 'success', title, message, duration: duration ?? 3500 });
  },
  info: (title, message, duration) => {
    useToastStore.getState().addToast({ type: 'info', title, message, duration: duration ?? 3500 });
  },
}));

export default useToastStore;
