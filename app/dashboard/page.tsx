"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DashboardNav } from "@/components/DashboardNav";
import { PageLoader } from "@/components/PageLoader";
import { NoSemesterState } from "@/components/NoSemesterState";
import { DailyAttendanceCard } from "@/components/DailyAttendanceCard";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import {
  ClipboardCheck,
  GraduationCap,
  BookMarked,
  Plus,
  Pencil,
  X,
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
  const [showEditSemester, setShowEditSemester] = useState(false);
  const [editSemesterForm, setEditSemesterForm] = useState({
    name: "",
    startDate: "",
    endDate: "",
    weeks: 15,
  });
  const [isSavingSemester, setIsSavingSemester] = useState(false);

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
    try {
      const res = await fetch("/api/semesters", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: activeSemester.id, ...editSemesterForm }),
      });
      if (res.ok) {
        setShowEditSemester(false);
        await fetchSemesters();
      }
    } catch (error) {
      console.error("Error updating semester:", error);
    } finally {
      setIsSavingSemester(false);
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
                onClick={() => (showEditSemester ? setShowEditSemester(false) : startEditSemester())}
                aria-label="Edit semester"
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
            <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
              {/* Attendance Card */}
              {attendanceStats && (
                <div className="frosted rounded-2xl p-6">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="frosted-inset flex h-10 w-10 items-center justify-center rounded-xl">
                      <ClipboardCheck className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">
                      Attendance
                    </h3>
                  </div>
                  <div className="text-gradient-brand mb-2 font-display text-4xl font-bold">
                    {attendanceStats.attendancePercentage}%
                  </div>
                  <div className="frosted-inset mb-4 h-2 overflow-hidden rounded-full">
                    <div
                      className="bg-gradient-brand h-full rounded-full"
                      style={{
                        width: `${Math.min(100, attendanceStats.attendancePercentage)}%`,
                      }}
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
                </div>
              )}

              {/* CGPA Card */}
              {cgpaData && (
                <div className="frosted rounded-2xl p-6">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="frosted-inset flex h-10 w-10 items-center justify-center rounded-xl">
                      <GraduationCap className="h-5 w-5 text-success" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">CGPA</h3>
                  </div>
                  <div className="mb-2 font-display text-4xl font-bold text-success">
                    {cgpaData.cgpa}/4.0
                  </div>
                  <p className="text-muted-foreground">
                    {cgpaData.courses.length} courses
                  </p>
                </div>
              )}

              {/* Courses Card */}
              {activeSemester && (
                <div className="frosted rounded-2xl p-6">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="frosted-inset flex h-10 w-10 items-center justify-center rounded-xl">
                      <BookMarked className="h-5 w-5 text-warning" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">Courses</h3>
                  </div>
                  <div className="mb-2 font-display text-4xl font-bold text-warning">
                    {activeSemester.courses.length}
                  </div>
                  <p className="text-muted-foreground">
                    Active courses this semester
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
