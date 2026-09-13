"use client";

import { Suspense, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/ui/select-native";
import { DashboardNav } from "@/components/DashboardNav";
import { PageLoader } from "@/components/PageLoader";
import { NoSemesterState } from "@/components/NoSemesterState";
import { TodayClassChip, type TodayAttendanceStatus } from "@/components/TodayClassChip";
import { useActiveSemester } from "@/lib/hooks/useActiveSemester";
import { computeHoursFromTimes, startOfDay } from "@/lib/attendanceUtils";
import {
  Plus,
  X,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Pencil,
  Trash2,
  Check,
} from "lucide-react";

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
  const [newCourseName, setNewCourseName] = useState("");
  const [newCourseCredits, setNewCourseCredits] = useState(3);
  const [newCourseSchedule, setNewCourseSchedule] = useState<
    Array<{ dayOfWeek: number; startTime: string; endTime: string }>
  >([{ dayOfWeek: 1, startTime: "09:00", endTime: "10:00" }]);
  const [isAddingCourse, setIsAddingCourse] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editCourseName, setEditCourseName] = useState("");
  const [editCourseCredits, setEditCourseCredits] = useState(3);
  const [showUpload, setShowUpload] = useState(false);
  const [subjectsInput, setSubjectsInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<Record<string, AttendanceRecord>>({});

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

      const map: Record<string, AttendanceRecord> = {};
      for (const record of records) {
        const recordDate = new Date(record.date);
        if (recordDate >= dayStart && recordDate <= dayEnd) {
          map[record.courseId] = record;
        }
      }
      setTodayAttendance(map);
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

  const addCourseScheduleRow = () => {
    setNewCourseSchedule((rows) => [...rows, { dayOfWeek: 1, startTime: "09:00", endTime: "10:00" }]);
  };

  const removeCourseScheduleRow = (index: number) => {
    setNewCourseSchedule((rows) => rows.filter((_, i) => i !== index));
  };

  const updateCourseScheduleRow = (
    index: number,
    field: "dayOfWeek" | "startTime" | "endTime",
    value: string | number
  ) => {
    setNewCourseSchedule((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

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
        fetchCourses();
        if (scheduleRowsWithTimes.length > 0) fetchTimetable();
      }
    } catch (error) {
      console.error("Error adding course:", error);
    } finally {
      setIsAddingCourse(false);
    }
  };

  const startEditCourse = (course: Course) => {
    setEditingCourseId(course.id);
    setEditCourseName(course.name);
    setEditCourseCredits(course.creditHours);
  };

  const handleSaveCourseEdit = async (id: string) => {
    if (!editCourseName.trim()) return;
    try {
      const res = await fetch("/api/courses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: editCourseName.trim(), creditHours: editCourseCredits }),
      });
      if (res.ok) {
        setEditingCourseId(null);
        fetchCourses();
        fetchTimetable();
      }
    } catch (error) {
      console.error("Error updating course:", error);
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
          date: startOfDay(new Date()).toISOString(),
          status: entryStatus,
          hoursDuration: computeHoursFromTimes(entry.startTime, entry.endTime),
        }),
      });
      if (res.ok) {
        const record = await res.json();
        setTodayAttendance((prev) => ({ ...prev, [entry.courseId]: record }));
      }
    } catch (error) {
      console.error("Error marking attendance:", error);
    }
  };

  const clearAttendance = async (courseId: string) => {
    const record = todayAttendance[courseId];
    if (!record) return;
    try {
      const res = await fetch(`/api/attendance?id=${record.id}`, { method: "DELETE" });
      if (res.ok) {
        setTodayAttendance((prev) => {
          const next = { ...prev };
          delete next[courseId];
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
                    {e.course.name} on {DAYS[e.dayOfWeek]} {e.startTime}-{e.endTime} (appears{" "}
                    {group.length} times)
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

        {hasNoSemesters ? (
          <NoSemesterState />
        ) : (
          <>
            {/* Courses */}
            <div className="frosted mb-8 rounded-2xl p-6">
              <h2 className="mb-2 text-xl font-semibold text-foreground">
                Courses
              </h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Add each course you&apos;re taking this semester. You&apos;ll need at
                least one before you can add classes, mark attendance, or record
                grades.
              </p>

              {courses.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2">
                  {courses.map((course) =>
                    editingCourseId === course.id ? (
                      <div
                        key={course.id}
                        className="frosted-inset flex items-center gap-2 rounded-full px-3 py-1"
                      >
                        <input
                          value={editCourseName}
                          onChange={(e) => setEditCourseName(e.target.value)}
                          className="w-28 border-0 bg-transparent text-sm text-foreground focus:outline-none"
                        />
                        <input
                          type="number"
                          min="0.5"
                          step="0.5"
                          value={editCourseCredits}
                          onChange={(e) => setEditCourseCredits(parseFloat(e.target.value))}
                          className="w-12 border-0 bg-transparent text-sm text-foreground focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveCourseEdit(course.id)}
                          className="text-success"
                          aria-label="Save course"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCourseId(null)}
                          className="text-muted-foreground"
                          aria-label="Cancel edit"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span
                        key={course.id}
                        className="frosted-inset flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium text-foreground"
                      >
                        {course.name}
                        <span className="font-mono text-xs text-muted-foreground">
                          {course.creditHours} cr
                        </span>
                        <button
                          type="button"
                          onClick={() => startEditCourse(course)}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label="Edit course"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCourse(course.id)}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Delete course"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </span>
                    )
                  )}
                </div>
              )}

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

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Weekly Schedule (Optional)
                  </label>
                  <div className="space-y-2">
                    {newCourseSchedule.map((row, index) => (
                      <div key={index} className="flex flex-wrap items-center gap-2">
                        <SelectNative
                          value={row.dayOfWeek}
                          onChange={(e) =>
                            updateCourseScheduleRow(index, "dayOfWeek", parseInt(e.target.value))
                          }
                          className="w-36"
                        >
                          {DAYS.map((day, dayIdx) => (
                            <option key={dayIdx} value={dayIdx}>
                              {day}
                            </option>
                          ))}
                        </SelectNative>
                        <Input
                          type="time"
                          value={row.startTime}
                          onChange={(e) => updateCourseScheduleRow(index, "startTime", e.target.value)}
                          className="w-32"
                        />
                        <span className="text-sm text-muted-foreground">to</span>
                        <Input
                          type="time"
                          value={row.endTime}
                          onChange={(e) => updateCourseScheduleRow(index, "endTime", e.target.value)}
                          className="w-32"
                        />
                        <button
                          type="button"
                          onClick={() => removeCourseScheduleRow(index)}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Remove this day"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={addCourseScheduleRow}
                    className="mt-2 flex items-center gap-1 text-sm font-medium text-primary"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add another day
                  </button>
                </div>

                <Button type="submit" disabled={isAddingCourse}>
                  <Plus className="h-4 w-4" /> Add Course
                </Button>
              </form>
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

            {/* Timetable Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-7">
              {DAYS.map((day, dayIndex) => (
                <div key={dayIndex} className="frosted rounded-2xl p-4">
                  <h3 className="mb-4 text-center font-semibold text-foreground">
                    {day}
                    {dayIndex === todayDayIndex && (
                      <span className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        Today
                      </span>
                    )}
                  </h3>
                  <div className="space-y-2">
                    {entriesByDay[dayIndex].length === 0 ? (
                      <p className="text-center text-sm text-muted-foreground">
                        No classes
                      </p>
                    ) : dayIndex === todayDayIndex ? (
                      entriesByDay[dayIndex].map((entry) => (
                        <TodayClassChip
                          key={entry.id}
                          courseName={entry.course.name}
                          startTime={entry.startTime}
                          endTime={entry.endTime}
                          room={entry.room}
                          instructor={entry.instructor}
                          status={
                            (todayAttendance[entry.courseId]?.status as TodayAttendanceStatus) ||
                            null
                          }
                          onMarkPresent={() => markAttendance(entry, "PRESENT")}
                          onMarkAbsent={() => markAttendance(entry, "ABSENT")}
                          onMarkCancelled={() => markAttendance(entry, "CANCELLED")}
                          onClear={() => clearAttendance(entry.courseId)}
                          onEdit={() => startEditEntry(entry)}
                          onDelete={() => handleDeleteEntry(entry.id)}
                        />
                      ))
                    ) : (
                      entriesByDay[dayIndex].map((entry) => (
                        <div key={entry.id} className="frosted-inset relative rounded-xl p-3">
                          <div className="absolute right-2 top-2 flex gap-1">
                            <button
                              type="button"
                              onClick={() => startEditEntry(entry)}
                              className="text-muted-foreground hover:text-foreground"
                              aria-label="Edit class"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteEntry(entry.id)}
                              className="text-muted-foreground hover:text-destructive"
                              aria-label="Delete class"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <p className="pr-10 text-sm font-semibold text-foreground">
                            {entry.course.name}
                          </p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {entry.startTime} - {entry.endTime}
                          </p>
                          {entry.room && (
                            <p className="text-xs text-muted-foreground">
                              Room: {entry.room}
                            </p>
                          )}
                          {entry.instructor && (
                            <p className="text-xs text-muted-foreground">
                              {entry.instructor}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
