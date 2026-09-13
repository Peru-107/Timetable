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
import {
  Plus,
  X,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
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
    <Suspense fallback={<PageLoader />}>
      <AttendanceContent />
    </Suspense>
  );
}

function AttendanceContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { semesterId, isResolvingSemester, hasNoSemesters } = useActiveSemester();

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
    } else if (!isResolvingSemester) {
      setIsLoading(false);
    }
  }, [semesterId, isResolvingSemester]);

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

  if (status === "loading" || isLoading || isResolvingSemester) {
    return <PageLoader />;
  }

  const chartData = [
    {
      name: "Attendance",
      percentage: stats?.attendancePercentage || 0,
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-12">
      <DashboardNav semesterId={semesterId} />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-bold text-foreground">Attendance</h1>
          {semesterId && (
            <Button onClick={() => setShowForm(!showForm)}>
              {showForm ? (
                <>
                  <X className="h-4 w-4" /> Cancel
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" /> Mark Attendance
                </>
              )}
            </Button>
          )}
        </div>

        {hasNoSemesters ? (
          <NoSemesterState />
        ) : (
          <>
            {/* Statistics */}
            {stats && (
              <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="neu-raised rounded-2xl p-6">
                  <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                    Attendance %
                  </h3>
                  <p className="text-3xl font-bold text-primary">
                    {stats.attendancePercentage}%
                  </p>
                </div>

                <div className="neu-raised rounded-2xl p-6">
                  <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                    Hours Attended
                  </h3>
                  <p className="text-3xl font-bold text-success">
                    {stats.attendedHours}/{stats.totalHours}
                  </p>
                </div>

                <div className="neu-raised rounded-2xl p-6">
                  <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                    Leaves Available
                  </h3>
                  <p className="text-3xl font-bold text-warning">
                    {stats.leavesAvailable}
                  </p>
                </div>

                <div className="neu-raised rounded-2xl p-6">
                  <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                    Status
                  </h3>
                  <p
                    className={`flex items-center gap-2 text-xl font-bold ${
                      stats.attendancePercentage >= 80
                        ? "text-success"
                        : "text-destructive"
                    }`}
                  >
                    {stats.attendancePercentage >= 80 ? (
                      <>
                        <CheckCircle2 className="h-5 w-5" /> Safe
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-5 w-5" /> At Risk
                      </>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Form */}
            {showForm && (
              <div className="neu-raised mb-8 rounded-2xl p-6">
                <h2 className="mb-4 text-xl font-semibold text-foreground">
                  Mark Attendance
                </h2>
                <form onSubmit={handleAddRecord} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        Course
                      </label>
                      <SelectNative
                        value={newRecord.courseId}
                        onChange={(e) =>
                          setNewRecord({ ...newRecord, courseId: e.target.value })
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
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        Status
                      </label>
                      <SelectNative
                        value={newRecord.isPresent ? "present" : "absent"}
                        onChange={(e) =>
                          setNewRecord({
                            ...newRecord,
                            isPresent: e.target.value === "present",
                          })
                        }
                      >
                        <option value="present">Present</option>
                        <option value="absent">Absent</option>
                      </SelectNative>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
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
                    <label className="mb-2 block text-sm font-medium text-foreground">
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
              <div className="neu-raised mb-8 rounded-2xl p-6">
                <h2 className="mb-4 text-xl font-semibold text-foreground">
                  Attendance Overview
                </h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d6dce6" />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Bar dataKey="percentage" fill="#4f6ef7" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Records List */}
            <div className="neu-raised overflow-hidden rounded-2xl">
              <div className="px-6 py-4">
                <h2 className="text-xl font-semibold text-foreground">
                  Attendance Records
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm font-semibold text-muted-foreground">
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3">Course</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">Duration</th>
                      <th className="px-6 py-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                          No attendance records yet
                        </td>
                      </tr>
                    ) : (
                      records.map((record) => (
                        <tr key={record.id}>
                          <td className="px-6 py-4 text-sm text-foreground">
                            {new Date(record.date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-foreground">
                            {record.course.name}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <span
                              className={`neu-inset rounded-full px-3 py-1 text-xs font-semibold ${
                                record.isPresent ? "text-success" : "text-destructive"
                              }`}
                            >
                              {record.isPresent ? "Present" : "Absent"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-foreground">
                            {record.hoursDuration}h
                          </td>
                          <td className="px-6 py-4 text-sm text-muted-foreground">
                            {record.notes || "-"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
