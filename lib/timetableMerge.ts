export interface ParsedEntry {
  subjectCode: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room?: string;
  instructor?: string;
}

export interface ExistingEntryLite {
  courseId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface EntryToCreate {
  courseId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room?: string;
  instructor?: string;
}

export interface SkippedConflict {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  attemptedCourseId: string;
  conflictingCourseId: string;
}

export interface EntryMergePlan {
  toCreate: EntryToCreate[];
  skippedDuplicates: number;
  skippedConflicts: SkippedConflict[];
}

/**
 * Decides which extracted entries to actually create against what's already
 * on the timetable. A re-scan (e.g. to add one missed course) can misread a
 * slot that's already correctly filled by a different course - without a
 * conflict check that reads as "add this other course here too", silently
 * double-booking the same day/time instead of being caught. An exact repeat
 * of an existing entry for the SAME course is a harmless duplicate scan and
 * is skipped quietly; a different course claiming an already-occupied
 * day/time slot is treated as a probable misread and skipped as a conflict
 * so it can be surfaced to the user instead of corrupting the schedule.
 */
export function planEntryMerge(
  entries: ParsedEntry[],
  codeToCourseId: Map<string, string>,
  existingEntries: ExistingEntryLite[]
): EntryMergePlan {
  const toCreate: EntryToCreate[] = [];
  const skippedConflicts: SkippedConflict[] = [];
  let skippedDuplicates = 0;

  // Entries created earlier in this same scan must also be checked against,
  // since they aren't in `existingEntries` (fetched before this loop ran).
  const seen: ExistingEntryLite[] = [...existingEntries];

  for (const entry of entries) {
    const courseId = codeToCourseId.get(entry.subjectCode.trim().toLowerCase());
    if (!courseId) continue;

    const sameSlot = seen.filter(
      (e) => e.dayOfWeek === entry.dayOfWeek && e.startTime === entry.startTime && e.endTime === entry.endTime
    );

    const exactDuplicate = sameSlot.find((e) => e.courseId === courseId);
    if (exactDuplicate) {
      skippedDuplicates++;
      continue;
    }

    const conflict = sameSlot.find((e) => e.courseId !== courseId);
    if (conflict) {
      skippedConflicts.push({
        dayOfWeek: entry.dayOfWeek,
        startTime: entry.startTime,
        endTime: entry.endTime,
        attemptedCourseId: courseId,
        conflictingCourseId: conflict.courseId,
      });
      continue;
    }

    const created: EntryToCreate = {
      courseId,
      dayOfWeek: entry.dayOfWeek,
      startTime: entry.startTime,
      endTime: entry.endTime,
      room: entry.room,
      instructor: entry.instructor,
    };
    toCreate.push(created);
    seen.push({ courseId, dayOfWeek: entry.dayOfWeek, startTime: entry.startTime, endTime: entry.endTime });
  }

  return { toCreate, skippedDuplicates, skippedConflicts };
}

export interface MergeableEntry {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room?: string | null;
  instructor?: string | null;
}

export interface AdjacentMergePlan {
  // Extend the first entry in each back-to-back chain to cover the whole
  // span, then delete the rest of the chain.
  updates: Array<{ id: string; endTime: string; room?: string | null; instructor?: string | null }>;
  deletes: string[];
}

/**
 * A subject scheduled for 3 continuous hours should be one session, not
 * three separate hour-long entries (which is how an hourly-grid timetable
 * photo often reads) - each fragment would need its own attendance tap and
 * would double as a separate "hour" in every total. Two entries for the
 * same subject on the same day are merged only when they touch exactly
 * (one's end is the next's start); entries elsewhere on the same day, or
 * with any gap between them, are left as their own separate sessions.
 */
export function planAdjacentMerge(entries: MergeableEntry[]): AdjacentMergePlan {
  const byDay = new Map<number, MergeableEntry[]>();
  for (const entry of entries) {
    const list = byDay.get(entry.dayOfWeek) || [];
    list.push(entry);
    byDay.set(entry.dayOfWeek, list);
  }

  const updatesById = new Map<string, AdjacentMergePlan["updates"][number]>();
  const deletes: string[] = [];

  for (const dayEntries of byDay.values()) {
    if (dayEntries.length < 2) continue;
    const sorted = [...dayEntries].sort((a, b) => a.startTime.localeCompare(b.startTime));

    let current = { ...sorted[0] };
    let merged = false;
    for (let i = 1; i < sorted.length; i++) {
      if (current.endTime === sorted[i].startTime) {
        current = {
          ...current,
          endTime: sorted[i].endTime,
          room: current.room || sorted[i].room,
          instructor: current.instructor || sorted[i].instructor,
        };
        deletes.push(sorted[i].id);
        merged = true;
      } else {
        if (merged) {
          updatesById.set(current.id, {
            id: current.id,
            endTime: current.endTime,
            room: current.room,
            instructor: current.instructor,
          });
        }
        current = { ...sorted[i] };
        merged = false;
      }
    }
    if (merged) {
      updatesById.set(current.id, {
        id: current.id,
        endTime: current.endTime,
        room: current.room,
        instructor: current.instructor,
      });
    }
  }

  return { updates: Array.from(updatesById.values()), deletes };
}
