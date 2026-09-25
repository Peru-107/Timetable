"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { hideToast, subscribeToasts, type ToastOptions } from "@/lib/toast";

export function Toaster() {
  const [toast, setToast] = useState<(ToastOptions & { id: number }) | null>(null);

  useEffect(() => subscribeToasts(setToast), []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), toast.duration ?? 5000);
    return () => clearTimeout(id);
  }, [toast]);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 lg:bottom-6"
    >
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 500, damping: 36 }}
            role="status"
            className="pointer-events-auto flex max-w-md items-center gap-4 rounded-2xl bg-foreground px-4 py-3 text-sm font-medium text-background shadow-xl"
          >
            <span>{toast.message}</span>
            {toast.actionLabel && toast.onAction && (
              <button
                type="button"
                onClick={() => {
                  toast.onAction?.();
                  hideToast();
                }}
                className="rounded-lg px-2 py-1 font-semibold text-primary hover:bg-background/10"
                style={{ color: "color-mix(in srgb, var(--primary) 70%, var(--background))" }}
              >
                {toast.actionLabel}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
