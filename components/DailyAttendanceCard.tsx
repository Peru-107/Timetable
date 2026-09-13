"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ClipboardCheck } from "lucide-react";
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
  onChange,
}: {
  semesterId: string;
  onChange?: () => void;
}) {
  const router = useRouter();
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [attendanceByCourse, setAttendanceByCourse] = useState<Record<string, AttendanceRecord>>({});

  const today = startOfDay(new Date());
  const isToday = isSameDay(selectedDate, today);
  const canGoForward = selectedDate < today;

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
    fetch(`/api/attendance?semesterId=${semesterId}`)
      .then((res) => res.json())
      .then((data) => {
        const records: AttendanceRecord[] = data.records || [];
        const map: Record<string, AttendanceRecord> = {};
        for (const record of records) {
          if (isSameDay(new Date(record.date), selectedDate)) {
            map[record.courseId] = record;
          }
        }
        setAttendanceByCourse(map);
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
          date: selectedDate.toISOString(),
          status,
          hoursDuration: computeHoursFromTimes(entry.startTime, entry.endTime),
        }),
      });
      if (res.ok) {
        const record = await res.json();
        setAttendanceByCourse((prev) => ({ ...prev, [entry.courseId]: record }));
        onChange?.();
      }
    } catch (error) {
      console.error("Error marking attendance:", error);
    }
  };

  const clearAttendance = async (courseId: string) => {
    const record = attendanceByCourse[courseId];
    if (!record) return;
    try {
      const res = await fetch(`/api/attendance?id=${record.id}`, { method: "DELETE" });
      if (res.ok) {
        setAttendanceByCourse((prev) => {
          const next = { ...prev };
          delete next[courseId];
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

  const entriesForDay = entries.filter((entry) => entry.dayOfWeek === selectedDate.getDay());

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
            onClick={() => setSelectedDate((d) => startOfDay(new Date(d.getTime() - 86400000)))}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
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
              status={
                (attendanceByCourse[entry.courseId]?.status as TodayAttendanceStatus) || null
              }
              onMarkPresent={() => markAttendance(entry, "PRESENT")}
              onMarkAbsent={() => markAttendance(entry, "ABSENT")}
              onMarkCancelled={() => markAttendance(entry, "CANCELLED")}
              onClear={() => clearAttendance(entry.courseId)}
              onEdit={editEntry}
              onDelete={() => deleteEntry(entry.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
