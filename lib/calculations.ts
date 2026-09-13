import { prisma } from "./prisma";

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
  // Get all timetable entries for the semester
  const timetableEntries = await prisma.timetableEntry.findMany({
    where: { semesterId },
  });

  // Calculate total hours in semester
  let totalHours = 0;
  timetableEntries.forEach((entry) => {
    const start = parseInt(entry.startTime.split(":")[0]);
    const end = parseInt(entry.endTime.split(":")[0]);
    const hours = end - start;
    // Count each day of week (assuming roughly 18 weeks in a semester)
    totalHours += hours * 18;
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
    .filter((r) => r.isPresent)
    .reduce((sum, r) => sum + r.hoursDuration, 0);

  const leavesUsed = attendanceRecords
    .filter((r) => !r.isPresent)
    .reduce((sum, r) => sum + r.hoursDuration, 0);

  const attendancePercentage =
    totalHours > 0 ? (attendedHours / totalHours) * 100 : 0;

  // Calculate required hours for 80% attendance
  const requiredHours = totalHours * 0.8;
  const shortfall = Math.max(0, requiredHours - attendedHours);

  // Assuming average class is 2 hours, calculate leaves available
  const avgClassHours = 2;
  const leavesAvailable = Math.floor(shortfall / avgClassHours);

  return {
    totalHours,
    attendedHours,
    attendancePercentage: Math.round(attendancePercentage * 100) / 100,
    requiredHours,
    leavesAvailable,
    leavesUsed,
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

  // Calculate total leaves allowed (20% of total classes)
  const semester = await prisma.semester.findUnique({
    where: { id: semesterId },
  });

  if (!semester) {
    throw new Error("Semester not found");
  }

  // Count number of classes
  const timetableEntries = await prisma.timetableEntry.findMany({
    where: { semesterId },
  });

  const classesPerWeek = timetableEntries.length;
  const weeksInSemester = 18; // Standard semester weeks
  const totalClasses = classesPerWeek * weeksInSemester;
  const totalLeavesAllowed = Math.floor(totalClasses * 0.2); // 20% leaves

  return {
    totalLeavesAllowed,
    leavesUsed: Math.floor(stats.leavesUsed / 2), // Assuming 2-hour classes
    leavesRemaining: totalLeavesAllowed - Math.floor(stats.leavesUsed / 2),
  };
}
