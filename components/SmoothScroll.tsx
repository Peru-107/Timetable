"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

/**
 * Desktop-only polish, mounted once at the root:
 * - Lenis smooth wheel scrolling. Touch devices keep native scrolling -
 *   momentum scrolling on a phone already feels right, and taking it over
 *   makes swipes feel laggy.
 * - A soft cursor-following highlight on any element marked
 *   `data-spotlight`, driven by two CSS variables.
 * Both are skipped when the user prefers reduced motion.
 */
export function SmoothScroll() {
  useEffect(() => {
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!finePointer || reducedMotion) return;

    const lenis = new Lenis({ autoRaf: true, lerp: 0.12, smoothWheel: true });

    const onPointerMove = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-spotlight]");
      if (!el) return;
      const rect = el.getBoundingClientRect();
      el.style.setProperty("--spot-x", `${e.clientX - rect.left}px`);
      el.style.setProperty("--spot-y", `${e.clientY - rect.top}px`);
    };
    document.addEventListener("pointermove", onPointerMove, { passive: true });

    return () => {
      lenis.destroy();
      document.removeEventListener("pointermove", onPointerMove);
    };
  }, []);

  return null;
}
