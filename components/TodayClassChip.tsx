"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Ban, Check, Pencil, Trash2, X as XIcon } from "lucide-react";
import { useTapHoldGesture } from "@/lib/hooks/useTapHoldGesture";

export type TodayAttendanceStatus = "PRESENT" | "ABSENT" | "CANCELLED" | null;

interface TodayClassChipProps {
  courseName: string;
  startTime: string;
  endTime: string;
  room?: string | null;
  instructor?: string | null;
  status: TodayAttendanceStatus;
  onMarkPresent: () => void;
  onMarkAbsent: () => void;
  onMarkCancelled: () => void;
  onClear: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

const STATUS_STYLE: Record<"PRESENT" | "ABSENT" | "CANCELLED", CSSProperties> = {
  PRESENT: {
    background: "color-mix(in srgb, var(--success) 24%, transparent)",
    borderColor: "color-mix(in srgb, var(--success) 55%, transparent)",
  },
  ABSENT: {
    background: "color-mix(in srgb, var(--destructive) 20%, transparent)",
    borderColor: "color-mix(in srgb, var(--destructive) 50%, transparent)",
  },
  CANCELLED: {
    background: "color-mix(in srgb, var(--muted-foreground) 16%, transparent)",
    borderColor: "color-mix(in srgb, var(--muted-foreground) 35%, transparent)",
  },
};

/**
 * Interaction model (today's classes only): tap marks present, hold opens a
 * menu to mark absent/cancelled, double-tap clears whatever mark is set.
 */
export function TodayClassChip({
  courseName,
  startTime,
  endTime,
  room,
  instructor,
  status,
  onMarkPresent,
  onMarkAbsent,
  onMarkCancelled,
  onClear,
  onEdit,
  onDelete,
}: TodayClassChipProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const gesture = useTapHoldGesture({
    onTap: onMarkPresent,
    onHold: () => setMenuOpen(true),
    onDoubleTap: () => {
      if (status) onClear();
    },
  });

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        {...gesture}
        className={`frosted-inset neu-pressable w-full select-none rounded-xl border p-3 text-left transition-transform ${
          status === "CANCELLED" ? "opacity-70" : ""
        }`}
        style={status ? STATUS_STYLE[status] : undefined}
      >
        <div className={`flex items-center gap-2 ${onEdit || onDelete ? "pr-12" : ""}`}>
          <p
            className={`text-sm font-semibold text-foreground ${
              status === "CANCELLED" ? "line-through" : ""
            }`}
          >
            {courseName}
          </p>
          {status === "PRESENT" && <Check className="h-4 w-4 shrink-0 text-success" />}
          {status === "ABSENT" && <XIcon className="h-4 w-4 shrink-0 text-destructive" />}
          {status === "CANCELLED" && <Ban className="h-4 w-4 shrink-0 text-muted-foreground" />}
        </div>
        <p className="font-mono text-xs text-muted-foreground">
          {startTime} - {endTime}
        </p>
        {room && <p className="text-xs text-muted-foreground">Room: {room}</p>}
        {instructor && <p className="text-xs text-muted-foreground">{instructor}</p>}
      </button>

      {(onEdit || onDelete) && (
        <div className="absolute right-2 top-2 z-10 flex gap-1">
          {onEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Edit class"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="text-muted-foreground hover:text-destructive"
              aria-label="Delete class"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {menuOpen && (
        <div className="frosted absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl p-1">
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onMarkAbsent();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-destructive hover:bg-black/5"
          >
            <XIcon className="h-4 w-4" /> Mark Absent
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onMarkCancelled();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-black/5"
          >
            <Ban className="h-4 w-4" /> Mark Cancelled
          </button>
        </div>
      )}
    </div>
  );
}
