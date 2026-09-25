"use client";

import { useRef } from "react";

const HOLD_MS = 550;
const DOUBLE_TAP_WINDOW_MS = 400;
// Past this much finger travel the gesture is a swipe or scroll, not a tap
// or hold - otherwise swiping a chip to mark it would also fire a tap.
const MOVE_TOLERANCE_PX = 10;

interface TapHoldGestureOptions {
  onTap: () => void;
  onHold: () => void;
  onDoubleTap: () => void;
  disabled?: boolean;
}

/**
 * A single tap must wait out the double-tap window before firing, since
 * there's no way to know a second tap isn't coming until it either arrives
 * or the window closes.
 */
export function useTapHoldGesture({ onTap, onHold, onDoubleTap, disabled }: TapHoldGestureOptions) {
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didFireHold = useRef(false);
  const awaitingSecondTap = useRef(false);
  const startPoint = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);

  const clearHoldTimer = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    didFireHold.current = false;
    moved.current = false;
    startPoint.current = { x: e.clientX, y: e.clientY };
    holdTimer.current = setTimeout(() => {
      didFireHold.current = true;
      onHold();
    }, HOLD_MS);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!startPoint.current || moved.current) return;
    const dx = e.clientX - startPoint.current.x;
    const dy = e.clientY - startPoint.current.y;
    if (Math.hypot(dx, dy) > MOVE_TOLERANCE_PX) {
      moved.current = true;
      clearHoldTimer();
    }
  };

  const onPointerUp = () => {
    if (disabled) return;
    clearHoldTimer();
    startPoint.current = null;
    if (didFireHold.current || moved.current) return;

    if (awaitingSecondTap.current) {
      awaitingSecondTap.current = false;
      if (tapTimer.current) {
        clearTimeout(tapTimer.current);
        tapTimer.current = null;
      }
      onDoubleTap();
    } else {
      awaitingSecondTap.current = true;
      tapTimer.current = setTimeout(() => {
        awaitingSecondTap.current = false;
        onTap();
      }, DOUBLE_TAP_WINDOW_MS);
    }
  };

  const onPointerLeave = () => {
    clearHoldTimer();
  };

  // The browser took over the touch (usually to scroll the page) - no
  // pointerup follows, so without this the hold timer would still fire.
  const onPointerCancel = () => {
    clearHoldTimer();
    startPoint.current = null;
    moved.current = true;
  };

  const onContextMenu = (e: React.MouseEvent) => {
    // Prevent the browser's long-press context menu from interfering with hold.
    e.preventDefault();
  };

  return { onPointerDown, onPointerMove, onPointerUp, onPointerLeave, onPointerCancel, onContextMenu };
}
