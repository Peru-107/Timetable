"use client";

import { Suspense, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, type Variants } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/ui/select-native";
import { DashboardNav } from "@/components/DashboardNav";
import { PageLoader } from "@/components/PageLoader";
import { NoSemesterState } from "@/components/NoSemesterState";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { useActiveSemester } from "@/lib/hooks/useActiveSemester";
import { computeHoursFromTimes } from "@/lib/attendanceUtils";

const statCardVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
};
import {
  Plus,
  X,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  Trash2,
  Check,
  Download,
} from "lucide-react";
import { toCsv, downloadCsv } from "@/lib/csv";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type AttendanceStatus = "PRESENT" | "ABSENT" | "CANCELLED";

interface AttendanceRecord {
  id: string;
  courseId: string;
  date: string;
  status: AttendanceStatus;
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

type AttendanceRiskLevel = "safe" | "warning" | "critical";

interface CourseAttendanceStat {
  courseId: string;
  courseName: string;
  totalHours: number;
  attendedHours: number;
  leavesUsed: number;
  hoursAvailableToMiss: number;
  attendancePercentage: number;
  classesAvailableToMiss: number;
  riskLevel: AttendanceRiskLevel;
}

const RISK_STYLE: Record<AttendanceRiskLevel, string> = {
  safe: "text-success",
  warning: "text-warning",
  critical: "text-destructive",
};

function riskMessage(c: CourseAttendanceStat): string {
  if (c.riskLevel === "critical") {
    return "Already below 80% - attend every remaining class to recover";
  }
  if (c.classesAvailableToMiss === 0) {
    return "Can't miss another class and stay at 80%";
  }
  if (c.classesAvailableToMiss === 1) {
    return "1 class of slack left";
  }
  return `${c.classesAvailableToMiss} classes of slack left`;
}

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  CANCELLED: "Cancelled",
};

