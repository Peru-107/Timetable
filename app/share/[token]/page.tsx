"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { CalendarDays, CheckCircle2, Copy, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectNative } from "@/components/ui/select-native";
import { formatTime12h } from "@/lib/attendanceUtils";

interface SharedCourse {
  name: string;
  timetableEntries: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    room: string | null;
    instructor: string | null;
  }>;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** Public page a classmate opens from a shared link or QR code. */
export default function SharedTimetablePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { status } = useSession();
  const [data, setData] = useState<{ semesterName: string; sharedBy: string | null; courses: SharedCourse[] } | null>(
    null
  );
  const [error, setError] = useState("");
  const [semesters, setSemesters] = useState<Array<{ id: string; name: string }>>([]);
  const [target, setTarget] = useState("");
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState<{ coursesAdded: number; classesAdded: number; semesterId: string } | null>(null);

  useEffect(() => {
    fetch(`/api/share/${token}`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || "This link doesn't work");
        setData(body);
      })
      .catch((e: Error) => setError(e.message));
  }, [token]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/semesters")
      .then((r) => r.json())
      .then((list) => {
        const sems = Array.isArray(list) ? list : [];
        setSemesters(sems);
        if (sems[0]) setTarget(sems[0].id);
      })
      .catch(() => {});
  }, [status]);

  const handleImport = async () => {
    setImporting(true);
    setError("");
    try {
      const res = await fetch(`/api/share/${token}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ semesterId: target }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Couldn't copy the timetable");
      setDone({ ...body, semesterId: target });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const byDay = WEEK_ORDER.map((day) => ({
    day,
    classes: (data?.courses || [])
      .flatMap((c) => c.timetableEntries.filter((e) => e.dayOfWeek === day).map((e) => ({ ...e, course: c.name })))
      .sort((a, b) => a.startTime.localeCompare(b.startTime)),
  })).filter((d) => d.classes.length > 0);

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Shared timetable</p>
        <h1 className="font-display text-4xl font-bold tracking-tight text-foreground">
          {data?.semesterName || (error ? "Link unavailable" : "Loading...")}
        </h1>
        {data?.sharedBy && (
          <p className="mt-1 text-muted-foreground">
            Shared by {data.sharedBy} · {data.courses.length} subjects
          </p>
        )}

        {error && (
          <div className="frosted-inset mt-6 flex items-center gap-2 rounded-xl px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {data && (
          <>
            <section className="frosted mt-6 rounded-3xl p-5">
              <h2 className="mb-1 text-lg font-semibold text-foreground">Copy it into your account</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Adds these subjects and weekly classes to your semester. Your attendance, grades and
                anything already there stay as they are.
              </p>
              {done ? (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="flex items-center gap-2 text-sm font-medium text-success">
                    <CheckCircle2 className="h-4 w-4" /> Added {done.coursesAdded} subjects and {done.classesAdded}{" "}
                    classes.
                  </p>
                  <Link href={`/dashboard/timetable?semesterId=${done.semesterId}`}>
                    <Button>Open my timetable</Button>
                  </Link>
                </div>
              ) : status === "authenticated" ? (
                semesters.length === 0 ? (
                  <Link href="/dashboard/semesters/new">
                    <Button>Create a semester first</Button>
                  </Link>
                ) : (
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[12rem] flex-1">
                      <label htmlFor="share-target" className="mb-2 block text-sm font-medium text-foreground">
                        Into semester
                      </label>
                      <SelectNative id="share-target" value={target} onChange={(e) => setTarget(e.target.value)}>
                        {semesters.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </SelectNative>
                    </div>
                    <Button onClick={handleImport} disabled={importing || !target}>
                      <Copy className="h-4 w-4" /> {importing ? "Copying..." : "Copy timetable"}
                    </Button>
                  </div>
                )
              ) : (
                <div className="flex flex-wrap gap-3">
                  <Link href={`/login?next=/share/${token}`}>
                    <Button>Log in to copy</Button>
                  </Link>
                  <Link href="/register">
                    <Button variant="outline">Create an account</Button>
                  </Link>
                </div>
              )}
            </section>

            <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {byDay.map(({ day, classes }) => (
                <div key={day} className="frosted rounded-2xl p-4">
                  <h3 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
                    <CalendarDays className="h-4 w-4 text-primary" /> {DAYS[day]}
                  </h3>
                  <ul className="space-y-2">
                    {classes.map((c, i) => (
                      <li key={i} className="frosted-inset rounded-xl p-3">
                        <p className="text-sm font-semibold text-foreground">{c.course}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {formatTime12h(c.startTime)} - {formatTime12h(c.endTime)}
                        </p>
                        {(c.room || c.instructor) && (
                          <p className="truncate text-xs text-muted-foreground">
                            {[c.room, c.instructor].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
