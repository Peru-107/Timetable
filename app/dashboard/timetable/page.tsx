"use client";

import { Suspense, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

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
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-lg">Loading...</div>
        </div>
      }
    >
      <TimetableContent />
    </Suspense>
  );
}

function TimetableContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const semesterId = searchParams.get("semesterId");

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
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (semesterId) {
      fetchTimetable();
      fetchCourses();
    }
  }, [semesterId]);

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

  // Group entries by day
  const entriesByDay = DAYS.map((day, dayIndex) =>
    timetableEntries.filter((entry) => entry.dayOfWeek === dayIndex)
  );

  if (status === "loading" || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="space-x-4">
            <Link href="/dashboard">
              <Button variant="ghost">← Dashboard</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Timetable</h1>
          <div className="space-x-4">
            <Button onClick={() => setShowForm(!showForm)}>
              {showForm ? "Cancel" : "+ Add Class"}
            </Button>
            <label>
              <Button variant="outline" asChild>
                <span>📁 Upload (PDF/JPG/PNG)</span>
              </Button>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileUpload}
                style={{ display: "none" }}
              />
            </label>
          </div>
        </div>

        {/* Form to Add Entry */}
        {showForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Add Class</h2>
            <form onSubmit={handleAddEntry} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Course
                  </label>
                  <select
                    value={newEntry.courseId}
                    onChange={(e) =>
                      setNewEntry({ ...newEntry, courseId: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  >
                    <option value="">Select a course</option>
                    {courses.map((course: any) => (
                      <option key={course.id} value={course.id}>
                        {course.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Day
                  </label>
                  <select
                    value={newEntry.dayOfWeek}
                    onChange={(e) =>
                      setNewEntry({ ...newEntry, dayOfWeek: parseInt(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    {DAYS.map((day, index) => (
                      <option key={index} value={index}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
          {DAYS.map((day, dayIndex) => (
            <div key={dayIndex} className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold text-gray-800 mb-4 text-center">
                {day}
              </h3>
              <div className="space-y-2">
                {entriesByDay[dayIndex].length === 0 ? (
                  <p className="text-gray-400 text-sm text-center">No classes</p>
                ) : (
                  entriesByDay[dayIndex].map((entry) => (
                    <div
                      key={entry.id}
                      className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded"
                    >
                      <p className="font-semibold text-sm text-gray-800">
                        {entry.course.name}
                      </p>
                      <p className="text-xs text-gray-600">
                        {entry.startTime} - {entry.endTime}
                      </p>
                      {entry.room && (
                        <p className="text-xs text-gray-500">Room: {entry.room}</p>
                      )}
                      {entry.instructor && (
                        <p className="text-xs text-gray-500">
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
      </div>
    </div>
  );
}
