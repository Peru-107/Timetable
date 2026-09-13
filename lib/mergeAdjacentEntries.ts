import { prisma } from "./prisma";
import { planAdjacentMerge } from "./timetableMerge";

/**
 * Collapses back-to-back timetable entries for one course into continuous
 * sessions (see planAdjacentMerge). Safe to call after any operation that
 * could leave a course with adjacent entries - attendance records key off
 * courseId + date, not a specific entry, so merging/deleting entries never
 * touches existing attendance history.
 */
export async function mergeAdjacentEntriesForCourse(courseId: string): Promise<number> {
  const entries = await prisma.timetableEntry.findMany({ where: { courseId } });
  const plan = planAdjacentMerge(entries);

  for (const update of plan.updates) {
    await prisma.timetableEntry.update({
      where: { id: update.id },
      data: {
        endTime: update.endTime,
        room: update.room ?? undefined,
        instructor: update.instructor ?? undefined,
      },
    });
  }

  if (plan.deletes.length > 0) {
    await prisma.timetableEntry.deleteMany({ where: { id: { in: plan.deletes } } });
  }

  return plan.deletes.length;
}

/** Runs the merge across every course in a semester - used by the bulk cleanup endpoint. */
export async function mergeAdjacentEntriesForSemester(semesterId: string): Promise<number> {
  const courses = await prisma.course.findMany({ where: { semesterId }, select: { id: true } });
  let totalMerged = 0;
  for (const course of courses) {
    totalMerged += await mergeAdjacentEntriesForCourse(course.id);
  }
  return totalMerged;
}
