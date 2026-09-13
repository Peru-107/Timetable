"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

export interface ChipMenuItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  tone?: "default" | "destructive" | "muted";
}

interface ChipMenuPortalProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  items: ChipMenuItem[];
  onClose: () => void;
}

const TONE_CLASS: Record<NonNullable<ChipMenuItem["tone"]>, string> = {
  default: "text-foreground",
  destructive: "text-destructive",
  muted: "text-muted-foreground",
};

/**
 * Every card in this app uses backdrop-filter (the "frosted" look), and
 * backdrop-filter creates a new CSS stacking context - so a popup nested
 * inside one frosted card can never out-z-index a LATER frosted sibling on
 * the page, no matter how high its z-index is set; the whole card paints as
 * one unit, and the later sibling paints over it. Rendering the menu into
 * document.body via a portal, positioned from the trigger's own bounding
 * rect, sidesteps that entirely - it's a top-level fixed-position element,
 * not a descendant of any card.
 */
export function ChipMenuPortal({ open, anchorEl, items, onClose }: ChipMenuPortalProps) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchorEl) return;
    const updatePosition = () => {
      const rect = anchorEl.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - 192) });
    };
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, anchorEl]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (anchorEl && anchorEl.contains(target)) return;
      onClose();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, anchorEl, onClose]);

  if (!open || !pos || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="menu"
      className="frosted fixed z-50 w-48 overflow-hidden rounded-xl p-1 shadow-lg"
      style={{ top: pos.top, left: pos.left }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          type="button"
          role="menuitem"
          onClick={() => {
            onClose();
            item.onClick();
          }}
          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-black/5 ${TONE_CLASS[item.tone || "default"]}`}
        >
          <item.icon className="h-4 w-4" /> {item.label}
        </button>
      ))}
    </div>,
    document.body
  );
}
