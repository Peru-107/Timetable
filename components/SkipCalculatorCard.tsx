"use client";

import { motion } from "motion/react";
import { Calculator } from "lucide-react";

export interface CourseSkipStat {
  courseId: string;
  courseName: string;
  heldHours: number;
  attendancePercentage: number;
  classesAvailableToMiss: number;
  classesToRecover: number;
  canReachTarget: boolean;
  riskLevel: "safe" | "warning" | "critical";
}

export const TONE = {
  safe: "var(--success)",
  warning: "var(--warning)",
  critical: "var(--destructive)",
  none: "var(--muted-foreground)",
} as const;

export function verdict(c: CourseSkipStat): { text: string; tone: keyof typeof TONE } {
  if (!c.canReachTarget) return { text: "Can't reach 80% this semester", tone: "critical" };
  if (c.classesToRecover > 0)
    return {
      text: `Attend next ${c.classesToRecover} to reach 80%`,
      tone: "critical",
    };
  if (c.classesAvailableToMiss === 0) return { text: "Can't skip any more", tone: "warning" };
  return {
    text: `Can skip ${c.classesAvailableToMiss} more`,
    tone: c.riskLevel === "warning" ? "warning" : "safe",
  };
}

const RADIUS = 18;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Percentage ring with a tick at the 80% line. */
function Ring({ pct, color, empty }: { pct: number; color: string; empty: boolean }) {
  return (
    <svg viewBox="0 0 44 44" className="h-12 w-12 flex-shrink-0 -rotate-90" aria-hidden="true">
      <circle cx="22" cy="22" r={RADIUS} fill="none" stroke="currentColor" strokeWidth="4" className="text-foreground/10" />
      {!empty && (
        <motion.circle
          cx="22"
          cy="22"
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          initial={{ strokeDashoffset: CIRCUMFERENCE }}
          animate={{ strokeDashoffset: CIRCUMFERENCE * (1 - Math.min(100, pct) / 100) }}
          transition={{ type: "spring", stiffness: 60, damping: 18 }}
        />
      )}
      {/* 80% marker */}
      <line
        x1={22 + (RADIUS - 4) * Math.cos(0.8 * 2 * Math.PI)}
        y1={22 + (RADIUS - 4) * Math.sin(0.8 * 2 * Math.PI)}
        x2={22 + (RADIUS + 4) * Math.cos(0.8 * 2 * Math.PI)}
        y2={22 + (RADIUS + 4) * Math.sin(0.8 * 2 * Math.PI)}
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-foreground/40"
      />
    </svg>
  );
}

/**
 * "Can I skip this class?" answered per subject against the 80% rule:
 * how many more classes you can miss and still finish the semester at 80%,
 * or how many you must attend in a row to get back to it.
 */
export function SkipCalculatorCard({ courses }: { courses: CourseSkipStat[] }) {
  if (courses.length === 0) return null;
  const order = { critical: 0, warning: 1, safe: 2 } as const;
  const sorted = [...courses].sort(
    (a, b) =>
      order[a.riskLevel] - order[b.riskLevel] || a.courseName.localeCompare(b.courseName)
  );

  return (
    <div className="frosted mb-8 rounded-2xl p-6" data-spotlight>
      <div className="mb-4 flex items-center gap-3">
        <div className="frosted-inset flex h-10 w-10 items-center justify-center rounded-xl">
          <Calculator className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">Can I skip?</h3>
          <p className="text-sm text-muted-foreground">
            Per subject, against the 80% attendance rule.
          </p>
        </div>
      </div>
      <motion.ul
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.05 } } }}
      >
        {sorted.map((c) => {
          const empty = c.heldHours === 0;
          const v = empty ? { text: "No classes marked yet", tone: "none" as const } : verdict(c);
          return (
            <motion.li
              key={c.courseId}
              variants={{
                hidden: { opacity: 0, y: 8 },
                show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] } },
              }}
              className="frosted-inset flex items-center gap-3 rounded-xl p-3"
            >
              <div className="relative">
                <Ring pct={c.attendancePercentage} color={TONE[v.tone]} empty={empty} />
                <span className="absolute inset-0 flex items-center justify-center font-mono text-[10px] font-semibold text-foreground">
                  {empty ? "--" : `${Math.round(c.attendancePercentage)}%`}
                </span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{c.courseName}</p>
                <p className="text-xs font-medium" style={{ color: TONE[v.tone] }}>
                  {v.text}
                </p>
              </div>
            </motion.li>
          );
        })}
      </motion.ul>
    </div>
  );
}
