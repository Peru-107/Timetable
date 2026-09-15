"use client";

import { useEffect, useRef, useState } from "react";
import { animate } from "motion/react";

interface AnimatedNumberProps {
  value: number;
  decimals?: number;
  suffix?: string;
  className?: string;
}

/** Counts a stat number up/down to its new value instead of snapping instantly. */
export function AnimatedNumber({ value, decimals = 0, suffix = "", className }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value);
  const prevValue = useRef(value);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      setDisplay(value);
      prevValue.current = value;
      return;
    }

    const controls = animate(prevValue.current, value, {
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => setDisplay(latest),
    });
    prevValue.current = value;
    return () => controls.stop();
  }, [value]);

  return (
    <span className={className}>
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
}
