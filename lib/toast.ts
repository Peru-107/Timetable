"use client";

/**
 * A tiny app-wide toast bus: any component can call showToast(), and the
 * single <Toaster /> in the root layout renders it. One toast at a time -
 * a new one replaces the old, which is what an "Undo" affordance wants.
 */
export interface ToastOptions {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Milliseconds before it hides itself. */
  duration?: number;
}

type Listener = (toast: (ToastOptions & { id: number }) | null) => void;

const listeners = new Set<Listener>();
let nextId = 1;

export function showToast(options: ToastOptions) {
  const toast = { ...options, id: nextId++ };
  listeners.forEach((l) => l(toast));
}

export function hideToast() {
  listeners.forEach((l) => l(null));
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
