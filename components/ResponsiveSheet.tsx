"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useDragControls, type PanInfo } from "motion/react";
import { X } from "lucide-react";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";

interface ResponsiveSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Classes for the inline card used from the `sm` breakpoint up. */
  inlineClassName?: string;
}

/**
 * A form surface that fits the device: on phones it slides up as a bottom
 * sheet (drag down or tap outside to dismiss) so a long form doesn't push
 * the page around under your thumb; from `sm` up it stays an inline card
 * in the page, exactly where it was before.
 */
export function ResponsiveSheet({
  open,
  onClose,
  title,
  children,
  inlineClassName = "frosted mb-8 rounded-2xl p-6",
}: ResponsiveSheetProps) {
  const isPhone = useMediaQuery("(max-width: 639px)");
  // Only the handle/title row starts a drag, so scrolling the form body
  // (and dragging inside inputs) never fights with dismissing the sheet.
  const dragControls = useDragControls();

  useEffect(() => {
    if (!open || !isPhone) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, isPhone, onClose]);

  if (!isPhone) {
    return (
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="inline-sheet"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className={inlineClassName}
          >
            <h2 className="mb-4 text-xl font-semibold text-foreground">{title}</h2>
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50" key="sheet-root">
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-3xl border-t border-border bg-background shadow-2xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 40 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            dragListener={false}
            dragControls={dragControls}
            onDragEnd={handleDragEnd}
          >
            <SheetHeader
              title={title}
              onClose={onClose}
              onHandlePointerDown={(e) => dragControls.start(e)}
            />
            <div className="overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/** The grab handle + title row; dragging it down dismisses the sheet. */
function SheetHeader({
  title,
  onClose,
  onHandlePointerDown,
}: {
  title: string;
  onClose: () => void;
  onHandlePointerDown: (e: React.PointerEvent) => void;
}) {
  return (
    <div
      className="cursor-grab touch-none px-5 pb-3 pt-2 active:cursor-grabbing"
      onPointerDown={(e) => {
        // Let the close button be a plain click.
        if ((e.target as HTMLElement).closest("button")) return;
        onHandlePointerDown(e);
      }}
    >
      <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted-foreground/30" />
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
