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
import { LiquidGlassCard } from "@/components/kokonutui/liquid-glass-card";
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
        {/* Semester Selection */}
        <div className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-foreground">
            Select Semester
          </h2>
          <div className="flex flex-wrap items-center gap-3">
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
              <Button variant="secondary">
                <Plus className="h-4 w-4" />
                New Semester
              </Button>
            </Link>
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
              >
                {showEditSemester ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
              </Button>
            )}
            {activeSemester && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDeleteSemester}
                disabled={isDeletingSemester}
                aria-label="Delete semester"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
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
              <Button type="submit" disabled={isSavingSemester}>
                {isSavingSemester ? "Saving..." : "Save"}
              </Button>
            </form>
          )}
        </div>

        {semesters.length === 0 && <NoSemesterState />}

        {semesters.length > 0 && activeSemester && (
          <>
            <DailyAttendanceCard
              semesterId={activeSemester.id}
              onChange={() => fetchAttendanceStats(activeSemester.id)}
            />

            {/* Statistics Grid */}
            <motion.div
              className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3"
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.08 } } }}
            >
              {/* Attendance Card */}
              {attendanceStats && (
                <motion.div variants={statCardVariants}>
                  <LiquidGlassCard>
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="frosted-inset flex h-10 w-10 items-center justify-center rounded-xl">
                          <ClipboardCheck className="h-5 w-5 text-primary" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground">
                          Attendance
                        </h3>
                      </div>
                      {attendanceStats.currentStreakDays > 0 && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ type: "spring", stiffness: 400, damping: 22, delay: 0.15 }}
                          className="frosted-inset flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-warning"
                          title={`${attendanceStats.currentStreakDays}-day streak of classes with no absences`}
                        >
                          <Flame className="h-3.5 w-3.5" />
                          <AnimatedNumber value={attendanceStats.currentStreakDays} />
                        </motion.div>
                      )}
                    </div>
                    <div className="text-gradient-brand mb-2 font-display text-4xl font-bold">
                      <AnimatedNumber value={attendanceStats.attendancePercentage} suffix="%" />
                    </div>
                    <div className="frosted-inset mb-4 h-2 overflow-hidden rounded-full">
                      <motion.div
                        className="bg-gradient-brand h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, attendanceStats.attendancePercentage)}%` }}
                        transition={{ type: "spring", stiffness: 80, damping: 20 }}
                      />
                    </div>
                    <p className="mb-4 text-muted-foreground">
                      {attendanceStats.attendedHours}/{attendanceStats.totalHours} hours
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Leaves Available: {attendanceStats.leavesAvailable}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Required: 80% ({attendanceStats.requiredHours} hours)
                    </p>
                  </LiquidGlassCard>
                </motion.div>
              )}

              {/* CGPA Card */}
              {cgpaData && (
                <motion.div variants={statCardVariants}>
                  <LiquidGlassCard>
                    <div className="mb-4 flex items-center gap-3">
                      <div className="frosted-inset flex h-10 w-10 items-center justify-center rounded-xl">
                        <GraduationCap className="h-5 w-5 text-success" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground">CGPA</h3>
                    </div>
                    <div className="mb-2 font-display text-4xl font-bold text-success">
                      <AnimatedNumber value={cgpaData.cgpa} decimals={2} suffix="/4.0" />
                    </div>
                    <p className="text-muted-foreground">
                      {cgpaData.courses.length} courses
                    </p>
                  </LiquidGlassCard>
                </motion.div>
              )}

              {/* Courses Card */}
              {activeSemester && (
                <motion.div variants={statCardVariants}>
                  <LiquidGlassCard>
                    <div className="mb-4 flex items-center gap-3">
                      <div className="frosted-inset flex h-10 w-10 items-center justify-center rounded-xl">
                        <BookMarked className="h-5 w-5 text-warning" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground">Courses</h3>
                    </div>
                    <div className="mb-2 font-display text-4xl font-bold text-warning">
                      <AnimatedNumber value={activeSemester.courses.length} />
                    </div>
                    <p className="text-muted-foreground">
                      Active courses this semester
                    </p>
                  </LiquidGlassCard>
                </motion.div>
              )}
            </motion.div>

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
