import { prisma } from "./prisma";
import { computeHoursFromTimes } from "./attendanceUtils";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Default minimum attendance, as a fraction; each semester can override it. */
export const MIN_ATTENDANCE = 0.8;

/** A semester's own minimum (stored as a percent), as a fraction. */
const minFraction = (semester: { minAttendance?: number | null } | null | undefined) =>
  semester?.minAttendance ? semester.minAttendance / 100 : MIN_ATTENDANCE;

/**
 * Attendance so far: of the class hours that have actually been held and
 * marked (present or absent - cancelled classes never happened), the share
 * attended. Dividing by the whole semester's hours instead would read as
 * "below 80%" for everyone until the last week of term.
 */
function currentPercentage(attendedHours: number, absentHours: number): number {
  const held = attendedHours + absentHours;
  return held > 0 ? round2((attendedHours / held) * 100) : 0;
}

/**
 * How many more sessions of `sessionHours` must be attended in a row to get
 * back to MIN_ATTENDANCE: solves (P + n*s) / (H + n*s) >= 0.8 for n.
 */
function sessionsToRecover(
  attendedHours: number,
  heldHours: number,
  sessionHours: number,
  min: number
): number {
  const deficit = min * heldHours - attendedHours;
  if (deficit <= 0 || sessionHours <= 0) return 0;
  return Math.ceil(deficit / ((1 - min) * sessionHours) - 1e-9);
}
const dateKeyUTC = (d: Date) => d.toISOString().slice(0, 10);

interface AttendanceStats {
  totalHours: number;
  attendedHours: number;
  /** Present + absent hours marked so far (cancelled excluded). */
  heldHours: number;
  /** attendedHours / heldHours, as a percentage. */
  attendancePercentage: number;
  /** The semester's minimum, in percent (e.g. 80). */
  minAttendance: number;
  requiredHours: number;
  leavesAvailable: number;
  leavesUsed: number;
  currentStreakDays: number;
}

/**
 * Consecutive days, walking back from today, where every scheduled class
 * that day had no absence marked - skipping days with no class scheduled
 * at all (a day off doesn't break a streak) and not counting today against
 * it until something is actually marked (the day isn't over yet, so an
 * empty "today" shouldn't look like a broken streak). A record's mere
 * presence (including CANCELLED) counts as a win for that day - a
 * cancelled class isn't the student's fault.
 */
function computeCurrentStreak(
  timetableEntries: Array<{ dayOfWeek: number }>,
  attendanceRecords: Array<{ date: Date; status: string }>,
  semesterStart: Date
): number {
  const scheduledDays = new Set(timetableEntries.map((e) => e.dayOfWeek));
  if (scheduledDays.size === 0) return 0;

  const recordsByDate = new Map<string, string[]>();
  for (const r of attendanceRecords) {
    const key = dateKeyUTC(r.date);
    const list = recordsByDate.get(key) || [];
    list.push(r.status);
    recordsByDate.set(key, list);
  }

  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startUTC = new Date(
    Date.UTC(semesterStart.getUTCFullYear(), semesterStart.getUTCMonth(), semesterStart.getUTCDate())
  );

  let streak = 0;
  const cursor = new Date(todayUTC);
  let isToday = true;

  while (cursor >= startUTC) {
    const dow = cursor.getUTCDay();
    if (!scheduledDays.has(dow)) {
      cursor.setUTCDate(cursor.getUTCDate() - 1);
      isToday = false;
      continue;
    }

    const statuses = recordsByDate.get(dateKeyUTC(cursor));
    if (!statuses || statuses.length === 0) {
      if (isToday) {
        cursor.setUTCDate(cursor.getUTCDate() - 1);
        isToday = false;
        continue;
      }
      break;
    }

    if (statuses.some((s) => s === "ABSENT")) break;

    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    isToday = false;
  }

  return streak;
}

