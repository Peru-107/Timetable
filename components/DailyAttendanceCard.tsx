"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ClipboardCheck, Palmtree } from "lucide-react";
import { TodayClassChip, type TodayAttendanceStatus } from "@/components/TodayClassChip";
import { computeHoursFromTimes, startOfDay, isSameDay } from "@/lib/attendanceUtils";

interface TimetableEntry {
  id: string;
  courseId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room?: string;
  instructor?: string;
  course: { id: string; name: string };
}

interface AttendanceRecord {
  id: string;
  courseId: string;
  timetableEntryId: string | null;
  date: string;
  status: "PRESENT" | "ABSENT" | "CANCELLED";
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Ease-of-access attendance marking on the Overview page: same tap/hold/
 * double-tap chip interaction as the Timetable page, but for a navigable
 * date (today or any earlier day) instead of being locked to today only.
 */
export function DailyAttendanceCard({
  semesterId,
  semesterStartDate,
  onChange,
}: {
  semesterId: string;
  semesterStartDate?: string;
  onChange?: () => void;
}) {
  const router = useRouter();
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [holidays, setHolidays] = useState<Array<{ date: string; title: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  // Records tagged with the specific timetable entry they came from, keyed
  // by that entry's id - and a courseId-keyed fallback for records with no
  // entry tag (manual entries, or ones created before per-entry tracking
  // existed). This split is what lets two same-day sessions of one course
  // show independent status instead of colliding on courseId alone.
  const [recordsByEntry, setRecordsByEntry] = useState<Record<string, AttendanceRecord>>({});
  const [recordsByCourseFallback, setRecordsByCourseFallback] = useState<
    Record<string, AttendanceRecord>
  >({});

  const getRecordForEntry = (entry: TimetableEntry) =>
    recordsByEntry[entry.id] || recordsByCourseFallback[entry.courseId];

  const today = startOfDay(new Date());
  const isToday = isSameDay(selectedDate, today);
  const canGoForward = selectedDate < today;
  // Classes before the semester began never happened - don't let the user
  // walk back into (and mark attendance for) those days.
  const semesterStart = semesterStartDate
    ? (() => {
        const [y, m, d] = semesterStartDate.slice(0, 10).split("-").map(Number);
        return new Date(y, m - 1, d);
      })()
    : null;
  const canGoBack = !semesterStart || selectedDate > semesterStart;

  useEffect(() => {
    if (!semesterId) return;
    setIsLoading(true);
    fetch(`/api/timetable?semesterId=${semesterId}`)
      .then((res) => res.json())
      .then((data) => setEntries(Array.isArray(data) ? data : []))
      .catch((error) => console.error("Error fetching timetable:", error))
      .finally(() => setIsLoading(false));
  }, [semesterId]);

  useEffect(() => {
    if (!semesterId) return;
    fetch(`/api/calendar?semesterId=${semesterId}`)
      .then((res) => res.json())
      .then((data: Array<{ title: string; eventType: string; dueDate: string }>) =>
        setHolidays(
          Array.isArray(data)
            ? data
                .filter((e) => e.eventType === "holiday")
                .map((e) => ({ date: e.dueDate.slice(0, 10), title: e.title }))
            : []
        )
      )
      .catch(() => setHolidays([]));
  }, [semesterId]);

  useEffect(() => {
    if (!semesterId) return;
    fetch(`/api/attendance?semesterId=${semesterId}`)
      .then((res) => res.json())
      .then((data) => {
        const records: AttendanceRecord[] = data.records || [];
        const byEntry: Record<string, AttendanceRecord> = {};
        const byCourseFallback: Record<string, AttendanceRecord> = {};
        for (const record of records) {
          if (!isSameDay(new Date(record.date), selectedDate)) continue;
          if (record.timetableEntryId) {
            byEntry[record.timetableEntryId] = record;
          } else {
            byCourseFallback[record.courseId] = record;
          }
        }
        setRecordsByEntry(byEntry);
        setRecordsByCourseFallback(byCourseFallback);
      })
      .catch((error) => console.error("Error fetching attendance:", error));
  }, [semesterId, selectedDate]);

  const markAttendance = async (
    entry: TimetableEntry,
    status: "PRESENT" | "ABSENT" | "CANCELLED"
  ) => {
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: entry.courseId,
          timetableEntryId: entry.id,
          date: selectedDate.toISOString(),
          status,
          hoursDuration: computeHoursFromTimes(entry.startTime, entry.endTime),
        }),
      });
      if (res.ok) {
        const record: AttendanceRecord = await res.json();
        setRecordsByEntry((prev) => ({ ...prev, [entry.id]: record }));
        // The server may have adopted a previously-untagged same-day record
        // for this course - drop it from the fallback so it isn't also
        // shown for a different entry of the same course.
        setRecordsByCourseFallback((prev) => {
          if (!(entry.courseId in prev)) return prev;
          const next = { ...prev };
          delete next[entry.courseId];
          return next;
        });
        onChange?.();
      }
    } catch (error) {
      console.error("Error marking attendance:", error);
    }
  };

  const clearAttendance = async (entry: TimetableEntry) => {
    const record = getRecordForEntry(entry);
    if (!record) return;
    try {
      const res = await fetch(`/api/attendance?id=${record.id}`, { method: "DELETE" });
      if (res.ok) {
        setRecordsByEntry((prev) => {
          if (!(entry.id in prev)) return prev;
          const next = { ...prev };
          delete next[entry.id];
          return next;
        });
        setRecordsByCourseFallback((prev) => {
          if (!(entry.courseId in prev)) return prev;
          const next = { ...prev };
          delete next[entry.courseId];
          return next;
        });
        onChange?.();
      }
    } catch (error) {
      console.error("Error clearing attendance:", error);
    }
  };

  const deleteEntry = async (id: string) => {
    if (!confirm("Remove this class from your timetable?")) return;
    try {
      const res = await fetch(`/api/timetable?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setEntries((prev) => prev.filter((e) => e.id !== id));
      }
    } catch (error) {
      console.error("Error deleting timetable entry:", error);
    }
  };

  const editEntry = () => {
    router.push(`/dashboard/timetable?semesterId=${semesterId}`);
  };

  const entriesForDay = entries
    .filter((entry) => entry.dayOfWeek === selectedDate.getDay())
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  // Holidays are stored at the date string's UTC midnight, so compare on the
  // local calendar date string rather than on instants.
  const selectedKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;
  const holiday = holidays.find((h) => h.date === selectedKey);

  const dateLabel = selectedDate.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="frosted mb-8 rounded-2xl p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="frosted-inset flex h-10 w-10 items-center justify-center rounded-xl">
            <ClipboardCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Mark Attendance</h3>
            <p className="text-sm text-muted-foreground">
              Tap to mark present, hold for more options, double-tap to clear.
            </p>
          </div>
        </div>

        <div className="frosted-inset flex items-center gap-1 rounded-xl p-1">
          <button
            type="button"
            onClick={() =>
              canGoBack &&
              setSelectedDate((d) => startOfDay(new Date(d.getTime() - 86400000)))
            }
            disabled={!canGoBack}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-2 text-sm font-medium text-foreground">
            {isToday ? "Today" : dateLabel}
          </span>
          <button
            type="button"
            onClick={() =>
              canGoForward &&
              setSelectedDate((d) => startOfDay(new Date(d.getTime() + 86400000)))
            }
            disabled={!canGoForward}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : holiday ? (
        <div className="frosted-inset flex items-center gap-3 rounded-xl p-4 text-sm">
          <Palmtree className="h-5 w-5 flex-shrink-0 text-success" />
          <span className="text-foreground">
            <span className="font-semibold">{holiday.title}</span> - no classes to mark
            {isToday ? " today" : ""}.
          </span>
        </div>
      ) : entriesForDay.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No classes scheduled on {DAYS[selectedDate.getDay()]}.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {entriesForDay.map((entry) => (
            <TodayClassChip
              key={entry.id}
              courseName={entry.course.name}
              startTime={entry.startTime}
              endTime={entry.endTime}
              room={entry.room}
              instructor={entry.instructor}
              status={(getRecordForEntry(entry)?.status as TodayAttendanceStatus) || null}
              onMarkPresent={() => markAttendance(entry, "PRESENT")}
              onMarkAbsent={() => markAttendance(entry, "ABSENT")}
              onMarkCancelled={() => markAttendance(entry, "CANCELLED")}
              onClear={() => clearAttendance(entry)}
              onEdit={editEntry}
              onDelete={() => deleteEntry(entry.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
