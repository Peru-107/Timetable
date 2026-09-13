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
import { useActiveSemester } from "@/lib/hooks/useActiveSemester";
import { Plus, X, Upload, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface TimetableEntry {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room?: string;
  instructor?: string;
  course: {
    name: string;
  };
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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
  const [courses, setCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [subjectsInput, setSubjectsInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (semesterId) {
      fetchTimetable();
      fetchCourses();
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

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newEntry, semesterId }),
      });

      if (res.ok) {
        setNewEntry({
          courseId: "",
          dayOfWeek: 0,
          startTime: "09:00",
          endTime: "11:00",
          room: "",
          instructor: "",
        });
        setShowForm(false);
        fetchTimetable();
      }
    } catch (error) {
      console.error("Error adding timetable entry:", error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!subjectsInput.trim()) {
      setUploadResult({
        type: "error",
        message: "List your subjects above first, so we know what to look for.",
      });
      e.target.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("semesterId", semesterId || "");
    formData.append("subjects", subjectsInput);

    setIsUploading(true);
    setUploadResult(null);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        setUploadResult({ type: "success", message: data.message });
        fetchTimetable();
        fetchCourses();
      } else {
        setUploadResult({ type: "error", message: data.error || "Could not process the file" });
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      setUploadResult({ type: "error", message: "Error uploading file" });
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const entriesByDay = DAYS.map((day, dayIndex) =>
    timetableEntries.filter((entry) => entry.dayOfWeek === dayIndex)
  );

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
              <Button onClick={() => setShowForm(!showForm)}>
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

        {hasNoSemesters ? (
          <NoSemesterState />
        ) : (
          <>
            {/* Upload & Auto-Extract */}
            {showUpload && (
              <div className="neu-raised mb-8 rounded-2xl p-6">
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
                      className={`neu-pressable neu-raised inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-foreground ${
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
                      className={`neu-inset flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
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

            {/* Form to Add Entry */}
            {showForm && (
              <div className="neu-raised mb-8 rounded-2xl p-6">
                <h2 className="mb-4 text-xl font-semibold text-foreground">
                  Add Class
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
                        {courses.map((course: any) => (
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
                    Add to Timetable
                  </Button>
                </form>
              </div>
            )}

            {/* Timetable Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-7">
              {DAYS.map((day, dayIndex) => (
                <div key={dayIndex} className="neu-raised rounded-2xl p-4">
                  <h3 className="mb-4 text-center font-semibold text-foreground">
                    {day}
                  </h3>
                  <div className="space-y-2">
                    {entriesByDay[dayIndex].length === 0 ? (
                      <p className="text-center text-sm text-muted-foreground">
                        No classes
                      </p>
                    ) : (
                      entriesByDay[dayIndex].map((entry) => (
                        <div key={entry.id} className="neu-inset rounded-xl p-3">
                          <p className="text-sm font-semibold text-foreground">
                            {entry.course.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
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
