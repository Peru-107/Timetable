"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Flower2, Target } from "lucide-react";
import { useTheme, type ChartStyle } from "@/components/ThemeProvider";
import { TONE, verdict, type CourseSkipStat } from "@/components/SkipCalculatorCard";

// One hue per subject, spread round the wheel so neighbours stay distinct
// (and none is a pure status green/red, which mean present/absent).
const SUBJECT_HUES = [
  "#e8813a", "#d9b12a", "#8fbf3a", "#23a9b0", "#3a86db",
  "#6a66dc", "#a45cd3", "#d45aa3", "#2fa874", "#e05865",
];


function Arc({ cx, r, w, pct, color }: { cx: number; r: number; w: number; pct: number; color: string }) {
  const c = 2 * Math.PI * r;
  return (
    <>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeOpacity={0.18} strokeWidth={w} />
      <motion.circle
        cx={cx}
        cy={cx}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={w}
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - Math.min(100, pct) / 100) }}
        transition={{ type: "spring", stiffness: 50, damping: 16 }}
        transform={`rotate(-90 ${cx} ${cx})`}
      />
    </>
  );
}

interface Subject extends CourseSkipStat {
  color: string;
  code: string;
}

/** Short label for tight spots: "Operating Systems" -> "OS", "DBMS" -> "DBMS". */
function shortCode(name: string): string {
  const words = name.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w[0]));
  if (words.length === 1) return words[0].slice(0, 5);
  return words
    .filter((w) => !/^(of|and|the|&|to|in)$/i.test(w))
    .map((w) => (/^[IVX]+$/.test(w) ? w : w[0].toUpperCase()))
    .join("")
    .slice(0, 5);
}

/**
 * Per-subject attendance at a glance, drawn the way the student chose in
 * Profile: "rings" (overall ring + the 3 subjects closest to or below 80%)
 * or "sunflower" (one petal per subject, length = attendance, dashed
 * circle = 80%). Tap a subject to see its skip / recover verdict.
 */
export function AttendanceChartCard({
  courses,
  overall,
}: {
  courses: CourseSkipStat[];
  overall: { percentage: number; heldHours: number; min: number };
}) {
  const { chartStyle, setChartStyle } = useTheme();
  const [selected, setSelected] = useState<string | null>(null);

  const subjects: Subject[] = [...courses]
    .sort((a, b) => a.courseName.localeCompare(b.courseName))
    .map((c, i) => ({ ...c, color: SUBJECT_HUES[i % SUBJECT_HUES.length], code: shortCode(c.courseName) }));
  const marked = subjects.filter((s) => s.heldHours > 0);
  if (subjects.length === 0) return null;

  const picked = subjects.find((s) => s.courseId === selected);
  const detail = picked
    ? picked.heldHours === 0
      ? { text: "No classes marked yet", tone: "none" as const }
      : verdict(picked)
    : null;

  return (
    <div className="frosted mb-8 rounded-3xl p-5" data-spotlight>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Attendance by subject
          </h3>
          <p className="text-xs text-muted-foreground">{overall.min}% needed</p>
        </div>
        <StyleSwitch value={chartStyle} onChange={setChartStyle} />
      </div>

      {marked.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No classes marked yet
        </p>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={chartStyle}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.2 }}
          >
            {chartStyle === "rings" ? (
              <RingsView subjects={marked} overall={overall} selected={selected} onSelect={setSelected} />
            ) : (
              <SunflowerView subjects={subjects} overall={overall} selected={selected} onSelect={setSelected} />
            )}
          </motion.div>
        </AnimatePresence>
      )}

      <div className="frosted-inset mt-3 flex min-h-[3rem] items-center gap-3 rounded-2xl px-3 py-2 text-sm" aria-live="polite">
        {picked && detail ? (
          <>
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: picked.color }} />
            <span>
              <span className="font-semibold text-foreground">{picked.courseName}</span>
              {picked.heldHours > 0 && (
                <span className="text-muted-foreground"> · {Math.round(picked.attendancePercentage)}%</span>
              )}
              <br />
              <span className="font-medium" style={{ color: TONE[detail.tone] }}>
                {detail.text}
              </span>
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">Select a subject</span>
        )}
      </div>
    </div>
  );
}

