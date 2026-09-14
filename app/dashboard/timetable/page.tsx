"use client";

import { Suspense, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/ui/select-native";
import { DashboardNav } from "@/components/DashboardNav";
import { PageLoader } from "@/components/PageLoader";
import { NoSemesterState } from "@/components/NoSemesterState";
import { TodayClassChip, type TodayAttendanceStatus } from "@/components/TodayClassChip";
import { ScheduleClassChip } from "@/components/ScheduleClassChip";
import { CoursePill } from "@/components/CoursePill";
import { CourseScheduleRows, type ScheduleRow } from "@/components/CourseScheduleRows";
import { useActiveSemester } from "@/lib/hooks/useActiveSemester";
import { computeHoursFromTimes, formatTime12h, startOfDay } from "@/lib/attendanceUtils";
import { Plus, X, Upload, CheckCircle2, AlertCircle, Loader2, BookOpen } from "lucide-react";

interface TimetableEntry {
  id: string;
  courseId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room?: string;
  instructor?: string;
  course: {
    id: string;
    name: string;
  };
}

interface Course {
  id: string;
  name: string;
  code?: string;
  creditHours: number;
}

interface AttendanceRecord {
  id: string;
  courseId: string;
  timetableEntryId: string | null;
  date: string;
  status: "PRESENT" | "ABSENT" | "CANCELLED";
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/**
 * Vercel rejects request bodies over ~4.5MB outright, and full-resolution
 * phone camera photos routinely exceed that. Downscale and re-encode as
 * JPEG client-side before upload; PDFs are left as-is since they can't be
 * resized this way.
 */
async function compressImageIfNeeded(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= MAX_UPLOAD_BYTES) {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const maxDimension = 2200;
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85)
  );
  if (!blob) return file;

  return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
}

export default function TimetablePage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <TimetableContent />
    </Suspense>
  );
}

function TimetableContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { semesterId, isResolvingSemester, hasNoSemesters } = useActiveSemester();

  const [timetableEntries, setTimetableEntries] = useState<TimetableEntry[]>([]);
  const [newEntry, setNewEntry] = useState({
    courseId: "",
    dayOfWeek: 0,
    startTime: "09:00",
    endTime: "11:00",
    room: "",
    instructor: "",
  });
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showAddCourseForm, setShowAddCourseForm] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  const [newCourseCredits, setNewCourseCredits] = useState(3);
  const [newCourseSchedule, setNewCourseSchedule] = useState<ScheduleRow[]>([
    { dayOfWeek: 1, startTime: "09:00", endTime: "10:00" },
  ]);
  const [isAddingCourse, setIsAddingCourse] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editCourseName, setEditCourseName] = useState("");
  const [editCourseCredits, setEditCourseCredits] = useState(3);
  const [editCourseSchedule, setEditCourseSchedule] = useState<ScheduleRow[]>([]);
  const [isSavingCourseEdit, setIsSavingCourseEdit] = useState(false);
  const [isMergingAdjacent, setIsMergingAdjacent] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [subjectsInput, setSubjectsInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  // Records tagged with the specific timetable entry they came from, keyed
  // by that entry's id - and a courseId-keyed fallback for records with no
  // entry tag (manual entries, or ones created before per-entry tracking
  // existed). This split is what lets two same-day sessions of one course
  // show independent status instead of colliding on courseId alone.
  const [todayByEntry, setTodayByEntry] = useState<Record<string, AttendanceRecord>>({});
  const [todayByCourseFallback, setTodayByCourseFallback] = useState<Record<string, AttendanceRecord>>({});

  const getTodayRecordForEntry = (entry: TimetableEntry) =>
    todayByEntry[entry.id] || todayByCourseFallback[entry.courseId];

  const todayDayIndex = new Date().getDay();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (semesterId) {
      fetchTimetable();
      fetchCourses();
      fetchTodayAttendance();
    } else if (!isResolvingSemester) {
      setIsLoading(false);
    }
  }, [semesterId, isResolvingSemester]);

  const fetchTimetable = async () => {
    try {
      const res = await fetch(`/api/timetable?semesterId=${semesterId}`);
      const data = await res.json();
      setTimetableEntries(data);
    } catch (error) {
      console.error("Error fetching timetable:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCourses = async () => {
    try {
      const res = await fetch(`/api/courses?semesterId=${semesterId}`);
      const data = await res.json();
      setCourses(data);
    } catch (error) {
      console.error("Error fetching courses:", error);
    }
  };

  const fetchTodayAttendance = async () => {
    try {
      const res = await fetch(`/api/attendance?semesterId=${semesterId}`);
      const data = await res.json();
      const records: AttendanceRecord[] = data.records || [];
      const dayStart = startOfDay(new Date());
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const byEntry: Record<string, AttendanceRecord> = {};
      const byCourseFallback: Record<string, AttendanceRecord> = {};
      for (const record of records) {
        const recordDate = new Date(record.date);
        if (recordDate < dayStart || recordDate > dayEnd) continue;
        if (record.timetableEntryId) {
          byEntry[record.timetableEntryId] = record;
        } else {
          byCourseFallback[record.courseId] = record;
        }
      }
      setTodayByEntry(byEntry);
      setTodayByCourseFallback(byCourseFallback);
    } catch (error) {
      console.error("Error fetching attendance:", error);
    }
  };

  const resetEntryForm = () => {
    setNewEntry({
      courseId: "",
      dayOfWeek: 0,
      startTime: "09:00",
      endTime: "11:00",
      room: "",
      instructor: "",
    });
    setEditingEntryId(null);
    setShowForm(false);
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/timetable", {
        method: editingEntryId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingEntryId ? { ...newEntry, id: editingEntryId } : { ...newEntry, semesterId }
        ),
      });

      if (res.ok) {
        resetEntryForm();
        fetchTimetable();
      }
    } catch (error) {
      console.error("Error saving timetable entry:", error);
    }
  };

  const startEditEntry = (entry: TimetableEntry) => {
    setNewEntry({
      courseId: entry.courseId,
      dayOfWeek: entry.dayOfWeek,
      startTime: entry.startTime,
      endTime: entry.endTime,
      room: entry.room || "",
      instructor: entry.instructor || "",
    });
    setEditingEntryId(entry.id);
    setShowForm(true);
  };

  const handleDeleteEntry = async (id: string) => {
    if (!confirm("Remove this class from your timetable?")) return;
    try {
      const res = await fetch(`/api/timetable?id=${id}`, { method: "DELETE" });
      if (res.ok) fetchTimetable();
    } catch (error) {
      console.error("Error deleting timetable entry:", error);
    }
  };

  const scheduleRowsWithTimes = newCourseSchedule.filter((r) => r.startTime && r.endTime);
  const scheduleCreditHours = scheduleRowsWithTimes.reduce(
    (sum, r) => sum + computeHoursFromTimes(r.startTime, r.endTime),
    0
  );

  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseName.trim()) return;
    setIsAddingCourse(true);
    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCourseName.trim(),
          creditHours: scheduleRowsWithTimes.length > 0 ? scheduleCreditHours : newCourseCredits,
          semesterId,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        for (const row of scheduleRowsWithTimes) {
          await fetch("/api/timetable", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              courseId: created.id,
              semesterId,
              dayOfWeek: row.dayOfWeek,
              startTime: row.startTime,
              endTime: row.endTime,
            }),
          });
        }
        setNewCourseName("");
        setNewCourseCredits(3);
        setNewCourseSchedule([{ dayOfWeek: 1, startTime: "09:00", endTime: "10:00" }]);
        setShowAddCourseForm(false);
        fetchCourses();
        if (scheduleRowsWithTimes.length > 0) fetchTimetable();
      }
    } catch (error) {
      console.error("Error adding course:", error);
    } finally {
      setIsAddingCourse(false);
    }
  };

  const editScheduleRowsWithTimes = editCourseSchedule.filter((r) => r.startTime && r.endTime);
  const editScheduleCreditHours = editScheduleRowsWithTimes.reduce(
    (sum, r) => sum + computeHoursFromTimes(r.startTime, r.endTime),
    0
  );

  const startEditCourse = (course: Course) => {
    setShowAddCourseForm(false);
    setEditingCourseId(course.id);
    setEditCourseName(course.name);
    setEditCourseCredits(course.creditHours);
    const existingRows = timetableEntries
      .filter((e) => e.courseId === course.id)
      .map((e) => ({
        dayOfWeek: e.dayOfWeek,
        startTime: e.startTime,
        endTime: e.endTime,
        room: e.room,
        instructor: e.instructor,
      }));
    setEditCourseSchedule(existingRows);
  };

  const handleSaveCourseEdit = async (id: string) => {
    if (!editCourseName.trim()) return;
    setIsSavingCourseEdit(true);
    try {
      const creditHours =
        editScheduleRowsWithTimes.length > 0 ? editScheduleCreditHours : editCourseCredits;
      const res = await fetch("/api/courses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: editCourseName.trim(), creditHours }),
      });
      if (res.ok) {
        // Replace this course's schedule with the edited rows. Deleting the
        // old entries only clears their attendance records' entry tag
        // (SetNull), it never deletes the records, so this never touches
        // attendance history - marking the course again on a future day
        // just re-tags against whichever new entry matches.
        const currentEntries = timetableEntries.filter((e) => e.courseId === id);
        for (const entry of currentEntries) {
          await fetch(`/api/timetable?id=${entry.id}`, { method: "DELETE" });
        }
        for (const row of editScheduleRowsWithTimes) {
          await fetch("/api/timetable", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              courseId: id,
              semesterId,
              dayOfWeek: row.dayOfWeek,
              startTime: row.startTime,
              endTime: row.endTime,
              room: row.room,
              instructor: row.instructor,
            }),
          });
        }
        setEditingCourseId(null);
        fetchCourses();
        fetchTimetable();
        fetchTodayAttendance();
      }
    } catch (error) {
      console.error("Error updating course:", error);
    } finally {
      setIsSavingCourseEdit(false);
    }
  };

  const handleDeleteCourse = async (id: string) => {
    if (
      !confirm(
        "Delete this course? This also removes its classes, attendance records, and grade."
      )
    )
      return;
    try {
      const res = await fetch(`/api/courses?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchCourses();
        fetchTimetable();
        fetchTodayAttendance();
      }
    } catch (error) {
      console.error("Error deleting course:", error);
    }
  };

  const handleMergeAdjacent = async () => {
    setIsMergingAdjacent(true);
    try {
      const res = await fetch("/api/timetable/merge-adjacent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ semesterId }),
      });
      if (res.ok) {
        fetchTimetable();
        fetchTodayAttendance();
      }
    } catch (error) {
      console.error("Error merging adjacent entries:", error);
    } finally {
      setIsMergingAdjacent(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;

    if (!subjectsInput.trim()) {
      setUploadResult({
        type: "error",
        message: "List your subjects above first, so we know what to look for.",
      });
      e.target.value = "";
      return;
    }

    if (!rawFile.type.startsWith("image/") && rawFile.size > MAX_UPLOAD_BYTES) {
      setUploadResult({
        type: "error",
        message: "That PDF is too large to upload. Try a smaller file or a photo instead.",
      });
      e.target.value = "";
      return;
    }

    setIsUploading(true);
    setUploadResult(null);

    try {
      const file = await compressImageIfNeeded(rawFile);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("semesterId", semesterId || "");
      formData.append("subjects", subjectsInput);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      let data: { message?: string; error?: string } | null = null;
      try {
        data = await res.json();
      } catch {
        // Non-JSON response, e.g. a platform-level size/timeout error page
      }

      if (res.ok && data) {
        setUploadResult({ type: "success", message: data.message || "Timetable updated" });
        fetchTimetable();
        fetchCourses();
      } else {
        setUploadResult({
          type: "error",
          message:
            data?.error ||
            "The upload failed, possibly because the file is too large or it took too long to process. Try a clearer, smaller photo.",
        });
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      setUploadResult({ type: "error", message: "Network error while uploading. Please try again." });
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const markAttendance = async (
    entry: TimetableEntry,
    entryStatus: "PRESENT" | "ABSENT" | "CANCELLED"
  ) => {
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: entry.courseId,
          timetableEntryId: entry.id,
          date: startOfDay(new Date()).toISOString(),
          status: entryStatus,
          hoursDuration: computeHoursFromTimes(entry.startTime, entry.endTime),
        }),
      });
      if (res.ok) {
        const record: AttendanceRecord = await res.json();
        setTodayByEntry((prev) => ({ ...prev, [entry.id]: record }));
        // The server may have adopted a previously-untagged same-day record
        // for this course - drop it from the fallback so it isn't also
        // shown for a different entry of the same course.
        setTodayByCourseFallback((prev) => {
          if (!(entry.courseId in prev)) return prev;
          const next = { ...prev };
          delete next[entry.courseId];
          return next;
        });
      }
    } catch (error) {
      console.error("Error marking attendance:", error);
    }
  };

  const clearAttendance = async (entry: TimetableEntry) => {
    const record = getTodayRecordForEntry(entry);
    if (!record) return;
    try {
      const res = await fetch(`/api/attendance?id=${record.id}`, { method: "DELETE" });
      if (res.ok) {
        setTodayByEntry((prev) => {
          if (!(entry.id in prev)) return prev;
          const next = { ...prev };
          delete next[entry.id];
          return next;
        });
        setTodayByCourseFallback((prev) => {
          if (!(entry.courseId in prev)) return prev;
          const next = { ...prev };
          delete next[entry.courseId];
          return next;
        });
      }
    } catch (error) {
      console.error("Error clearing attendance:", error);
    }
  };

  const entriesByDay = DAYS.map((day, dayIndex) =>
    timetableEntries.filter((entry) => entry.dayOfWeek === dayIndex)
  );

  // Two entries for the same course at the exact same day/time are almost
  // always a leftover from a mis-scanned re-upload, not a real second
  // session - and each copy inflates that course's weekly (and therefore
  // semester) hour total, which is what makes the Attendance tab's totals
  // stop matching what the Timetable actually shows.
  const duplicateGroups = (() => {
    const seen = new Map<string, TimetableEntry[]>();
    for (const entry of timetableEntries) {
      const key = `${entry.courseId}|${entry.dayOfWeek}|${entry.startTime}|${entry.endTime}`;
      const list = seen.get(key) || [];
      list.push(entry);
      seen.set(key, list);
    }
    return Array.from(seen.values()).filter((group) => group.length > 1);
  })();

  // Back-to-back entries for the same course on the same day (e.g. three
  // separate 1-hour rows from an hourly-grid scan) should read as one
  // continuous session. New entries auto-merge on save; this only surfaces
  // leftovers created before that existed.
  const mergeableGroups = (() => {
    const byCourseDay = new Map<string, TimetableEntry[]>();
    for (const entry of timetableEntries) {
      const key = `${entry.courseId}|${entry.dayOfWeek}`;
      const list = byCourseDay.get(key) || [];
      list.push(entry);
      byCourseDay.set(key, list);
    }
    const groups: TimetableEntry[][] = [];
    for (const list of byCourseDay.values()) {
      if (list.length < 2) continue;
      const sorted = [...list].sort((a, b) => a.startTime.localeCompare(b.startTime));
      let chain: TimetableEntry[] = [sorted[0]];
      for (let i = 1; i < sorted.length; i++) {
        if (chain[chain.length - 1].endTime === sorted[i].startTime) {
          chain.push(sorted[i]);
        } else {
          if (chain.length > 1) groups.push(chain);
          chain = [sorted[i]];
        }
      }
      if (chain.length > 1) groups.push(chain);
    }
    return groups;
  })();

  if (status === "loading" || isLoading || isResolvingSemester) {
    return <PageLoader />;
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <DashboardNav semesterId={semesterId} />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-bold text-foreground">Timetable</h1>
          {semesterId && (
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => (showForm ? resetEntryForm() : setShowForm(true))}
              >
                {showForm ? (
                  <>
                    <X className="h-4 w-4" /> Cancel
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" /> Add Class
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowUpload(!showUpload);
                  setUploadResult(null);
                }}
              >
                {showUpload ? (
                  <>
                    <X className="h-4 w-4" /> Cancel
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" /> Upload Timetable
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {duplicateGroups.length > 0 && (
          <div className="frosted-inset mb-8 rounded-2xl border border-destructive/40 p-4 text-sm">
            <p className="font-semibold text-destructive">
              Duplicate classes found - these are being counted twice in your attendance
              totals and credit hours:
            </p>
            <ul className="mt-2 list-inside list-disc text-foreground">
              {duplicateGroups.map((group, i) => {
                const e = group[0];
                return (
                  <li key={i}>
                    {e.course.name} on {DAYS[e.dayOfWeek]} {formatTime12h(e.startTime)}-
                    {formatTime12h(e.endTime)} (appears {group.length} times)
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-muted-foreground">
              Delete the extra one below using its trash icon, then edit that course&apos;s
              credit hours if needed.
            </p>
          </div>
        )}

        {mergeableGroups.length > 0 && (
          <div className="frosted-inset mb-8 rounded-2xl border border-warning/40 p-4 text-sm">
            <p className="font-semibold text-warning">
              These back-to-back classes look like one continuous session split into
              separate hours:
            </p>
            <ul className="mt-2 list-inside list-disc text-foreground">
              {mergeableGroups.map((group, i) => (
                <li key={i}>
                  {group[0].course.name} on {DAYS[group[0].dayOfWeek]}{" "}
                  {formatTime12h(group[0].startTime)}-
                  {formatTime12h(group[group.length - 1].endTime)} (currently {group.length}{" "}
                  separate entries)
                </li>
              ))}
            </ul>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={handleMergeAdjacent}
              disabled={isMergingAdjacent}
            >
              {isMergingAdjacent ? "Merging..." : "Merge Now"}
            </Button>
          </div>
        )}

        {hasNoSemesters ? (
          <NoSemesterState />
        ) : (
          <>
            {/* Courses */}
            <div className="frosted mb-8 rounded-2xl p-6">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-foreground">Courses</h2>
                <div className="flex items-center gap-2">
                  <Link href={`/dashboard/study?semesterId=${semesterId}`}>
                    <Button size="sm" variant="outline">
                      <BookOpen className="h-4 w-4" /> Study Notebook
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant={showAddCourseForm ? "outline" : "default"}
                    onClick={() => {
                      setEditingCourseId(null);
                      setShowAddCourseForm((v) => !v);
                    }}
                  >
                    {showAddCourseForm ? (
                      <>
                        <X className="h-4 w-4" /> Cancel
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" /> Add Course
                      </>
                    )}
                  </Button>
                </div>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                Add each course you&apos;re taking this semester. You&apos;ll need at
                least one before you can add classes, mark attendance, or record
                grades.
              </p>

              {courses.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2">
                  {courses.map((course) => (
                    <CoursePill
                      key={course.id}
                      name={course.name}
                      creditHours={course.creditHours}
                      active={editingCourseId === course.id}
                      onEdit={() => startEditCourse(course)}
                      onDelete={() => handleDeleteCourse(course.id)}
                    />
                  ))}
                </div>
              )}

              {editingCourseId && (
                <div className="frosted-inset space-y-4 rounded-2xl p-4">
                  <h3 className="text-sm font-semibold text-foreground">Edit Course</h3>
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[200px] flex-1">
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        Course Name
                      </label>
                      <Input
                        value={editCourseName}
                        onChange={(e) => setEditCourseName(e.target.value)}
                      />
                    </div>
                    <div className="w-40">
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        Credit Hours
                      </label>
                      {editScheduleRowsWithTimes.length > 0 ? (
                        <div className="frosted flex h-11 items-center rounded-xl px-4 text-sm text-foreground">
                          {editScheduleCreditHours}{" "}
                          <span className="ml-1 text-xs text-muted-foreground">(auto)</span>
                        </div>
                      ) : (
                        <Input
                          type="number"
                          min="0.5"
                          step="0.5"
                          value={editCourseCredits}
                          onChange={(e) => setEditCourseCredits(parseFloat(e.target.value))}
                        />
                      )}
                    </div>
                  </div>

                  <CourseScheduleRows rows={editCourseSchedule} onChange={setEditCourseSchedule} />

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      onClick={() => handleSaveCourseEdit(editingCourseId)}
                      disabled={isSavingCourseEdit}
                    >
                      {isSavingCourseEdit ? "Saving..." : "Save Changes"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setEditingCourseId(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {showAddCourseForm && (
                <form onSubmit={handleAddCourse} className="space-y-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[200px] flex-1">
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        Course Name
                      </label>
                      <Input
                        value={newCourseName}
                        onChange={(e) => setNewCourseName(e.target.value)}
                        placeholder="e.g., Investment Analysis"
                      />
                    </div>
                    <div className="w-40">
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        Credit Hours
                      </label>
                      {scheduleRowsWithTimes.length > 0 ? (
                        <div className="frosted-inset flex h-11 items-center rounded-xl px-4 text-sm text-foreground">
                          {scheduleCreditHours}{" "}
                          <span className="ml-1 text-xs text-muted-foreground">(auto)</span>
                        </div>
                      ) : (
                        <Input
                          type="number"
                          min="0.5"
                          step="0.5"
                          value={newCourseCredits}
                          onChange={(e) => setNewCourseCredits(parseFloat(e.target.value))}
                        />
                      )}
                    </div>
                  </div>

                  <CourseScheduleRows rows={newCourseSchedule} onChange={setNewCourseSchedule} />

                  <Button type="submit" disabled={isAddingCourse}>
                    <Plus className="h-4 w-4" /> Add Course
                  </Button>
                </form>
              )}
            </div>

            {/* Upload & Auto-Extract */}
            {showUpload && (
              <div className="frosted mb-8 rounded-2xl p-6">
                <h2 className="mb-2 text-xl font-semibold text-foreground">
                  Upload Timetable (PDF/JPG/PNG)
                </h2>
                <p className="mb-4 text-sm text-muted-foreground">
                  List your own subjects below, then upload a photo or PDF of your
                  full class timetable. We&apos;ll read it and add only your classes
                  to your schedule below.
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">
                      Your subjects (comma-separated)
                    </label>
                    <Input
                      value={subjectsInput}
                      onChange={(e) => setSubjectsInput(e.target.value)}
                      placeholder="e.g. BC, MTI, HRM, IB3, IA3, IF1, BM1"
                      disabled={isUploading}
                    />
                  </div>

                  <label>
                    <span
                      className={`frosted-sm neu-pressable inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-foreground ${
                        isUploading ? "pointer-events-none opacity-50" : ""
                      }`}
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Reading timetable...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" /> Choose file
                        </>
                      )}
                    </span>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleFileUpload}
                      disabled={isUploading}
                      style={{ display: "none" }}
                    />
                  </label>

                  {uploadResult && (
                    <div
                      className={`frosted-inset flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
                        uploadResult.type === "success" ? "text-success" : "text-destructive"
                      }`}
                    >
                      {uploadResult.type === "success" ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                      ) : (
                        <AlertCircle className="h-4 w-4 shrink-0" />
                      )}
                      {uploadResult.message}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Form to Add/Edit Entry */}
            {showForm && (
              <div className="frosted mb-8 rounded-2xl p-6">
                <h2 className="mb-4 text-xl font-semibold text-foreground">
                  {editingEntryId ? "Edit Class" : "Add Class"}
                </h2>
                <form onSubmit={handleAddEntry} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        Course
                      </label>
                      <SelectNative
                        value={newEntry.courseId}
                        onChange={(e) =>
                          setNewEntry({ ...newEntry, courseId: e.target.value })
                        }
                        required
                      >
                        <option value="">Select a course</option>
                        {courses.map((course) => (
                          <option key={course.id} value={course.id}>
                            {course.name}
                          </option>
                        ))}
                      </SelectNative>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        Day
                      </label>
                      <SelectNative
                        value={newEntry.dayOfWeek}
                        onChange={(e) =>
                          setNewEntry({ ...newEntry, dayOfWeek: parseInt(e.target.value) })
                        }
                      >
                        {DAYS.map((day, index) => (
                          <option key={index} value={index}>
                            {day}
                          </option>
                        ))}
                      </SelectNative>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        Start Time
                      </label>
                      <Input
                        type="time"
                        value={newEntry.startTime}
                        onChange={(e) =>
                          setNewEntry({ ...newEntry, startTime: e.target.value })
                        }
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        End Time
                      </label>
                      <Input
                        type="time"
                        value={newEntry.endTime}
                        onChange={(e) =>
                          setNewEntry({ ...newEntry, endTime: e.target.value })
                        }
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        Room (Optional)
                      </label>
                      <Input
                        value={newEntry.room}
                        onChange={(e) =>
                          setNewEntry({ ...newEntry, room: e.target.value })
                        }
                        placeholder="e.g., A101"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        Instructor (Optional)
                      </label>
                      <Input
                        value={newEntry.instructor}
                        onChange={(e) =>
                          setNewEntry({ ...newEntry, instructor: e.target.value })
                        }
                        placeholder="e.g., Dr. Smith"
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full">
                    {editingEntryId ? "Save Changes" : "Add to Timetable"}
                  </Button>
                </form>
              </div>
            )}

            {/* Timetable Grid - a day with no classes is just noise once it's
                one of six identical "No classes" cards, so it collapses to a
                single compact row; only Today and days that actually have
                something scheduled get the full card treatment. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
              {DAYS.map((day, dayIndex) => {
                const dayEntries = entriesByDay[dayIndex];
                const isToday = dayIndex === todayDayIndex;

                if (dayEntries.length === 0 && !isToday) {
                  return (
                    <div
                      key={dayIndex}
                      className="frosted-inset flex items-center justify-between rounded-xl px-4 py-2.5 text-sm"
                    >
                      <span className="font-medium text-foreground">{day}</span>
                      <span className="text-muted-foreground">No classes</span>
                    </div>
                  );
                }

                return (
                  <div key={dayIndex} className="frosted rounded-2xl p-4">
                    <h3 className="mb-4 flex items-center justify-center gap-2 font-semibold text-foreground">
                      {day}
                      {isToday && (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                          Today
                        </span>
                      )}
                    </h3>
                    <div className="space-y-2">
                      {dayEntries.length === 0 ? (
                        <p className="text-center text-sm text-muted-foreground">
                          No classes scheduled
                        </p>
                      ) : isToday ? (
                        dayEntries.map((entry) => (
                          <TodayClassChip
                            key={entry.id}
                            courseName={entry.course.name}
                            startTime={entry.startTime}
                            endTime={entry.endTime}
                            room={entry.room}
                            instructor={entry.instructor}
                            status={
                              (getTodayRecordForEntry(entry)?.status as TodayAttendanceStatus) ||
                              null
                            }
                            onMarkPresent={() => markAttendance(entry, "PRESENT")}
                            onMarkAbsent={() => markAttendance(entry, "ABSENT")}
                            onMarkCancelled={() => markAttendance(entry, "CANCELLED")}
                            onClear={() => clearAttendance(entry)}
                            onEdit={() => startEditEntry(entry)}
                            onDelete={() => handleDeleteEntry(entry.id)}
                          />
                        ))
                      ) : (
                        dayEntries.map((entry) => (
                          <ScheduleClassChip
                            key={entry.id}
                            courseName={entry.course.name}
                            startTime={entry.startTime}
                            endTime={entry.endTime}
                            room={entry.room}
                            instructor={entry.instructor}
                            onEdit={() => startEditEntry(entry)}
                            onDelete={() => handleDeleteEntry(entry.id)}
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
