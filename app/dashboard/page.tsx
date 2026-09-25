"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, type Variants } from "motion/react";
import { Button } from "@/components/ui/button";
import { DashboardNav } from "@/components/DashboardNav";
import { PageLoader } from "@/components/PageLoader";
import { NoSemesterState } from "@/components/NoSemesterState";
import { DailyAttendanceCard } from "@/components/DailyAttendanceCard";
import { SkipCalculatorCard, type CourseSkipStat } from "@/components/SkipCalculatorCard";
import { AttendanceChartCard } from "@/components/AttendanceChartCard";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import {
  ClipboardCheck,
  GraduationCap,
  BookMarked,
  BookOpen,
  Flame,
  ArrowRight,
  Plus,
  Pencil,
  Trash2,
  X,
  AlertCircle,
} from "lucide-react";

interface Semester {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  weeks: number;
  courses: Array<any>;
}

interface AttendanceStats {
  totalHours: number;
  attendedHours: number;
  heldHours: number;
  attendancePercentage: number;
  requiredHours: number;
  leavesAvailable: number;
  leavesUsed: number;
  currentStreakDays: number;
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

const statCardVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
};

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [activeSemester, setActiveSemester] = useState<Semester | null>(null);
  const [attendanceStats, setAttendanceStats] = useState<AttendanceStats | null>(null);
  const [courseStats, setCourseStats] = useState<CourseSkipStat[]>([]);
  const [cgpaData, setCGPAData] = useState<CGPAData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditSemester, setShowEditSemester] = useState(false);
  const [editSemesterForm, setEditSemesterForm] = useState({
    name: "",
    startDate: "",
    endDate: "",
    weeks: 15,
  });
  const [isSavingSemester, setIsSavingSemester] = useState(false);
  const [isDeletingSemester, setIsDeletingSemester] = useState(false);
  const [semesterError, setSemesterError] = useState("");

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
      } else {
        setActiveSemester(null);
        setAttendanceStats(null);
        setCourseStats([]);
        setCGPAData(null);
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
      setCourseStats(Array.isArray(data.statsByCourse) ? data.statsByCourse : []);
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
    setShowEditSemester(false);
    fetchAttendanceStats(semester.id);
    fetchCGPA(semester.id);
  };

  const startEditSemester = () => {
    if (!activeSemester) return;
    setEditSemesterForm({
      name: activeSemester.name,
      startDate: activeSemester.startDate.split("T")[0],
      endDate: activeSemester.endDate.split("T")[0],
      weeks: activeSemester.weeks,
    });
    setShowEditSemester(true);
  };

  const handleSaveSemester = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSemester) return;
    setIsSavingSemester(true);
    setSemesterError("");
    try {
      const res = await fetch("/api/semesters", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: activeSemester.id, ...editSemesterForm }),
      });
      if (res.ok) {
        setShowEditSemester(false);
        await fetchSemesters();
      } else {
        const data = await res.json().catch(() => null);
        setSemesterError(data?.error || "Couldn't save changes. Please try again.");
      }
    } catch (error) {
      console.error("Error updating semester:", error);
      setSemesterError("Couldn't save changes. Please try again.");
    } finally {
      setIsSavingSemester(false);
    }
  };

  const handleDeleteSemester = async () => {
    if (!activeSemester) return;
    if (
      !confirm(
        `Delete "${activeSemester.name}"? This permanently removes its courses, timetable, attendance, grades, and calendar events. This can't be undone.`
      )
    ) {
      return;
    }
    setIsDeletingSemester(true);
    try {
      const res = await fetch(`/api/semesters?id=${activeSemester.id}`, { method: "DELETE" });
      if (res.ok) {
        setShowEditSemester(false);
        await fetchSemesters();
      }
    } catch (error) {
      console.error("Error deleting semester:", error);
    } finally {
      setIsDeletingSemester(false);
    }
  };

  if (status === "loading" || isLoading) {
    return <PageLoader />;
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <DashboardNav semesterId={activeSemester?.id} />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Large title, iOS-style */}
        <div className="mb-4 px-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="font-display text-4xl font-bold tracking-tight text-foreground">Today</h1>
        </div>

        {/* Semester Selection */}
        <div className="mb-6">
          <h2 className="sr-only">Semester</h2>
          {/* One line that scrolls sideways instead of wrapping, so the
              edit button never ends up alone on a second row. */}
          <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
            {semesters.map((sem) => (
              <Button
                key={sem.id}
                variant={activeSemester?.id === sem.id ? "default" : "outline"}
                onClick={() => handleSemesterChange(sem)}
                className="flex-shrink-0"
              >
                {sem.name}
              </Button>
            ))}
            {semesters.length > 0 && (
              <Link href="/dashboard/semesters/new" className="flex-shrink-0">
                <Button variant="outline" size="icon" aria-label="New semester" title="New semester">
                  <Plus className="h-4 w-4" />
                </Button>
              </Link>
            )}
            {activeSemester && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setSemesterError("");
                  if (showEditSemester) {
                    setShowEditSemester(false);
                  } else {
                    startEditSemester();
                  }
                }}
                aria-label="Edit semester"
                className="flex-shrink-0"
              >
                {showEditSemester ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
              </Button>
            )}
          </div>

          {showEditSemester && activeSemester && (
            <form
              onSubmit={handleSaveSemester}
              className="frosted mt-4 flex flex-wrap items-end gap-3 rounded-2xl p-4"
            >
              {semesterError && (
                <div className="frosted-inset flex w-full items-center gap-2 rounded-xl px-4 py-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {semesterError}
                </div>
              )}
              <div className="min-w-[160px] flex-1">
                <label className="mb-2 block text-sm font-medium text-foreground">Name</label>
                <Input
                  value={editSemesterForm.name}
                  onChange={(e) => setEditSemesterForm({ ...editSemesterForm, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">Start Date</label>
                <Input
                  type="date"
                  value={editSemesterForm.startDate}
                  onChange={(e) => setEditSemesterForm({ ...editSemesterForm, startDate: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">End Date</label>
                <Input
                  type="date"
                  value={editSemesterForm.endDate}
                  onChange={(e) => setEditSemesterForm({ ...editSemesterForm, endDate: e.target.value })}
                  required
                />
              </div>
              <div className="w-32">
                <label className="mb-2 block text-sm font-medium text-foreground">Weeks</label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={editSemesterForm.weeks}
                  onChange={(e) =>
                    setEditSemesterForm({ ...editSemesterForm, weeks: parseInt(e.target.value) || 1 })
                  }
                  required
                />
              </div>
              <div className="flex w-full flex-wrap items-center justify-between gap-3">
                <Button type="submit" disabled={isSavingSemester}>
                  {isSavingSemester ? "Saving..." : "Save"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleDeleteSemester}
                  disabled={isDeletingSemester}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  {isDeletingSemester ? "Deleting..." : "Delete semester"}
                </Button>
              </div>
            </form>
          )}
        </div>

        {semesters.length === 0 && <NoSemesterState />}

        {semesters.length > 0 && activeSemester && (
          <>
            <DailyAttendanceCard
              semesterId={activeSemester.id}
              semesterStartDate={activeSemester.startDate}
              onChange={() => fetchAttendanceStats(activeSemester.id)}
            />

            {/* Bento stats: 2 x 2 on phones, one row of 4 on desktop */}
            <motion.div
              className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4"
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.06 } } }}
            >
              {attendanceStats && (
                <motion.div variants={statCardVariants} className="frosted rounded-3xl p-4" data-spotlight>
                  <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                    <ClipboardCheck className="h-4 w-4 text-primary" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider">Attendance</h3>
                  </div>
                  <div
                    className={`font-display text-3xl font-bold tracking-tight ${
                      attendanceStats.heldHours === 0
                        ? "text-muted-foreground"
                        : attendanceStats.attendancePercentage >= 80
                          ? "text-success"
                          : "text-destructive"
                    }`}
                  >
                    {attendanceStats.heldHours > 0 ? (
                      <AnimatedNumber value={attendanceStats.attendancePercentage} suffix="%" />
                    ) : (
                      "--"
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {attendanceStats.attendedHours} of {attendanceStats.heldHours}h so far · 80%
                    needed
                  </p>
                </motion.div>
              )}

              {attendanceStats && (
                <motion.div variants={statCardVariants} className="frosted rounded-3xl p-4" data-spotlight>
                  <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                    <Flame className="h-4 w-4 text-warning" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider">Streak</h3>
                  </div>
                  <div className="font-display text-3xl font-bold tracking-tight text-foreground">
                    <AnimatedNumber value={attendanceStats.currentStreakDays} />
                    <span className="ml-1 text-sm font-semibold text-muted-foreground">
                      {attendanceStats.currentStreakDays === 1 ? "day" : "days"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">in a row with no absences</p>
                </motion.div>
              )}

              {cgpaData && (
                <motion.div variants={statCardVariants} className="frosted rounded-3xl p-4" data-spotlight>
                  <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                    <GraduationCap className="h-4 w-4 text-primary" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider">CGPA</h3>
                  </div>
                  <div className="font-display text-3xl font-bold tracking-tight text-foreground">
                    {cgpaData.courses.length > 0 ? (
                      <AnimatedNumber value={cgpaData.cgpa} decimals={2} />
                    ) : (
                      <span className="text-muted-foreground">--</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    out of 4.0 · {cgpaData.courses.length} graded
                  </p>
                </motion.div>
              )}

              <motion.div variants={statCardVariants} className="frosted rounded-3xl p-4" data-spotlight>
                <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                  <BookMarked className="h-4 w-4 text-primary" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider">Courses</h3>
                </div>
                <div className="font-display text-3xl font-bold tracking-tight text-foreground">
                  <AnimatedNumber value={activeSemester.courses.length} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {attendanceStats
                    ? `can still miss ${attendanceStats.leavesAvailable}h this sem`
                    : "this semester"}
                </p>
              </motion.div>
            </motion.div>

            {attendanceStats && (
              <AttendanceChartCard
                courses={courseStats}
                overall={{
                  percentage: attendanceStats.attendancePercentage,
                  heldHours: attendanceStats.heldHours,
                }}
              />
            )}

            <SkipCalculatorCard courses={courseStats} />

            {/* Study Notebook entry point - this is its only home on mobile,
                where the bottom tab bar stays capped at 5 destinations */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1], delay: 0.24 }}
            >
              <Link
                href={`/dashboard/study?semesterId=${activeSemester.id}`}
                className="frosted group flex items-center gap-4 rounded-2xl p-5 transition-all duration-300 ease-out hover:-translate-y-0.5"
              >
                <div className="frosted-inset flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl">
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">Study Notebook</p>
                  <p className="text-sm text-muted-foreground">
                    Upload notes and ask AI about any subject
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}
