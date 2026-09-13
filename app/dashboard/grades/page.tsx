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
import { Plus, X, GraduationCap } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Grade {
  id: string;
  grade: number;
  percentage?: number;
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
  const [courses, setCourses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [newGrade, setNewGrade] = useState({
    courseId: "",
    grade: 3.5,
    percentage: "",
  });

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
          ...newGrade,
          semesterId,
        }),
      });

      if (res.ok) {
        setNewGrade({
          courseId: "",
          grade: 3.5,
          percentage: "",
        });
        setShowForm(false);
        fetchGrades();
      }
    } catch (error) {
      console.error("Error adding grade:", error);
    }
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
          <h1 className="text-3xl font-bold text-foreground">Grades & CGPA</h1>
          {semesterId && (
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
          )}
        </div>

        {hasNoSemesters ? (
          <NoSemesterState />
        ) : (
          <>
            {/* CGPA Card */}
            {cgpaData && (
              <div className="neu-raised mb-8 rounded-2xl p-8">
                <div className="mb-4 flex items-center gap-3">
                  <div className="neu-inset flex h-10 w-10 items-center justify-center rounded-xl">
                    <GraduationCap className="h-5 w-5 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground">
                    Cumulative GPA (CGPA)
                  </h2>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-6xl font-bold text-primary">
                      {cgpaData.cgpa.toFixed(2)}
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
              </div>
            )}

            {/* Form */}
            {showForm && (
              <div className="neu-raised mb-8 rounded-2xl p-6">
                <h2 className="mb-4 text-xl font-semibold text-foreground">
                  Add Grade
                </h2>
                <form onSubmit={handleAddGrade} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        Course
                      </label>
                      <SelectNative
                        value={newGrade.courseId}
                        onChange={(e) =>
                          setNewGrade({ ...newGrade, courseId: e.target.value })
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
                        GPA (0-4.0)
                      </label>
                      <Input
                        type="number"
                        min="0"
                        max="4"
                        step="0.1"
                        value={newGrade.grade}
                        onChange={(e) =>
                          setNewGrade({
                            ...newGrade,
                            grade: parseFloat(e.target.value),
                          })
                        }
                        required
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        Percentage (Optional)
                      </label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={newGrade.percentage}
                        onChange={(e) =>
                          setNewGrade({ ...newGrade, percentage: e.target.value })
                        }
                        placeholder="e.g., 85"
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full">
                    Add Grade
                  </Button>
                </form>
              </div>
            )}

            {/* Chart */}
            {cgpaData && cgpaData.courses.length > 0 && (
              <div className="neu-raised mb-8 rounded-2xl p-6">
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#d6dce6" />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 4]} />
                    <Tooltip />
                    <Bar dataKey="grade" fill="#4f6ef7" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Grades Table */}
            <div className="neu-raised overflow-hidden rounded-2xl">
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
                      <th className="px-6 py-3">Credit Hours</th>
                      <th className="px-6 py-3">GPA</th>
                      <th className="px-6 py-3">Percentage</th>
                      <th className="px-6 py-3">Grade Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cgpaData?.courses.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                          No grades recorded yet
                        </td>
                      </tr>
                    ) : (
                      cgpaData?.courses.map((course) => (
                        <tr key={course.name}>
                          <td className="px-6 py-4 text-sm font-medium text-foreground">
                            {course.name}
                          </td>
                          <td className="px-6 py-4 text-sm text-foreground">
                            {course.creditHours}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <span
                              className={`neu-inset rounded-full px-3 py-1 text-xs font-semibold ${getGradeColor(
                                course.grade
                              )}`}
                            >
                              {course.grade.toFixed(2)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-foreground">
                            {grades.find((g) => g.course.name === course.name)
                              ?.percentage || "-"}
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold text-foreground">
                            {course.gradePoints.toFixed(2)}
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
