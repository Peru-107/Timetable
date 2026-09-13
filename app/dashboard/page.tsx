"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface Semester {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  courses: Array<any>;
}

interface AttendanceStats {
  totalHours: number;
  attendedHours: number;
  attendancePercentage: number;
  requiredHours: number;
  leavesAvailable: number;
  leavesUsed: number;
}

interface CGPAData {
  courses: Array<{
    name: string;
    grade: number;
    creditHours: number;
    gradePoints: number;
  }>;
  cgpa: number;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [activeSemester, setActiveSemester] = useState<Semester | null>(null);
  const [attendanceStats, setAttendanceStats] = useState<AttendanceStats | null>(null);
  const [cgpaData, setCGPAData] = useState<CGPAData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchSemesters();
    }
  }, [session?.user?.id]);

  const fetchSemesters = async () => {
    try {
      const res = await fetch("/api/semesters");
      const data = await res.json();
      setSemesters(data);
      if (data.length > 0) {
        setActiveSemester(data[0]);
        fetchAttendanceStats(data[0].id);
        fetchCGPA(data[0].id);
      }
    } catch (error) {
      console.error("Error fetching semesters:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAttendanceStats = async (semesterId: string) => {
    try {
      const res = await fetch(`/api/attendance?semesterId=${semesterId}`);
      const data = await res.json();
      setAttendanceStats(data.stats);
    } catch (error) {
      console.error("Error fetching attendance stats:", error);
    }
  };

  const fetchCGPA = async (semesterId: string) => {
    try {
      const res = await fetch(`/api/grades?semesterId=${semesterId}`);
      const data = await res.json();
      setCGPAData(data.cgpaData);
    } catch (error) {
      console.error("Error fetching CGPA:", error);
    }
  };

  const handleSemesterChange = (semester: Semester) => {
    setActiveSemester(semester);
    fetchAttendanceStats(semester.id);
    fetchCGPA(semester.id);
  };

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
          <h1 className="text-2xl font-bold text-gray-800">Timetable Tracker</h1>
          <div className="space-x-4">
            <Link href="/dashboard/timetable">
              <Button variant="outline">Timetable</Button>
            </Link>
            <Link href="/dashboard/attendance">
              <Button variant="outline">Attendance</Button>
            </Link>
            <Link href="/dashboard/grades">
              <Button variant="outline">Grades</Button>
            </Link>
            <Link href="/dashboard/calendar">
              <Button variant="outline">Calendar</Button>
            </Link>
            <Link href="/api/auth/signout">
              <Button variant="destructive">Logout</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Semester Selection */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Select Semester</h2>
          <div className="flex gap-4 flex-wrap">
            {semesters.map((sem) => (
              <Button
                key={sem.id}
                variant={activeSemester?.id === sem.id ? "default" : "outline"}
                onClick={() => handleSemesterChange(sem)}
              >
                {sem.name}
              </Button>
            ))}
            <Link href="/dashboard/semesters/new">
              <Button variant="outline">+ New Semester</Button>
            </Link>
          </div>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Attendance Card */}
          {attendanceStats && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Attendance
              </h3>
              <div className="text-4xl font-bold text-blue-600 mb-2">
                {attendanceStats.attendancePercentage}%
              </div>
              <p className="text-gray-600 mb-4">
                {attendanceStats.attendedHours}/{attendanceStats.totalHours} hours
              </p>
              <p className="text-sm text-gray-500">
                Leaves Available: {attendanceStats.leavesAvailable}
              </p>
              <p className="text-sm text-gray-500">
                Required: 80% ({attendanceStats.requiredHours} hours)
              </p>
            </div>
          )}

          {/* CGPA Card */}
          {cgpaData && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                CGPA
              </h3>
              <div className="text-4xl font-bold text-green-600 mb-2">
                {cgpaData.cgpa}/4.0
              </div>
              <p className="text-gray-600 mb-4">
                {cgpaData.courses.length} courses
              </p>
            </div>
          )}

          {/* Courses Card */}
          {activeSemester && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Courses
              </h3>
              <div className="text-4xl font-bold text-purple-600 mb-2">
                {activeSemester.courses.length}
              </div>
              <p className="text-gray-600">Active courses this semester</p>
            </div>
          )}
        </div>

        {/* Charts Section */}
        {attendanceStats && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Attendance Chart */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Attendance Distribution
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={[
                      {
                        name: "Attended",
                        value: attendanceStats.attendedHours,
                      },
                      {
                        name: "Remaining",
                        value: Math.max(
                          0,
                          attendanceStats.totalHours -
                            attendanceStats.attendedHours
                        ),
                      },
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ percent }) =>
                      `${(percent * 100).toFixed(0)}%`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    <Cell fill="#3b82f6" />
                    <Cell fill="#e5e7eb" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Requirements Chart */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Attendance vs Required
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={[
                    {
                      name: "Hours",
                      Attended: attendanceStats.attendedHours,
                      Required: attendanceStats.requiredHours,
                    },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Attended" fill="#3b82f6" />
                  <Bar dataKey="Required" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
