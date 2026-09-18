import { prisma } from "./prisma";
import { computeHoursFromTimes } from "./attendanceUtils";

const round2 = (n: number) => Math.round(n * 100) / 100;

interface AttendanceStats {
  totalHours: number;
  attendedHours: number;
  attendancePercentage: number;
  requiredHours: number;
  leavesAvailable: number;
  leavesUsed: number;
}

// Calculate attendance statistics for a semester
export async function calculateAttendanceStats(
  userId: string,
  semesterId: string
): Promise<AttendanceStats> {
  const semester = await prisma.semester.findUnique({ where: { id: semesterId } });
  const weeksInSemester = semester?.weeks ?? 15;

  // Get all timetable entries for the semester
  const timetableEntries = await prisma.timetableEntry.findMany({
    where: { semesterId },
  });

  // Calculate total hours in semester
  let totalHours = 0;
  timetableEntries.forEach((entry) => {
    totalHours += computeHoursFromTimes(entry.startTime, entry.endTime) * weeksInSemester;
  });

  // Get attended hours
  const attendanceRecords = await prisma.attendanceRecord.findMany({
    where: {
      userId,
      course: {
        timetableEntries: {
          some: { semesterId },
        },
      },
    },
  });

  const attendedHours = attendanceRecords
    .filter((r) => r.status === "PRESENT")
    .reduce((sum, r) => sum + r.hoursDuration, 0);

  const leavesUsed = attendanceRecords
    .filter((r) => r.status === "ABSENT")
    .reduce((sum, r) => sum + r.hoursDuration, 0);

  // A cancelled class gets rescheduled, not dropped from the syllabus - it
  // doesn't count as attended or absent for that date, but the semester's
  // total required hours stays exactly what it was.

  const attendancePercentage =
    totalHours > 0 ? (attendedHours / totalHours) * 100 : 0;

  // Calculate required hours for 80% attendance
  const requiredHours = totalHours * 0.8;

  // How many more hours you can still be absent for, semester-wide, and
  // still finish at or above 80% - the total "miss budget" (20% of total
  // hours) minus what's already been used.
  const leavesAvailable = Math.max(0, round2(totalHours * 0.2 - leavesUsed));

  return {
    totalHours: round2(totalHours),
    attendedHours: round2(attendedHours),
    attendancePercentage: round2(attendancePercentage),
    requiredHours: round2(requiredHours),
    leavesAvailable,
    leavesUsed: round2(leavesUsed),
  };
}

export type AttendanceRiskLevel = "safe" | "warning" | "critical";

export interface CourseAttendanceStat {
  courseId: string;
  courseName: string;
  totalHours: number;
  attendedHours: number;
  leavesUsed: number;
  hoursAvailableToMiss: number;
  attendancePercentage: number;
  /**
   * hoursAvailableToMiss converted into whole class sessions, using this
   * course's own average session length (its weekly hours / number of
   * weekly meetings) - a raw hour figure doesn't tell a student whether
   * they can skip tomorrow's lecture, since one course's "class" might be
   * a 1-hour lecture and another's a 3-hour lab.
   */
  classesAvailableToMiss: number;
  /**
   * "critical" once already below 80% (missing more won't help - the fix
   * is attending everything left), "warning" at 2 or fewer skippable
   * classes remaining, "safe" otherwise.
   */
  riskLevel: AttendanceRiskLevel;
}

/**
 * Per-course breakdown of the same 80%-attendance rule: each course has its
 * own weekly hours and therefore its own semester total and miss budget,
 * so lumping them into one number hides how much slack a specific subject
 * actually has.
 */
