"use client";

import { useEffect, useState } from "react";
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
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const semesterId = searchParams.get("semesterId");

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
    }
  }, [semesterId]);

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
    if (grade >= 3.5) return "bg-green-100 text-green-800";
    if (grade >= 3.0) return "bg-blue-100 text-blue-800";
    if (grade >= 2.5) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
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
          <h1 className="text-3xl font-bold text-gray-800">Grades & CGPA</h1>
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "+ Add Grade"}
          </Button>
        </div>

        {/* CGPA Card */}
        {cgpaData && (
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-lg p-8 mb-8 text-white">
            <h2 className="text-2xl font-bold mb-4">Cumulative GPA (CGPA)</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-6xl font-bold">{cgpaData.cgpa.toFixed(2)}</p>
                <p className="text-xl mt-2 opacity-90">out of 4.0</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-semibold">
                  {cgpaData.courses.length} Courses
                </p>
                <p className="opacity-90">
                  Total Credits:{" "}
                  {cgpaData.courses.reduce((sum, c) => sum + c.creditHours, 0)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">
              Add Grade
            </h2>
            <form onSubmit={handleAddGrade} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Course
                  </label>
                  <select
                    value={newGrade.courseId}
                    onChange={(e) =>
                      setNewGrade({ ...newGrade, courseId: e.target.value })
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">
              Course Grades
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={cgpaData.courses.map((c) => ({
                  name: c.name.substring(0, 15),
                  grade: c.grade,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 4]} />
                <Tooltip />
                <Bar dataKey="grade" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Grades Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">
              Grade Details
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Course
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Credit Hours
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    GPA
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Percentage
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    Grade Points
                  </th>
                </tr>
              </thead>
              <tbody>
                {cgpaData?.courses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                      No grades recorded yet
                    </td>
                  </tr>
                ) : (
                  cgpaData?.courses.map((course) => (
                    <tr
                      key={course.name}
                      className="border-b border-gray-200 hover:bg-gray-50"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-gray-800">
                        {course.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800">
                        {course.creditHours}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${getGradeColor(
                            course.grade
                          )}`}
                        >
                          {course.grade.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800">
                        {grades.find(
                          (g) => g.course.name === course.name
                        )?.percentage || "-"}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-800">
                        {course.gradePoints.toFixed(2)}
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
