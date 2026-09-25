"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/PageLoader";
import { useActiveSemester } from "@/lib/hooks/useActiveSemester";

interface CourseRow {
  courseId: string;
  courseName: string;
  totalHours: number;
  attendedHours: number;
  leavesUsed: number;
  heldHours: number;
  attendancePercentage: number;
  hoursAvailableToMiss: number;
  minAttendance: number;
}

interface Stats {
  totalHours: number;
  attendedHours: number;
  heldHours: number;
  attendancePercentage: number;
  minAttendance: number;
  leavesAvailable: number;
  leavesUsed: number;
}

/**
 * A plain, printable attendance summary. "Save as PDF" uses the browser's
 * own print dialog (every phone and desktop browser can print to PDF), so
 * there's no PDF library to ship.
 */
function ReportContent() {
  const { semesterId, isResolvingSemester } = useActiveSemester();
  const [stats, setStats] = useState<Stats | null>(null);
  const [rows, setRows] = useState<CourseRow[]>([]);
  const [semesterName, setSemesterName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!semesterId) return;
    Promise.all([
      fetch(`/api/attendance?semesterId=${semesterId}`).then((r) => r.json()),
      fetch("/api/semesters").then((r) => r.json()),
      fetch("/api/profile").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ])
      .then(([att, sems, profile]) => {
        setStats(att.stats);
        setRows(att.statsByCourse || []);
        const sem = Array.isArray(sems) ? sems.find((s: { id: string }) => s.id === semesterId) : null;
        setSemesterName(sem?.name || "");
        setStudentName(profile?.name || profile?.user?.name || "");
      })
      .finally(() => setLoading(false));
  }, [semesterId]);

  if (isResolvingSemester || loading) return <PageLoader />;
  if (!stats) return <p className="p-8 text-muted-foreground">No attendance data yet.</p>;

  const generated = new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
  const tone = (pct: number, held: number, min: number) =>
    held === 0 ? "text-muted-foreground" : pct >= min ? "text-success" : "text-destructive";

  return (
    <div className="min-h-screen bg-background px-4 py-8 print:bg-white print:p-0 print:text-black">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link href={`/dashboard/attendance?semesterId=${semesterId}`}>
            <Button variant="ghost">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </Link>
          <Button onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Save as PDF
          </Button>
        </div>

        <article className="frosted rounded-3xl p-6 print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <header className="mb-6 border-b border-border pb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Attendance report
            </p>
            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
              {semesterName || "Semester"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {studentName ? `${studentName} · ` : ""}Generated {generated} · Minimum {stats.minAttendance}%
            </p>
          </header>

          <section className="mb-6 grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Attendance so far</p>
              <p className={`font-mono text-2xl font-bold ${tone(stats.attendancePercentage, stats.heldHours, stats.minAttendance)}`}>
                {stats.heldHours > 0 ? `${Math.round(stats.attendancePercentage * 10) / 10}%` : "--"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Hours attended</p>
              <p className="font-mono text-2xl font-bold text-foreground">
                {stats.attendedHours}/{stats.heldHours}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Can still miss</p>
              <p className="font-mono text-2xl font-bold text-foreground">{stats.leavesAvailable}h</p>
            </div>
          </section>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 pr-2">Subject</th>
                  <th className="py-2 pr-2 text-right" title="Hours attended">Att.</th>
                  <th className="py-2 pr-2 text-right" title="Hours held so far">Held</th>
                  <th className="py-2 pr-2 text-right">%</th>
                  <th className="py-2 pr-2 text-right" title="Hours missed">Miss</th>
                  <th className="py-2 text-right" title="Hours you can still miss">Left</th>
                </tr>
              </thead>
              <tbody className="font-mono tabular-nums">
                {[...rows]
                  .sort((a, b) => a.courseName.localeCompare(b.courseName))
                  .map((r) => (
                    <tr key={r.courseId} className="border-b border-border/60">
                      <td className="py-2 pr-2 font-sans font-medium text-foreground">{r.courseName}</td>
                      <td className="py-2 pr-2 text-right">{r.attendedHours}h</td>
                      <td className="py-2 pr-2 text-right">{r.heldHours}h</td>
                      <td className={`py-2 pr-2 text-right font-semibold ${tone(r.attendancePercentage, r.heldHours, r.minAttendance)}`}>
                        {r.heldHours > 0 ? `${Math.round(r.attendancePercentage * 10) / 10}%` : "--"}
                      </td>
                      <td className="py-2 pr-2 text-right">{r.leavesUsed}h</td>
                      <td className="py-2 text-right">{r.hoursAvailableToMiss}h</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Hours throughout. &ldquo;%&rdquo; counts classes held so far (cancelled classes excluded).
            &ldquo;Left&rdquo; is
            what&apos;s left of the semester&apos;s {100 - stats.minAttendance}% allowance, based on{" "}
            {stats.totalHours}h of classes this semester.
          </p>
        </article>
      </div>
    </div>
  );
}

export default function AttendanceReportPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ReportContent />
    </Suspense>
  );
}