export async function calculateAttendanceStatsByCourse(
  userId: string,
  semesterId: string
): Promise<CourseAttendanceStat[]> {
  const semester = await prisma.semester.findUnique({ where: { id: semesterId } });
  if (!semester) return [];
  const weeksInSemester = semester.weeks;

  const courses = await prisma.course.findMany({
    where: { semesterId },
    include: { timetableEntries: true },
  });

  const attendanceRecords = await prisma.attendanceRecord.findMany({
    where: { userId, course: { semesterId } },
  });
  const recordsByCourse = new Map<string, typeof attendanceRecords>();
  for (const record of attendanceRecords) {
    const list = recordsByCourse.get(record.courseId) || [];
    list.push(record);
    recordsByCourse.set(record.courseId, list);
  }

  return courses.map((course) => {
    const weeklyHours = course.timetableEntries.reduce(
      (sum, e) => sum + computeHoursFromTimes(e.startTime, e.endTime),
      0
    );
    const totalHours = weeklyHours * weeksInSemester;

    const records = recordsByCourse.get(course.id) || [];
    const attendedHours = records
      .filter((r) => r.status === "PRESENT")
      .reduce((sum, r) => sum + r.hoursDuration, 0);
    const leavesUsed = records
      .filter((r) => r.status === "ABSENT")
      .reduce((sum, r) => sum + r.hoursDuration, 0);
    // A cancelled class gets rescheduled, so it doesn't reduce this
    // course's required total the way an absence would.

    const hoursAvailableToMiss = Math.max(0, round2(totalHours * 0.2 - leavesUsed));
    const attendancePercentage = totalHours > 0 ? round2((attendedHours / totalHours) * 100) : 0;

    const sessionsPerWeek = course.timetableEntries.length;
    const avgSessionHours = sessionsPerWeek > 0 ? weeklyHours / sessionsPerWeek : 0;
    const classesAvailableToMiss =
      avgSessionHours > 0 ? Math.floor(hoursAvailableToMiss / avgSessionHours) : 0;

    // No attendance recorded yet reads as 0% - that's "no data", not a
    // shortfall, so it must not trip the same "critical" as an actual
    // sub-80% track record once classes have happened.
    const hasRecords = attendedHours + leavesUsed > 0;
    const riskLevel: AttendanceRiskLevel =
      hasRecords && attendancePercentage < 80
        ? "critical"
        : classesAvailableToMiss <= 2
          ? "warning"
          : "safe";

    return {
      courseId: course.id,
      courseName: course.name,
      totalHours: round2(totalHours),
      attendedHours: round2(attendedHours),
      leavesUsed: round2(leavesUsed),
      hoursAvailableToMiss,
      attendancePercentage,
      classesAvailableToMiss,
      riskLevel,
    };
  });
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

// Calculate CGPA for a semester or overall
export async function calculateCGPA(
  userId: string,
  semesterId?: string
): Promise<CGPAData> {
  const where: any = { userId };
  if (semesterId) {
    where.semesterId = semesterId;
  }

  const grades = await prisma.grade.findMany({
    where,
    include: {
      course: true,
    },
  });

  let totalGradePoints = 0;
  let totalCreditHours = 0;

  const courseData = grades.map((g) => {
    const gradePoints = g.grade * g.course.creditHours;
    totalGradePoints += gradePoints;
    totalCreditHours += g.course.creditHours;

    return {
      name: g.course.name,
      grade: g.grade,
      creditHours: g.course.creditHours,
      gradePoints: Math.round(gradePoints * 100) / 100,
    };
  });

  const cgpa =
    totalCreditHours > 0
      ? Math.round((totalGradePoints / totalCreditHours) * 100) / 100
      : 0;

  return {
    courses: courseData,
    cgpa,
  };
}

// Get leaves available based on attendance
export async function getLeavesSummary(
  userId: string,
  semesterId: string
): Promise<{
  totalLeavesAllowed: number;
  leavesUsed: number;
  leavesRemaining: number;
}> {
  const stats = await calculateAttendanceStats(userId, semesterId);

  return {
    totalLeavesAllowed: round2(stats.totalHours * 0.2),
    leavesUsed: stats.leavesUsed,
    leavesRemaining: stats.leavesAvailable,
  };
}
