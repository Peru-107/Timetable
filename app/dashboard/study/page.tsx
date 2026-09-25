"use client";

import { Suspense, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, type Variants } from "motion/react";
import { DashboardNav } from "@/components/DashboardNav";
import { PageLoader } from "@/components/PageLoader";
import { NoSemesterState } from "@/components/NoSemesterState";
import { useActiveSemester } from "@/lib/hooks/useActiveSemester";
import { FileText, Sparkles } from "lucide-react";

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
};

interface Course {
  id: string;
  name: string;
}

export default function StudyPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <StudyContent />
    </Suspense>
  );
}

function StudyContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { semesterId, isResolvingSemester, hasNoSemesters } = useActiveSemester();

  const [courses, setCourses] = useState<Course[]>([]);
  const [fileCounts, setFileCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (semesterId) {
      fetchCourses();
    } else if (!isResolvingSemester) {
      setIsLoading(false);
    }
  }, [semesterId, isResolvingSemester]);

  const fetchCourses = async () => {
    try {
      const res = await fetch(`/api/courses?semesterId=${semesterId}`);
      const data: Course[] = await res.json();
      setCourses(data);

      const counts: Record<string, number> = {};
      await Promise.all(
        data.map(async (course) => {
          const materialsRes = await fetch(`/api/study-materials?courseId=${course.id}`);
          const materials = await materialsRes.json();
          counts[course.id] = Array.isArray(materials) ? materials.length : 0;
        })
      );
      setFileCounts(counts);
    } catch (error) {
      console.error("Error fetching courses:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (status === "loading" || isLoading || isResolvingSemester) {
    return <PageLoader />;
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <DashboardNav semesterId={semesterId} />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h1 className="mb-2 font-display text-4xl font-bold tracking-tight text-foreground">Study Notebook</h1>
        <p className="mb-8 text-muted-foreground">
          Upload lecture notes or slides per subject - one folder per course.
        </p>

        {hasNoSemesters ? (
          <NoSemesterState />
        ) : courses.length === 0 ? (
          <div className="frosted rounded-2xl p-8 text-center text-muted-foreground">
            Add a course on the Timetable tab first, then come back here to upload material for it.
          </div>
        ) : (
          <>
            <motion.div initial="hidden" animate="show" variants={cardVariants}>
              <Link
                href={`/dashboard/study/all?semesterId=${semesterId}`}
                className="frosted mb-6 flex items-center gap-4 rounded-2xl p-5 transition-all duration-300 ease-out hover:-translate-y-0.5"
              >
                <div className="frosted-inset flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Ask Across All Subjects</p>
                </div>
              </Link>
            </motion.div>
            <motion.div
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } } }}
            >
            {courses.map((course) => (
              <motion.div key={course.id} variants={cardVariants}>
                <Link
                  href={`/dashboard/study/${course.id}?semesterId=${semesterId}`}
                  className="frosted flex items-center gap-4 rounded-2xl p-5 transition-all duration-300 ease-out hover:-translate-y-0.5"
                >
                  <div className="frosted-inset flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{course.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {fileCounts[course.id] === 1
                        ? "1 file"
                        : `${fileCounts[course.id] ?? 0} files`}
                    </p>
                  </div>
                </Link>
              </motion.div>
            ))}
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}
