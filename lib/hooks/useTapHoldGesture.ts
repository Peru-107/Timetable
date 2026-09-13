"use client";

import { useRef } from "react";

const HOLD_MS = 550;
const DOUBLE_TAP_WINDOW_MS = 280;

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

  const clearHoldTimer = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  const onPointerDown = () => {
    if (disabled) return;
    didFireHold.current = false;
    holdTimer.current = setTimeout(() => {
      didFireHold.current = true;
      onHold();
    }, HOLD_MS);
  };

  const onPointerUp = () => {
    if (disabled) return;
    clearHoldTimer();
    if (didFireHold.current) return;

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

  const onContextMenu = (e: React.MouseEvent) => {
    // Prevent the browser's long-press context menu from interfering with hold.
    e.preventDefault();
  };

  return { onPointerDown, onPointerUp, onPointerLeave, onContextMenu };
}
