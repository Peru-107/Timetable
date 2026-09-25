"use client";

import { Suspense, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, type Variants } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/ui/select-native";
import { DashboardNav } from "@/components/DashboardNav";
import { PageLoader } from "@/components/PageLoader";
import { NoSemesterState } from "@/components/NoSemesterState";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { useActiveSemester } from "@/lib/hooks/useActiveSemester";
import { Plus, X, GraduationCap, Pencil, Trash2, Check, Calculator, Download } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { computeGradeFromMarks, GRADE_BANDS } from "@/lib/gradeScale";
import { toCsv, downloadCsv } from "@/lib/csv";
import { SHOW_CHARTS } from "@/lib/featureFlags";

const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] } },
};

interface Grade {
  id: string;
  courseId: string;
  grade: number;
  percentage?: number;
  letterGrade?: string;
  icaMarks?: number;
  icaMax: number;
  teeMarks?: number;
  teeMax: number;
  course: {
    name: string;
    creditHours: number;
  };
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

export default function GradesPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <GradesContent />
    </Suspense>
  );
}

function GradesContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { semesterId, isResolvingSemester, hasNoSemesters } = useActiveSemester();

  const [grades, setGrades] = useState<Grade[]>([]);
  const [cgpaData, setCGPAData] = useState<CGPAData | null>(null);
  const [courses, setCourses] = useState<Array<{ id: string; name: string }>>([]);
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [newGrade, setNewGrade] = useState({
    courseId: "",
    icaMarks: "",
    icaMax: "50",
    teeMarks: "",
    teeMax: "50",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editGrade, setEditGrade] = useState({
    icaMarks: "",
    icaMax: "50",
    teeMarks: "",
    teeMax: "50",
  });
  const [whatIfId, setWhatIfId] = useState<string | null>(null);
  const [whatIfTee, setWhatIfTee] = useState("");
  const [whatIfTarget, setWhatIfTarget] = useState(GRADE_BANDS[0].letter);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (semesterId) {
      fetchGrades();
      fetchCourses();
    } else if (!isResolvingSemester) {
      setIsLoading(false);
    }
  }, [semesterId, isResolvingSemester]);

  const fetchGrades = async () => {
    try {
      const res = await fetch(`/api/grades?semesterId=${semesterId}`);
      const data = await res.json();
      setGrades(data.grades);
      setCGPAData(data.cgpaData);
    } catch (error) {
      console.error("Error fetching grades:", error);
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

  const handleAddGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/grades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: newGrade.courseId,
          icaMarks: parseFloat(newGrade.icaMarks) || 0,
          icaMax: parseFloat(newGrade.icaMax) || 50,
          teeMarks: parseFloat(newGrade.teeMarks) || 0,
          teeMax: parseFloat(newGrade.teeMax) || 50,
          semesterId,
        }),
      });

      if (res.ok) {
        setNewGrade({ courseId: "", icaMarks: "", icaMax: "50", teeMarks: "", teeMax: "50" });
        setShowForm(false);
        fetchGrades();
      }
    } catch (error) {
      console.error("Error adding grade:", error);
    }
  };

  const startEditGrade = (grade: Grade) => {
    setEditingId(grade.id);
    setEditGrade({
      icaMarks: grade.icaMarks != null ? String(grade.icaMarks) : "",
      icaMax: String(grade.icaMax),
      teeMarks: grade.teeMarks != null ? String(grade.teeMarks) : "",
      teeMax: String(grade.teeMax),
    });
  };

  const handleSaveEdit = async (id: string) => {
    try {
      const res = await fetch("/api/grades", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          icaMarks: parseFloat(editGrade.icaMarks) || 0,
          icaMax: parseFloat(editGrade.icaMax) || 50,
          teeMarks: parseFloat(editGrade.teeMarks) || 0,
          teeMax: parseFloat(editGrade.teeMax) || 50,
        }),
      });
      if (res.ok) {
        setEditingId(null);
        fetchGrades();
      }
    } catch (error) {
      console.error("Error updating grade:", error);
    }
  };

  const handleDeleteGrade = async (id: string) => {
    if (!confirm("Delete this grade?")) return;
    try {
      const res = await fetch(`/api/grades?id=${id}`, { method: "DELETE" });
      if (res.ok) fetchGrades();
    } catch (error) {
      console.error("Error deleting grade:", error);
    }
  };

  const handleExportCsv = () => {
    const csv = toCsv(
      ["Course", "Credits", "ICA Marks", "ICA Max", "TEE Marks", "TEE Max", "Total %", "Grade", "Grade Points"],
      grades.map((g) => [
        g.course.name,
        g.course.creditHours,
        g.icaMarks ?? "",
        g.icaMax,
        g.teeMarks ?? "",
        g.teeMax,
        g.percentage ?? "",
        g.letterGrade ?? g.grade.toFixed(2),
        (g.grade * g.course.creditHours).toFixed(2),
      ])
    );
    downloadCsv(`grades-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  const toggleWhatIf = (g: Grade) => {
    if (whatIfId === g.id) {
      setWhatIfId(null);
      return;
    }
    setWhatIfId(g.id);
    setWhatIfTee(g.teeMarks != null ? String(g.teeMarks) : "");
    setWhatIfTarget(GRADE_BANDS[0].letter);
  };

  const getGradeColor = (grade: number) => {
    if (grade >= 3.5) return "text-success";
    if (grade >= 3.0) return "text-primary";
    if (grade >= 2.5) return "text-warning";
    return "text-destructive";
  };

  if (status === "loading" || isLoading || isResolvingSemester) {
    return <PageLoader />;
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <DashboardNav semesterId={semesterId} />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-4xl font-bold tracking-tight text-foreground">Grades & CGPA</h1>
          {semesterId && (
            <div className="flex items-center gap-2">
              {grades.length > 0 && (
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
                    <Plus className="h-4 w-4" /> Add Grade
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
            {/* CGPA Card */}
            {cgpaData && (
              <motion.div
                initial="hidden"
                animate="show"
                variants={fadeUpVariants}
                className="frosted mb-8 rounded-2xl p-8"
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className="frosted-inset flex h-10 w-10 items-center justify-center rounded-xl">
                    <GraduationCap className="h-5 w-5 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground">
                    Cumulative GPA (CGPA)
                  </h2>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="font-display text-6xl font-bold tracking-tight text-primary">
                      <AnimatedNumber value={cgpaData.cgpa} decimals={2} />
                    </p>
                    <p className="mt-2 text-lg text-muted-foreground">out of 4.0</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-semibold text-foreground">
                      {cgpaData.courses.length} Courses
                    </p>
                    <p className="text-muted-foreground">
                      Total Credits:{" "}
                      {cgpaData.courses.reduce((sum, c) => sum + c.creditHours, 0)}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Form */}
            <AnimatePresence>
            {showForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="frosted mb-8 overflow-hidden rounded-2xl p-6">
                <h2 className="mb-4 text-xl font-semibold text-foreground">
                  Add Grade
                </h2>
                <form onSubmit={handleAddGrade} className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">
                      Course
                    </label>
                    <SelectNative
                      value={newGrade.courseId}
                      onChange={(e) => setNewGrade({ ...newGrade, courseId: e.target.value })}
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

                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        ICA Marks
                      </label>
                      <Input
                        type="number"
                        min="0"
                        value={newGrade.icaMarks}
                        onChange={(e) => setNewGrade({ ...newGrade, icaMarks: e.target.value })}
                        placeholder="0"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        ICA Max
                      </label>
                      <Input
                        type="number"
                        min="0"
                        value={newGrade.icaMax}
                        onChange={(e) => setNewGrade({ ...newGrade, icaMax: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        TEE Marks
                      </label>
                      <Input
                        type="number"
                        min="0"
                        value={newGrade.teeMarks}
                        onChange={(e) => setNewGrade({ ...newGrade, teeMarks: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        TEE Max
                      </label>
                      <Input
                        type="number"
                        min="0"
                        value={newGrade.teeMax}
                        onChange={(e) => setNewGrade({ ...newGrade, teeMax: e.target.value })}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Max marks default to 50/50 - change them if a course has a different split
                    (e.g. an ICA-only capstone: set TEE Max to 0).
                  </p>

                  <Button type="submit" className="w-full">
                    Add Grade
                  </Button>
                </form>
              </motion.div>
            )}
            </AnimatePresence>

            {/* Chart */}
            {SHOW_CHARTS && cgpaData && cgpaData.courses.length > 0 && (
              <motion.div
                initial="hidden"
                animate="show"
                variants={fadeUpVariants}
                className="frosted mb-8 rounded-2xl p-6"
              >
                <h2 className="mb-4 text-xl font-semibold text-foreground">
                  Course Grades
                </h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={cgpaData.courses.map((c) => ({
                      name: c.name.substring(0, 15),
                      grade: c.grade,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" stroke="var(--muted-foreground)" />
                    <YAxis domain={[0, 4]} stroke="var(--muted-foreground)" />
                    <Tooltip />
                    <Bar dataKey="grade" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>
            )}

            {/* Grades Table */}
            <div className="frosted overflow-hidden rounded-2xl">
              <div className="px-6 py-4">
                <h2 className="text-xl font-semibold text-foreground">
                  Grade Details
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm font-semibold text-muted-foreground">
                      <th className="px-6 py-3">Course</th>
                      <th className="px-6 py-3">Credits</th>
                      <th className="px-6 py-3">ICA</th>
                      <th className="px-6 py-3">TEE</th>
                      <th className="px-6 py-3">Total %</th>
                      <th className="px-6 py-3">Grade</th>
                      <th className="px-6 py-3">Grade Points</th>
                      <th className="px-6 py-3">Actions</th>
                    </tr>
                  </thead>
                  <motion.tbody
                    initial="hidden"
                    animate="show"
                    variants={{ show: { transition: { staggerChildren: 0.05 } } }}
                  >
                    {grades.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">
                          No grades recorded yet
                        </td>
                      </tr>
                    ) : (
                      grades.flatMap((g) => [
                        editingId === g.id ? (
                          <motion.tr variants={rowVariants} key={g.id} className="frosted-inset">
                            <td className="px-6 py-4 text-sm font-medium text-foreground">
                              {g.course.name}
                            </td>
                            <td className="px-6 py-4 text-sm text-foreground">
                              {g.course.creditHours}
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  min="0"
                                  className="h-9 w-16"
                                  value={editGrade.icaMarks}
                                  onChange={(e) =>
                                    setEditGrade({ ...editGrade, icaMarks: e.target.value })
                                  }
                                />
                                <span className="text-muted-foreground">/</span>
                                <Input
                                  type="number"
                                  min="0"
                                  className="h-9 w-14"
                                  value={editGrade.icaMax}
                                  onChange={(e) =>
                                    setEditGrade({ ...editGrade, icaMax: e.target.value })
                                  }
                                />
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  min="0"
                                  className="h-9 w-16"
                                  value={editGrade.teeMarks}
                                  onChange={(e) =>
                                    setEditGrade({ ...editGrade, teeMarks: e.target.value })
                                  }
                                />
                                <span className="text-muted-foreground">/</span>
                                <Input
                                  type="number"
                                  min="0"
                                  className="h-9 w-14"
                                  value={editGrade.teeMax}
                                  onChange={(e) =>
                                    setEditGrade({ ...editGrade, teeMax: e.target.value })
                                  }
                                />
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-muted-foreground" colSpan={2}>
                              Calculated on save
                            </td>
                            <td className="px-6 py-4 text-sm font-semibold text-foreground">
                              {(g.grade * g.course.creditHours).toFixed(2)}
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleSaveEdit(g.id)}
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
                          </motion.tr>
                        ) : (
                          <motion.tr variants={rowVariants} key={g.id}>
                            <td className="px-6 py-4 text-sm font-medium text-foreground">
                              {g.course.name}
                            </td>
                            <td className="px-6 py-4 text-sm text-foreground">
                              {g.course.creditHours}
                            </td>
                            <td className="px-6 py-4 text-sm text-foreground">
                              {g.icaMarks ?? "-"}/{g.icaMax}
                            </td>
                            <td className="px-6 py-4 text-sm text-foreground">
                              {g.teeMarks ?? "-"}/{g.teeMax}
                            </td>
                            <td className="px-6 py-4 text-sm text-foreground">
                              {g.percentage != null ? `${g.percentage}%` : "-"}
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <span
                                className={`frosted-inset rounded-full px-3 py-1 text-xs font-semibold ${getGradeColor(
                                  g.grade
                                )}`}
                              >
                                {g.letterGrade ?? g.grade.toFixed(2)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm font-semibold text-foreground">
                              {(g.grade * g.course.creditHours).toFixed(2)}
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => toggleWhatIf(g)}
                                  className={
                                    whatIfId === g.id
                                      ? "text-primary"
                                      : "text-muted-foreground hover:text-foreground"
                                  }
                                  aria-label="What-if calculator"
                                >
                                  <Calculator className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => startEditGrade(g)}
                                  className="text-muted-foreground hover:text-foreground"
                                  aria-label="Edit grade"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteGrade(g.id)}
                                  className="text-muted-foreground hover:text-destructive"
                                  aria-label="Delete grade"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </motion.tr>
                        ),
                        whatIfId === g.id ? (
                          <WhatIfRow
                            key={`${g.id}-whatif`}
                            grade={g}
                            hypotheticalTee={whatIfTee}
                            onHypotheticalTeeChange={setWhatIfTee}
                            target={whatIfTarget}
                            onTargetChange={setWhatIfTarget}
                            getGradeColor={getGradeColor}
                          />
                        ) : null,
                      ])
                    )}
                  </motion.tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function WhatIfRow({
  grade: g,
  hypotheticalTee,
  onHypotheticalTeeChange,
  target,
  onTargetChange,
  getGradeColor,
}: {
  grade: Grade;
  hypotheticalTee: string;
  onHypotheticalTeeChange: (value: string) => void;
  target: string;
  onTargetChange: (value: string) => void;
  getGradeColor: (grade: number) => string;
}) {
  const hasTee = g.teeMax > 0;
  const ica = g.icaMarks ?? 0;
  const teeInput = Math.min(Math.max(parseFloat(hypotheticalTee) || 0, 0), g.teeMax);
  const projected = computeGradeFromMarks(ica, g.icaMax, teeInput, g.teeMax);

  const targetBand = GRADE_BANDS.find((b) => b.letter === target) ?? GRADE_BANDS[0];
  const totalMax = g.icaMax + g.teeMax;
  const requiredTotal = (targetBand.minPercent / 100) * totalMax;
  const rawRequiredTee = Math.ceil(requiredTotal - ica);
  const requiredTee = Math.max(0, rawRequiredTee);
  const feasible = hasTee && requiredTee <= g.teeMax;
  const alreadyThere = rawRequiredTee <= 0;

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="frosted-inset"
    >
      <td colSpan={8} className="px-6 py-5">
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
          className="grid gap-6 sm:grid-cols-2"
        >
          <div>
            <p className="mb-2 text-sm font-semibold text-foreground">
              If I score this on the TEE...
            </p>
            {hasTee ? (
              <>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max={g.teeMax}
                    className="h-9 w-24"
                    value={hypotheticalTee}
                    onChange={(e) => onHypotheticalTeeChange(e.target.value)}
                    placeholder="0"
                  />
                  <span className="text-sm text-muted-foreground">/ {g.teeMax}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Projected:{" "}
                  <span className={`font-semibold ${getGradeColor(projected.gradePoint)}`}>
                    {projected.letterGrade}
                  </span>{" "}
                  ({projected.percentage}%)
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                This course has no TEE component (ICA-only).
              </p>
            )}
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-foreground">
              TEE needed for a target grade
            </p>
            {hasTee ? (
              <>
                <SelectNative
                  value={target}
                  onChange={(e) => onTargetChange(e.target.value)}
                  className="h-9"
                >
                  {GRADE_BANDS.filter((b) => b.letter !== "F").map((b) => (
                    <option key={b.letter} value={b.letter}>
                      {b.letter}
                    </option>
                  ))}
                </SelectNative>
                <p className="mt-2 text-sm text-muted-foreground">
                  {alreadyThere ? (
                    <>
                      Already locked in with ICA alone -{" "}
                      <span className="font-semibold text-foreground">0</span> / {g.teeMax}{" "}
                      needed on TEE.
                    </>
                  ) : feasible ? (
                    <>
                      Need at least{" "}
                      <span className="font-semibold text-foreground">{requiredTee}</span> /{" "}
                      {g.teeMax} on TEE (ICA locked at {ica}/{g.icaMax}).
                    </>
                  ) : (
                    <span className="text-destructive">
                      Not reachable - even a perfect TEE score tops out below {targetBand.letter}.
                    </span>
                  )}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No TEE to solve for on an ICA-only course.
              </p>
            )}
          </div>
        </motion.div>
      </td>
    </motion.tr>
  );
}
