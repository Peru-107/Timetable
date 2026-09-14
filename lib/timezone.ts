// The app has no per-user timezone setting yet, and this is an
// India-only (NMIMS) deployment, so class-end notifications assume
// IST (UTC+5:30, no DST) rather than the server process's own timezone.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export interface IstDateParts {
  year: number;
  month: number; // 1-12
  day: number;
  dayOfWeek: number; // 0-6, Sunday-Saturday, matching TimetableEntry.dayOfWeek
}

export function getIstDateParts(instant: Date = new Date()): IstDateParts {
  const shifted = new Date(instant.getTime() + IST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    dayOfWeek: shifted.getUTCDay(),
  };
}

/**
 * The instant of IST midnight for the given calendar day - matches what the
 * browser produces via `startOfDay(new Date()).toISOString()` when the
 * user's device is on IST, so it lands in the same AttendanceRecord day
 * bucket as any attendance marked through the normal UI.
 */
export function istMidnightUtc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - IST_OFFSET_MS);
}

/** The instant a class starting/ending at "HH:MM" IST occurs on the given IST calendar day. */
export function istWallClockToUtc(year: number, month: number, day: number, hhmm: string): Date {
  const [hh, mm] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hh, mm, 0) - IST_OFFSET_MS);
}
