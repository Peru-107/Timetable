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
import { Plus, X, Upload } from "lucide-react";

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

    const formData = new FormData();
    formData.append("file", file);
    formData.append("semesterId", semesterId || "");

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        alert(`${data.message}\n\n${data.status}`);
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Error uploading file");
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
              <label>
                <Button variant="outline" asChild>
                  <span>
                    <Upload className="h-4 w-4" /> Upload (PDF/JPG/PNG)
                  </span>
                </Button>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileUpload}
                  style={{ display: "none" }}
                />
              </label>
            </div>
          )}
        </div>

        {hasNoSemesters ? (
          <NoSemesterState />
        ) : (
          <>
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
