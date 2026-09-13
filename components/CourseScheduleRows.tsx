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
    field: "dayOfWeek" | "startTime" | "endTime",
    value: string | number
  ) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const removeRow = (index: number) => {
    onChange(rows.filter((_, i) => i !== index));
  };

  const addRow = () => {
    onChange([...rows, { dayOfWeek: 1, startTime: "09:00", endTime: "10:00" }]);
  };

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-foreground">
        Weekly Schedule (Optional)
      </label>
      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <SelectNative
              value={row.dayOfWeek}
              onChange={(e) => updateRow(index, "dayOfWeek", parseInt(e.target.value))}
              className="w-36"
            >
              {DAYS.map((day, dayIdx) => (
                <option key={dayIdx} value={dayIdx}>
                  {day}
                </option>
              ))}
            </SelectNative>
            <Input
              type="time"
              value={row.startTime}
              onChange={(e) => updateRow(index, "startTime", e.target.value)}
              className="w-32"
            />
            <span className="text-sm text-muted-foreground">to</span>
            <Input
              type="time"
              value={row.endTime}
              onChange={(e) => updateRow(index, "endTime", e.target.value)}
              className="w-32"
            />
            <button
              type="button"
              onClick={() => removeRow(index)}
              className="text-muted-foreground hover:text-destructive"
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
