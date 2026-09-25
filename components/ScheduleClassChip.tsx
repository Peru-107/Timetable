"use client";

import { useRef, useState } from "react";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { ChipMenuPortal, type ChipMenuItem } from "@/components/ChipMenuPortal";
import { formatTime12h } from "@/lib/attendanceUtils";

interface ScheduleClassChipProps {
  courseName: string;
  startTime: string;
  endTime: string;
  room?: string | null;
  instructor?: string | null;
  onEdit: () => void;
  onDelete: () => void;
}

/** A non-today timetable entry: read-only display plus a single kebab menu for edit/delete. */
export function ScheduleClassChip({
  courseName,
  startTime,
  endTime,
  room,
  instructor,
  onEdit,
  onDelete,
}: ScheduleClassChipProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const menuItems: ChipMenuItem[] = [
    { label: "Edit Class", icon: Pencil, onClick: onEdit },
    { label: "Delete Class", icon: Trash2, onClick: onDelete, tone: "destructive" },
  ];

  return (
    <div className="frosted-inset relative rounded-xl p-3">
      <button
        ref={menuButtonRef}
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className="absolute right-1.5 top-1.5 rounded-md p-1 text-muted-foreground hover:bg-black/5 hover:text-foreground"
        aria-label={`More options for ${courseName}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      <p className="pr-6 text-sm font-semibold text-foreground">{courseName}</p>
      <p className="font-mono text-xs text-muted-foreground">
        {formatTime12h(startTime)} - {formatTime12h(endTime)}
      </p>
      {(room || instructor) && (
        <p className="truncate text-xs text-muted-foreground">
          {[room, instructor].filter(Boolean).join(" · ")}
        </p>
      )}

      <ChipMenuPortal
        open={menuOpen}
        anchorRef={menuButtonRef}
        items={menuItems}
        onClose={() => setMenuOpen(false)}
      />
    </div>
  );
}
