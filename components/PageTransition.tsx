"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";

/**
 * A quiet fade between dashboard tabs. Deliberately opacity-only (no slide/
 * scale) - a transform on this wrapper would create a new containing block
 * partway through the transition and glitch DashboardNav's `sticky` header.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15, ease: "linear" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
