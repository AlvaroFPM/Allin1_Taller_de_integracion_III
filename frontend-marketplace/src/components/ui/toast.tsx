'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItemData {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

export interface ToastOptions {
  title?: string;
  duration?: number;
}

type ToastListener = (toasts: ToastItemData[]) => void;
let listeners: ToastListener[] = [];
let memoryToasts: ToastItemData[] = [];

function notifyListeners() {
  listeners.forEach((listener) => listener([...memoryToasts]));
}

export const toast = {
  show(type: ToastType, message: string, options?: ToastOptions) {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastItemData = {
      id,
      type,
      message,
      title: options?.title,
      duration: options?.duration ?? 4000,
    };
    memoryToasts = [...memoryToasts, newToast];
    notifyListeners();
    return id;
  },
  success(message: string, options?: ToastOptions) {
    return this.show('success', message, options);
  },
  error(message: string, options?: ToastOptions) {
    return this.show('error', message, options);
  },
  warning(message: string, options?: ToastOptions) {
    return this.show('warning', message, options);
  },
  info(message: string, options?: ToastOptions) {
    return this.show('info', message, options);
  },
  dismiss(id: string) {
    memoryToasts = memoryToasts.filter((t) => t.id !== id);
    notifyListeners();
  },
};

const ICONS: Record<ToastType, React.ReactNode> = {
  success: (
    <svg
      className="w-4 h-4 text-emerald-600 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg
      className="w-4 h-4 text-red-600 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  ),
  warning: (
    <svg
      className="w-4 h-4 text-amber-600 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  ),
  info: (
    <svg
      className="w-4 h-4 text-blue-600 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
};

const STYLES: Record<ToastType, { border: string; iconBg: string }> = {
  success: { border: 'border-emerald-500/30', iconBg: 'bg-emerald-50' },
  error: { border: 'border-red-500/30', iconBg: 'bg-red-50' },
  warning: { border: 'border-amber-500/30', iconBg: 'bg-amber-50' },
  info: { border: 'border-blue-500/30', iconBg: 'bg-blue-50' },
};

export function ToastItem({
  data,
  onDismiss,
}: {
  data: ToastItemData;
  onDismiss: (id: string) => void;
}) {
  React.useEffect(() => {
    if (!data.duration) return;
    const timer = setTimeout(() => {
      onDismiss(data.id);
    }, data.duration);
    return () => clearTimeout(timer);
  }, [data, onDismiss]);

  const style = STYLES[data.type];

  return (
    <div
      role="alert"
      className={cn(
        'pointer-events-auto w-full max-w-sm rounded-2xl bg-surface-main p-3.5 shadow-lg border transition-all duration-200',
        'flex items-start gap-3 text-left animate-in fade-in slide-in-from-bottom-3',
        style.border,
      )}
    >
      <div
        className={cn(
          'w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5',
          style.iconBg,
        )}
      >
        {ICONS[data.type]}
      </div>

      <div className="flex-1 min-w-0 pr-1">
        {data.title && (
          <p className="text-xs font-bold text-content-main leading-snug truncate">{data.title}</p>
        )}
        <p className="text-xs text-content-main/90 leading-relaxed wrap-break-word">
          {data.message}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onDismiss(data.id)}
        className="text-content-muted hover:text-content-main p-1 rounded-lg hover:bg-surface-base transition-colors shrink-0 cursor-pointer"
        aria-label="Cerrar notificación"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}

export function ToastContainer() {
  const [toasts, setToasts] = React.useState<ToastItemData[]>([]);

  React.useEffect(() => {
    listeners.push(setToasts);
    return () => {
      listeners = listeners.filter((l) => l !== setToasts);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((item) => (
        <ToastItem key={item.id} data={item} onDismiss={(id) => toast.dismiss(id)} />
      ))}
    </div>
  );
}
