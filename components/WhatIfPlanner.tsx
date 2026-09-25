"use client";

import { useState } from "react";
import { Minus, Plus, Wand2 } from "lucide-react";
import { SelectNative } from "@/components/ui/select-native";

interface PlannerCourse {
  courseId: string;
  courseName: string;
  totalHours: number;
  attendedHours: number;
  leavesUsed: number;
  heldHours: number;
  sessionHours: number;
  minAttendance: number;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * "If I skip the next N classes of X, where do I end up?" Two answers,
 * matching how attendance is judged: the percentage right after those
 * skips (of classes held by then), and where the whole semester lands if
 * every class after that is attended - plus the hours still allowed to miss.
 */
export function WhatIfPlanner({ courses }: { courses: PlannerCourse[] }) {
  const usable = courses.filter((c) => c.sessionHours > 0);
  const [courseId, setCourseId] = useState(usable[0]?.courseId ?? "");
  const [skips, setSkips] = useState(1);
  if (usable.length === 0) return null;

  const c = usable.find((x) => x.courseId === courseId) ?? usable[0];
  const skippedHours = skips * c.sessionHours;
  const heldAfter = c.heldHours + skippedHours;
  const nowPct = heldAfter > 0 ? (c.attendedHours / heldAfter) * 100 : 0;
  const absentAfter = c.leavesUsed + skippedHours;
  const budget = c.totalHours * (1 - c.minAttendance / 100);
  const budgetLeft = budget - absentAfter;
  const semesterPct = c.totalHours > 0 ? ((c.totalHours - absentAfter) / c.totalHours) * 100 : 0;
  const safe = budgetLeft >= 0;

  return (
    <div className="frosted mb-8 rounded-2xl p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="frosted-inset flex h-10 w-10 items-center justify-center rounded-xl">
          <Wand2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Skip Planner</h2>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[12rem] flex-1">
          <label htmlFor="whatif-course" className="mb-2 block text-sm font-medium text-foreground">
            Subject
          </label>
          <SelectNative id="whatif-course" value={c.courseId} onChange={(e) => setCourseId(e.target.value)}>
            {usable.map((x) => (
              <option key={x.courseId} value={x.courseId}>
                {x.courseName}
              </option>
            ))}
          </SelectNative>
        </div>
        <div>
          <span className="mb-2 block text-sm font-medium text-foreground">Classes to skip</span>
          <div className="frosted-inset flex items-center rounded-xl p-1">
            <button
              type="button"
              onClick={() => setSkips((n) => Math.max(1, n - 1))}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground hover:bg-foreground/5"
              aria-label="Fewer classes"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-10 text-center font-mono text-lg font-semibold tabular-nums text-foreground" aria-live="polite">
              {skips}
            </span>
            <button
              type="button"
              onClick={() => setSkips((n) => Math.min(30, n + 1))}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground hover:bg-foreground/5"
              aria-label="More classes"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="frosted-inset rounded-xl p-3">
          <p className="text-xs text-muted-foreground">Right after skipping</p>
          <p
            className={`font-mono text-2xl font-bold ${
              nowPct >= c.minAttendance ? "text-success" : "text-destructive"
            }`}
          >
            {r1(nowPct)}%
          </p>
          <p className="text-xs text-muted-foreground">
            {c.attendedHours}h of {r1(heldAfter)}h held
          </p>
        </div>
        <div className="frosted-inset rounded-xl p-3">
          <p className="text-xs text-muted-foreground">At semester end</p>
          <p
            className={`font-mono text-2xl font-bold ${
              semesterPct >= c.minAttendance ? "text-success" : "text-destructive"
            }`}
          >
            {r1(semesterPct)}%
          </p>
          <p className="text-xs text-muted-foreground">{c.minAttendance}% needed</p>
        </div>
        <div className="frosted-inset rounded-xl p-3">
          <p className="text-xs text-muted-foreground">Hours you can still miss</p>
          <p className={`font-mono text-2xl font-bold ${safe ? "text-foreground" : "text-destructive"}`}>
            {r1(Math.max(0, budgetLeft))}h
          </p>
          <p className="text-xs text-muted-foreground">of {r1(budget)}h for the semester</p>
        </div>
      </div>

      <p className={`mt-3 text-sm font-medium ${safe ? "text-success" : "text-destructive"}`}>
        {safe
          ? `You can skip ${skips} ${skips === 1 ? "class" : "classes"} of ${c.courseName} and still finish at ${c.minAttendance}% or more.`
          : `Skipping ${skips} would put ${c.courseName} below ${c.minAttendance}% for the semester, even if you attend everything after.`}
      </p>
    </div>
  );
}