const STATUS_CLASS: Record<AttendanceStatus, string> = {
  PRESENT: "text-success",
  ABSENT: "text-destructive",
  CANCELLED: "text-muted-foreground",
};

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
  const [statsByCourse, setStatsByCourse] = useState<CourseAttendanceStat[]>([]);
  const [courses, setCourses] = useState<Array<{ id: string; name: string }>>([]);
  const [timetableEntries, setTimetableEntries] = useState<
    Array<{ courseId: string; dayOfWeek: number; startTime: string; endTime: string }>
  >([]);
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [newRecord, setNewRecord] = useState({
    courseId: "",
    date: new Date().toISOString().split("T")[0],
    status: "PRESENT" as AttendanceStatus,
    hoursDuration: 2,
    notes: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRecord, setEditRecord] = useState({
    status: "PRESENT" as AttendanceStatus,
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
      fetchTimetableEntries();
    } else if (!isResolvingSemester) {
      setIsLoading(false);
    }
  }, [semesterId, isResolvingSemester]);

  // Default the manual form's duration to the selected course's actual
  // scheduled length for that day, instead of a one-size-fits-all guess -
  // still editable afterward for a one-off shorter/longer session.
  useEffect(() => {
    if (!newRecord.courseId || !newRecord.date) return;
    const dayOfWeek = new Date(`${newRecord.date}T00:00:00`).getDay();
    const matches = timetableEntries.filter(
      (e) => e.courseId === newRecord.courseId && e.dayOfWeek === dayOfWeek
    );
    if (matches.length === 0) return;
    const totalHours = matches.reduce(
      (sum, e) => sum + computeHoursFromTimes(e.startTime, e.endTime),
      0
    );
    setNewRecord((prev) => ({ ...prev, hoursDuration: totalHours }));
  }, [newRecord.courseId, newRecord.date, timetableEntries]);

  const fetchAttendance = async () => {
    try {
      const res = await fetch(`/api/attendance?semesterId=${semesterId}`);
      const data = await res.json();
      setRecords(data.records);
      setStats(data.stats);
      setStatsByCourse(data.statsByCourse || []);
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

  const fetchTimetableEntries = async () => {
    try {
      const res = await fetch(`/api/timetable?semesterId=${semesterId}`);
      const data = await res.json();
      setTimetableEntries(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching timetable entries:", error);
    }
  };

  const handleExportCsv = () => {
    const csv = toCsv(
      ["Date", "Course", "Status", "Duration (h)", "Notes"],
      records.map((r) => [
        new Date(r.date).toLocaleDateString(),
        r.course.name,
        STATUS_LABEL[r.status],
        r.hoursDuration,
        r.notes ?? "",
      ])
    );
    downloadCsv(`attendance-${new Date().toISOString().slice(0, 10)}.csv`, csv);
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
          status: "PRESENT",
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

  const startEditRecord = (record: AttendanceRecord) => {
    setEditingId(record.id);
    setEditRecord({
      status: record.status,
      hoursDuration: record.hoursDuration,
      notes: record.notes || "",
    });
  };

  const handleSaveEdit = async (id: string) => {
    try {
      const res = await fetch("/api/attendance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...editRecord }),
      });
      if (res.ok) {
        setEditingId(null);
        fetchAttendance();
      }
    } catch (error) {
      console.error("Error updating attendance record:", error);
    }
  };

  const handleDeleteRecord = async (id: string) => {
    if (!confirm("Delete this attendance record?")) return;
    try {
      const res = await fetch(`/api/attendance?id=${id}`, { method: "DELETE" });
      if (res.ok) fetchAttendance();
    } catch (error) {
      console.error("Error deleting attendance record:", error);
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
            <div className="flex items-center gap-2">
              {records.length > 0 && (
                <Button variant="outline" onClick={handleExportCsv}>
                  <Download className="h-4 w-4" /> Export CSV
                </Button>
              )}
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
            </div>
          )}
        </div>

        {hasNoSemesters ? (
          <NoSemesterState />
        ) : (
          <>
            {/* Statistics */}
            {stats && (
              <motion.div
                className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4"
                initial="hidden"
                animate="show"
                variants={{ show: { transition: { staggerChildren: 0.06 } } }}
              >
                <motion.div variants={statCardVariants} className="frosted rounded-2xl p-6">
                  <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                    Cumulative Attendance
                  </h3>
                  <p
                    className={`font-mono text-3xl font-bold ${
                      stats.attendancePercentage >= 80 ? "text-success" : "text-destructive"
                    }`}
                  >
                    <AnimatedNumber value={stats.attendancePercentage} suffix="%" />
                  </p>
                </motion.div>

                <motion.div variants={statCardVariants} className="frosted rounded-2xl p-6">
                  <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                    Hours Attended
                  </h3>
                  <p className="font-mono text-3xl font-bold text-success">
                    {stats.attendedHours}/{stats.totalHours}
                  </p>
                </motion.div>

                <motion.div variants={statCardVariants} className="frosted rounded-2xl p-6">
                  <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                    Hours You Can Still Miss
                  </h3>
                  <p className="font-mono text-3xl font-bold text-warning">
                    <AnimatedNumber value={stats.leavesAvailable} suffix="h" />
                  </p>
                </motion.div>

                <motion.div variants={statCardVariants} className="frosted rounded-2xl p-6">
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
                </motion.div>
              </motion.div>
            )}

            {/* Per-Subject Leave Balance */}
            {statsByCourse.length > 0 && (
              <div className="frosted mb-8 overflow-hidden rounded-2xl">
                <div className="px-6 py-4">
                  <h2 className="text-xl font-semibold text-foreground">
                    Per-Subject Leave Balance
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Each subject has its own semester-long hour total (weekly schedule ×
                    weeks in the semester) and its own 80% requirement.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-sm font-semibold text-muted-foreground">
                        <th className="px-6 py-3">Subject</th>
                        <th className="px-6 py-3">Attendance</th>
                        <th className="px-6 py-3">Classes You Can Still Miss</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statsByCourse.map((c) => (
                        <tr key={c.courseId}>
                          <td className="px-6 py-4 text-sm font-medium text-foreground">
                            {c.courseName}
                          </td>
                          <td className="px-6 py-4 font-mono text-sm text-foreground">
                            {c.attendancePercentage}%
                            <span className="ml-1 font-sans text-xs text-muted-foreground">
                              ({c.attendedHours}h / {c.totalHours}h)
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <div className="flex items-center gap-2">
                              <span
                                className={`frosted-inset flex h-8 min-w-8 items-center justify-center rounded-full px-2 font-mono text-sm font-bold ${RISK_STYLE[c.riskLevel]}`}
                              >
                                {c.riskLevel === "critical" ? "!" : c.classesAvailableToMiss}
                              </span>
                              <span className={`text-xs ${RISK_STYLE[c.riskLevel]}`}>
                                {riskMessage(c)}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Form */}
            {showForm && (
              <div className="frosted mb-8 rounded-2xl p-6">
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
                        {courses.map((course) => (
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
                        max={new Date().toISOString().split("T")[0]}
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
                        value={newRecord.status}
                        onChange={(e) =>
                          setNewRecord({
                            ...newRecord,
                            status: e.target.value as AttendanceStatus,
                          })
                        }
                      >
                        <option value="PRESENT">Present</option>
                        <option value="ABSENT">Absent</option>
                        <option value="CANCELLED">Cancelled</option>
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
              <div className="frosted mb-8 rounded-2xl p-6">
                <h2 className="mb-4 text-xl font-semibold text-foreground">
                  Attendance Overview
                </h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" stroke="var(--muted-foreground)" />
                    <YAxis domain={[0, 100]} stroke="var(--muted-foreground)" />
                    <Tooltip />
                    <Bar dataKey="percentage" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Records List */}
            <div className="frosted overflow-hidden rounded-2xl">
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
                      <th className="px-6 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                          No attendance records yet
                        </td>
                      </tr>
                    ) : (
                      records.map((record) =>
                        editingId === record.id ? (
                          <tr key={record.id} className="frosted-inset">
                            <td className="px-6 py-4 text-sm text-foreground">
                              {new Date(record.date).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 text-sm text-foreground">
                              {record.course.name}
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <SelectNative
                                value={editRecord.status}
                                onChange={(e) =>
                                  setEditRecord({
                                    ...editRecord,
                                    status: e.target.value as AttendanceStatus,
                                  })
                                }
                                className="h-9"
                              >
                                <option value="PRESENT">Present</option>
                                <option value="ABSENT">Absent</option>
                                <option value="CANCELLED">Cancelled</option>
                              </SelectNative>
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <Input
                                type="number"
                                min="0.5"
                                step="0.5"
                                className="h-9 w-20"
                                value={editRecord.hoursDuration}
                                onChange={(e) =>
                                  setEditRecord({
                                    ...editRecord,
                                    hoursDuration: parseFloat(e.target.value),
                                  })
                                }
                              />
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <Input
                                type="text"
                                className="h-9"
                                value={editRecord.notes}
                                onChange={(e) =>
                                  setEditRecord({ ...editRecord, notes: e.target.value })
                                }
                              />
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleSaveEdit(record.id)}
                                  className="text-success"
                                  aria-label="Save"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingId(null)}
                                  className="text-muted-foreground"
                                  aria-label="Cancel"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          <tr key={record.id}>
                            <td className="px-6 py-4 text-sm text-foreground">
                              {new Date(record.date).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 text-sm text-foreground">
                              {record.course.name}
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <span
                                className={`frosted-inset rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CLASS[record.status]}`}
                              >
                                {STATUS_LABEL[record.status]}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-foreground">
                              {record.hoursDuration}h
                            </td>
                            <td className="px-6 py-4 text-sm text-muted-foreground">
                              {record.notes || "-"}
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => startEditRecord(record)}
                                  className="text-muted-foreground hover:text-foreground"
                                  aria-label="Edit record"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRecord(record.id)}
                                  className="text-muted-foreground hover:text-destructive"
                                  aria-label="Delete record"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      )
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
