"use client";

/**
 * Trimmed port of KokonutUI's Shimmer Text (https://kokonutui.com) - dropped
 * the fixed centering wrapper and heading-sized default font so it composes
 * into inline loading labels instead of standing alone as a hero.
 */

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface ShimmerTextProps {
  text: string;
  className?: string;
}

export function ShimmerText({ text, className }: ShimmerTextProps) {
  return (
    <motion.span
      animate={{ backgroundPosition: ["200% center", "-200% center"] }}
      className={cn(
        "bg-[length:200%_100%] bg-gradient-to-r from-muted-foreground via-foreground to-muted-foreground bg-clip-text font-medium text-transparent",
        className
      )}
      transition={{ duration: 2.5, ease: "linear", repeat: Number.POSITIVE_INFINITY }}
    >
      {text}
    </motion.span>
  );
}