// Calculate attendance statistics for a semester
export async function calculateAttendanceStats(
  userId: string,
  semesterId: string
): Promise<AttendanceStats> {
  const semester = await prisma.semester.findUnique({ where: { id: semesterId } });
  const weeksInSemester = semester?.weeks ?? 15;

  // The semester total is fixed: weekly hours x teaching weeks (3h a week
  // for 10 weeks = 30h). A cancelled lecture is postponed, not dropped, so
  // the total never shrinks - and a one-time extra class (onDate set) is
  // that postponed lecture being held, so it never adds to the total either.
  const allEntries = await prisma.timetableEntry.findMany({
    where: { semesterId },
  });
  const timetableEntries = allEntries.filter((e) => !e.onDate);

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

  const attendancePercentage = currentPercentage(attendedHours, leavesUsed);

  const min = minFraction(semester);
  const requiredHours = totalHours * min;

  // How many more hours you can still be absent for, semester-wide, and
  // still finish at or above 80% - the total "miss budget" (20% of total
  // hours) minus what's already been used.
  const leavesAvailable = Math.max(0, round2(totalHours * (1 - min) - leavesUsed));

  const currentStreakDays = semester
    ? computeCurrentStreak(timetableEntries, attendanceRecords, semester.startDate)
    : 0;

  return {
    totalHours: round2(totalHours),
    attendedHours: round2(attendedHours),
    heldHours: round2(attendedHours + leavesUsed),
    attendancePercentage,
    minAttendance: Math.round(min * 100),
    requiredHours: round2(requiredHours),
    leavesAvailable,
    leavesUsed: round2(leavesUsed),
    currentStreakDays,
  };
}

export type AttendanceRiskLevel = "safe" | "warning" | "critical";

export interface CourseAttendanceStat {
  courseId: string;
  courseName: string;
  totalHours: number;
  attendedHours: number;
  leavesUsed: number;
  /** Present + absent hours marked so far (cancelled excluded). */
  heldHours: number;
  hoursAvailableToMiss: number;
  /** attendedHours / heldHours, as a percentage. */
  attendancePercentage: number;
  /** The semester's minimum, in percent (e.g. 80). */
  minAttendance: number;
  /**
   * hoursAvailableToMiss converted into whole class sessions, using this
   * course's own average session length (its weekly hours / number of
   * weekly meetings) - a raw hour figure doesn't tell a student whether
   * they can skip tomorrow's lecture, since one course's "class" might be
   * a 1-hour lecture and another's a 3-hour lab.
   */
  classesAvailableToMiss: number;
  /** Average length of one of this course's weekly classes, in hours. */
  sessionHours: number;
  /** Classes to attend in a row to get back to 80%; 0 when already there. */
  classesToRecover: number;
  /**
   * False once absences exceed the whole semester's 20% miss budget - no
   * amount of attending will bring the semester total back to 80%.
   */
  canReachTarget: boolean;
  /**
   * "critical" when below 80% so far or the semester's miss budget is
   * blown, "warning" at 2 or fewer skippable classes remaining, "safe"
   * otherwise.
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
  const min = minFraction(semester);

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
    const weekly = course.timetableEntries.filter((e) => !e.onDate);
    const weeklyHours = weekly.reduce(
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

    const missBudget = totalHours * (1 - min);
    const hoursAvailableToMiss = Math.max(0, round2(missBudget - leavesUsed));
    const attendancePercentage = currentPercentage(attendedHours, leavesUsed);
    const heldHours = attendedHours + leavesUsed;
    const canReachTarget = leavesUsed <= missBudget + 1e-9;

    const sessionsPerWeek = weekly.length;
    const avgSessionHours = sessionsPerWeek > 0 ? weeklyHours / sessionsPerWeek : 0;
    const classesAvailableToMiss =
      avgSessionHours > 0 ? Math.floor(hoursAvailableToMiss / avgSessionHours + 1e-9) : 0;
    const classesToRecover = sessionsToRecover(attendedHours, heldHours, avgSessionHours, min);

    // No attendance recorded yet reads as 0% - that's "no data", not a
    // shortfall, so it must not trip the same "critical" as an actual
    // sub-80% track record once classes have happened.
    const hasRecords = heldHours > 0;
    const riskLevel: AttendanceRiskLevel =
      !canReachTarget || (hasRecords && attendancePercentage < min * 100)
        ? "critical"
        : // Amber once at most one class or a third of the allowance is left -
          // never before anything has been missed.
          leavesUsed > 0 && (classesAvailableToMiss <= 1 || hoursAvailableToMiss <= missBudget / 3)
          ? "warning"
          : "safe";

    return {
      courseId: course.id,
      courseName: course.name,
      totalHours: round2(totalHours),
      attendedHours: round2(attendedHours),
      leavesUsed: round2(leavesUsed),
      heldHours: round2(heldHours),
      hoursAvailableToMiss,
      attendancePercentage,
      minAttendance: Math.round(min * 100),
      classesAvailableToMiss,
      classesToRecover,
      sessionHours: round2(avgSessionHours),
      canReachTarget,
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
    totalLeavesAllowed: round2(stats.totalHours * (1 - stats.minAttendance / 100)),
    leavesUsed: stats.leavesUsed,
    leavesRemaining: stats.leavesAvailable,
  };
}