function StyleSwitch({ value, onChange }: { value: ChartStyle; onChange: (v: ChartStyle) => void }) {
  const options: Array<{ v: ChartStyle; label: string; Icon: typeof Target }> = [
    { v: "rings", label: "Rings", Icon: Target },
    { v: "sunflower", label: "Sunflower", Icon: Flower2 },
  ];
  return (
    <div role="radiogroup" aria-label="Chart style" className="frosted-inset flex rounded-full p-0.5">
      {options.map(({ v, label, Icon }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          aria-label={label}
          title={label}
          onClick={() => onChange(v)}
          className={`flex h-8 w-9 items-center justify-center rounded-full transition-colors ${
            value === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}

function RingsView({
  subjects,
  overall,
  selected,
  onSelect,
}: {
  subjects: Subject[];
  overall: { percentage: number; heldHours: number; min: number };
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  // The subjects closest to (or below) the 80% line are the ones worth a ring.
  const watch = [...subjects].sort((a, b) => a.attendancePercentage - b.attendancePercentage).slice(0, 3);
  const rest = subjects.length - watch.length;
  const size = 164;
  const cx = size / 2;
  const w = 13;
  const gap = 3;
  const dim = (id: string) => (selected && selected !== id ? 0.3 : 1);

  return (
    <div className="flex items-center gap-3 sm:gap-4">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="h-auto w-[42%] max-w-[164px] flex-shrink-0"
        aria-hidden="true"
      >
        <g opacity={selected ? 0.3 : 1}>
          <Arc cx={cx} r={cx - w / 2} w={w} pct={overall.percentage} color="var(--primary)" />
        </g>
        {watch.map((s, i) => (
          <g key={s.courseId} opacity={dim(s.courseId)} onClick={() => onSelect(s.courseId)} className="cursor-pointer">
            <Arc cx={cx} r={cx - w / 2 - (i + 1) * (w + gap)} w={w} pct={s.attendancePercentage} color={s.color} />
          </g>
        ))}
      </svg>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline">
          <span className="font-display text-3xl font-bold tracking-tight text-primary">
            {Math.round(overall.percentage)}%
          </span>
          <span className="ml-1 whitespace-nowrap text-xs text-muted-foreground">overall</span>
        </div>
        {watch.map((s) => (
          <button
            key={s.courseId}
            type="button"
            onClick={() => onSelect(s.courseId)}
            className="flex min-w-0 items-center gap-2 rounded-lg text-left text-sm"
            style={{ opacity: dim(s.courseId) }}
          >
            <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="truncate font-semibold text-foreground">{s.courseName}</span>
            <span
              className="ml-auto flex-shrink-0 font-mono text-xs"
              style={{
                color: s.attendancePercentage < overall.min ? "var(--destructive)" : "var(--muted-foreground)",
              }}
            >
              {Math.round(s.attendancePercentage)}%
            </span>
          </button>
        ))}
        {rest > 0 && <span className="text-xs font-semibold text-success">+{rest} more on track</span>}
      </div>
    </div>
  );
}

function SunflowerView({
  subjects,
  overall,
  selected,
  onSelect,
}: {
  subjects: Subject[];
  overall: { percentage: number; heldHours: number; min: number };
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const size = 280;
  const cx = size / 2;
  const r0 = 28;
  const rMax = cx - 38;
  const r80 = r0 + (rMax - r0) * (overall.min / 100);
  const petalWidth = Math.max(8, Math.min(18, 150 / subjects.length));

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto block w-full max-w-[280px]" role="img" aria-label="Attendance sunflower: one petal per subject">
      <circle cx={cx} cy={cx} r={r80} fill="none" stroke="var(--foreground)" strokeOpacity={0.35} strokeDasharray="3 4" />
      {subjects.map((s, i) => {
        const a = (i / subjects.length) * 2 * Math.PI - Math.PI / 2;
        const pct = s.heldHours > 0 ? s.attendancePercentage : 0;
        const len = r0 + (rMax - r0) * (pct / 100);
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        const lx = cx + (rMax + 22) * cos;
        const ly = cx + (rMax + 22) * sin;
        return (
          <g
            key={s.courseId}
            onClick={() => onSelect(s.courseId)}
            className="cursor-pointer"
            opacity={selected && selected !== s.courseId ? 0.3 : 1}
          >
            {/* wide invisible hit area so thin petals are easy to tap */}
            <line x1={cx + r0 * cos} y1={cx + r0 * sin} x2={cx + rMax * cos} y2={cx + rMax * sin} stroke="transparent" strokeWidth={26} />
            <motion.line
              x1={cx + r0 * cos}
              y1={cx + r0 * sin}
              initial={{ x2: cx + r0 * cos, y2: cx + r0 * sin }}
              animate={{ x2: cx + len * cos, y2: cx + len * sin }}
              transition={{ type: "spring", stiffness: 60, damping: 14, delay: i * 0.03 }}
              stroke={s.heldHours > 0 ? s.color : "var(--muted-foreground)"}
              strokeOpacity={s.heldHours > 0 ? 1 : 0.3}
              strokeWidth={petalWidth}
              strokeLinecap="round"
            />
            <text x={lx} y={ly + 4} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="var(--muted-foreground)">
              {s.code}
            </text>
          </g>
        );
      })}
      <circle cx={cx} cy={cx} r={r0 - 4} fill="var(--tile)" />
      <text x={cx} y={cx + 5} textAnchor="middle" fontSize={15} fontWeight={800} fill="var(--primary)">
        {overall.heldHours > 0 ? `${Math.round(overall.percentage)}%` : "--"}
      </text>
    </svg>
  );
}
