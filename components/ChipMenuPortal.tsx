"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface ChipMenuItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  tone?: "default" | "destructive" | "muted";
}

interface ChipMenuPortalProps {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
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
export function ChipMenuPortal({ open, anchorRef, items, onClose }: ChipMenuPortalProps) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Closing must hand focus back to the trigger - otherwise a keyboard user
  // who opened the menu loses their place once it's gone.
  const close = () => {
    onClose();
    anchorRef.current?.focus();
  };

  useLayoutEffect(() => {
    const anchorEl = anchorRef.current;
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
  }, [open, anchorRef]);

  // The portal renders at the end of <body>, well outside the trigger's tab
  // order, so opening it must move focus in explicitly or a keyboard user
  // can never reach it at all.
  useEffect(() => {
    if (!open) return;
    const firstItem = menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]');
    firstItem?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (anchorRef.current && anchorRef.current.contains(target)) return;
      if (menuRef.current && menuRef.current.contains(target)) return;
      close();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key !== "Tab" || !menuRef.current) return;
      // Trap Tab within the menu so it can't escape into the rest of the
      // page while open (the portal isn't adjacent to the trigger in DOM
      // order, so default tab flow would jump somewhere unrelated).
      const focusable = Array.from(
        menuRef.current.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, anchorRef]);

  if (!open || !pos || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={menuRef}
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
            close();
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
