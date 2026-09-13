"use client";

import { Suspense, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface AttendanceRecord {
  id: string;
  date: string;
  isPresent: boolean;
  hoursDuration: number;
  notes?: string;
  course: {
    name: string;
  };
}

interface AttendanceStats {
  totalHours: number;
  attendedHours: number;
  attendancePercentage: number;
  requiredHours: number;
  leavesAvailable: number;
  leavesUsed: number;
}

export default function AttendancePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-lg">Loading...</div>
        </div>
      }
    >
      <AttendanceContent />
    </Suspense>
  );
}

function AttendanceContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const semesterId = searchParams.get("semesterId");

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [courses, setCourses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [newRecord, setNewRecord] = useState({
    courseId: "",
    date: new Date().toISOString().split("T")[0],
    isPresent: true,
    hoursDuration: 2,
    notes: "",
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (semesterId) {
      fetchAttendance();
      fetchCourses();
    }
  }, [semesterId]);

  const fetchAttendance = async () => {
    try {
      const res = await fetch(`/api/attendance?semesterId=${semesterId}`);
      const data = await res.json();
      setRecords(data.records);
      setStats(data.stats);
    } catch (error) {
      console.error("Error fetching attendance:", error);
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

  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRecord),
      });

      if (res.ok) {
        setNewRecord({
          courseId: "",
          date: new Date().toISOString().split("T")[0],
          isPresent: true,
          hoursDuration: 2,
          notes: "",
        });
        setShowForm(false);
        fetchAttendance();
      }
    } catch (error) {
      console.error("Error adding attendance record:", error);
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  const chartData = [
    {
      name: "Attendance",
      percentage: stats?.attendancePercentage || 0,
    },
  ];

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
          <h1 className="text-3xl font-bold text-gray-800">Attendance</h1>
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "+ Mark Attendance"}
          </Button>
        </div>

        {/* Statistics */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-600 mb-2">
                Attendance %
              </h3>
              <p className="text-3xl font-bold text-blue-600">
                {stats.attendancePercentage}%
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-600 mb-2">
                Hours Attended
              </h3>
              <p className="text-3xl font-bold text-green-600">
                {stats.attendedHours}/{stats.totalHours}
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-600 mb-2">
                Leaves Available
              </h3>
              <p className="text-3xl font-bold text-purple-600">
                {stats.leavesAvailable}
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-600 mb-2">
                Status
              </h3>
              <p
                className={`text-xl font-bold ${
                  stats.attendancePercentage >= 80
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {stats.attendancePercentage >= 80 ? "✓ Safe" : "⚠ At Risk"}
              </p>
            </div>
          </div>
        )}

        {/* Form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">
              Mark Attendance
            </h2>
            <form onSubmit={handleAddRecord} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Course
                  </label>
                  <select
                    value={newRecord.courseId}
                    onChange={(e) =>
                      setNewRecord({ ...newRecord, courseId: e.target.value })
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
                    Date
                  </label>
                  <Input
                    type="date"
                    value={newRecord.date}
                    onChange={(e) =>
                      setNewRecord({ ...newRecord, date: e.target.value })
                    }
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={newRecord.isPresent ? "present" : "absent"}
                    onChange={(e) =>
                      setNewRecord({
                        ...newRecord,
                        isPresent: e.target.value === "present",
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duration (hours)
                  </label>
                  <Input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={newRecord.hoursDuration}
                    onChange={(e) =>
                      setNewRecord({
                        ...newRecord,
                        hoursDuration: parseFloat(e.target.value),
                      })
                    }
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <Input
                  type="text"
                  value={newRecord.notes}
                  onChange={(e) =>
                    setNewRecord({ ...newRecord, notes: e.target.value })
                  }
                  placeholder="e.g., Left early"
                />
              </div>

              <Button type="submit" className="w-full">
                Save Attendance
              </Button>
            </form>
          </div>
        )}

        {/* Chart */}
        {stats && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">
              Attendance Overview
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="percentage" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Records List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">
              Attendance Records
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Course
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                      No attendance records yet
                    </td>
                  </tr>
                ) : (
                  records.map((record) => (
                    <tr
                      key={record.id}
                      className="border-b border-gray-200 hover:bg-gray-50"
                    >
                      <td className="px-6 py-4 text-sm text-gray-800">
                        {new Date(record.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800">
                        {record.course.name}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            record.isPresent
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {record.isPresent ? "Present" : "Absent"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800">
                        {record.hoursDuration}h
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {record.notes || "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
