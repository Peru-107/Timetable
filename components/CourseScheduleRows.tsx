"use client";

import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/ui/select-native";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface ScheduleRow {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room?: string;
  instructor?: string;
}

interface CourseScheduleRowsProps {
  rows: ScheduleRow[];
  onChange: (rows: ScheduleRow[]) => void;
}

/**
 * Day+start+end rows for a course's weekly schedule, shared by the Add
 * Course and Edit Course forms. Back-to-back rows for the same day are
 * collapsed into one continuous session server-side on save, so the user
 * doesn't need to manually merge a 3-hour block into a single row here.
 */
export function CourseScheduleRows({ rows, onChange }: CourseScheduleRowsProps) {
  const updateRow = (
    index: number,
    field: "dayOfWeek" | "startTime" | "endTime" | "room",
    value: string | number
  ) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const removeRow = (index: number) => {
    onChange(rows.filter((_, i) => i !== index));
  };

  const addRow = () => {
    // Inherit room/instructor from the last row so a subject scanned with
    // that detail (e.g. from an AI-read timetable) doesn't lose it on every
    // additional day - only the day/time meaningfully differ session to
    // session, and room/instructor stays editable via Edit Class if a
    // specific day genuinely differs.
    const last = rows[rows.length - 1];
    onChange([
      ...rows,
      {
        dayOfWeek: 1,
        startTime: "09:00",
        endTime: "10:00",
        room: last?.room,
        instructor: last?.instructor,
      },
    ]);
  };

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-foreground">
        Weekly Schedule (Optional)
      </label>
      <div className="space-y-3 sm:space-y-2">
        {rows.map((row, index) => (
          // Two-column grid on phones (day + room, then start + end) so a
          // row doesn't collapse into five stacked full-width fields; a
          // single inline row from sm up.
          <div
            key={index}
            className="relative grid grid-cols-2 gap-2 pr-8 sm:flex sm:flex-wrap sm:items-center"
          >
            <SelectNative
              value={row.dayOfWeek}
              onChange={(e) => updateRow(index, "dayOfWeek", parseInt(e.target.value))}
              className="w-full sm:w-36"
              aria-label="Day"
            >
              {DAYS.map((day, dayIdx) => (
                <option key={dayIdx} value={dayIdx}>
                  {day}
                </option>
              ))}
            </SelectNative>
            <Input
              value={row.room || ""}
              onChange={(e) => updateRow(index, "room", e.target.value)}
              placeholder="Classroom"
              aria-label="Classroom"
              className="w-full sm:order-last sm:w-32"
            />
            <Input
              type="time"
              value={row.startTime}
              onChange={(e) => updateRow(index, "startTime", e.target.value)}
              aria-label="Start time"
              className="w-full sm:w-32"
            />
            <span className="hidden text-sm text-muted-foreground sm:inline">to</span>
            <Input
              type="time"
              value={row.endTime}
              onChange={(e) => updateRow(index, "endTime", e.target.value)}
              aria-label="End time"
              className="w-full sm:w-32"
            />
            <button
              type="button"
              onClick={() => removeRow(index)}
              className="absolute right-0 top-3 text-muted-foreground hover:text-destructive sm:top-1/2 sm:-translate-y-1/2"
              aria-label="Remove this day"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addRow}
        className="mt-2 flex items-center gap-1 text-sm font-medium text-primary"
      >
        <Plus className="h-3.5 w-3.5" /> Add another day
      </button>
    </div>
  );
}
