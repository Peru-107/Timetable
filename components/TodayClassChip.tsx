"use client";

import { useRef, useState, type CSSProperties } from "react";
import { animate, motion, useMotionValue, useTransform, type PanInfo } from "motion/react";
import { Ban, Check, MoreVertical, Pencil, RotateCcw, Trash2, X as XIcon } from "lucide-react";
import { useTapHoldGesture } from "@/lib/hooks/useTapHoldGesture";
import { ChipMenuPortal, type ChipMenuItem } from "@/components/ChipMenuPortal";
import { formatTime12h } from "@/lib/attendanceUtils";

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
    backgroundImage: "linear-gradient(color-mix(in srgb, var(--success) 24%, transparent), color-mix(in srgb, var(--success) 24%, transparent))",
    borderColor: "color-mix(in srgb, var(--success) 55%, transparent)",
  },
  ABSENT: {
    backgroundImage: "linear-gradient(color-mix(in srgb, var(--destructive) 20%, transparent), color-mix(in srgb, var(--destructive) 20%, transparent))",
    borderColor: "color-mix(in srgb, var(--destructive) 50%, transparent)",
  },
  CANCELLED: {
    backgroundImage: "linear-gradient(color-mix(in srgb, var(--muted-foreground) 16%, transparent), color-mix(in srgb, var(--muted-foreground) 16%, transparent))",
    borderColor: "color-mix(in srgb, var(--muted-foreground) 35%, transparent)",
  },
};

// How far the card must travel before letting go commits the mark.
const SWIPE_COMMIT_PX = 72;

function buzz() {
  try {
    navigator.vibrate?.(12);
  } catch {
    // Not supported (iOS) - the visual reveal is the feedback.
  }
}

/**
 * Interaction model (today's classes only): swipe right marks present,
 * swipe left marks absent; tap also marks present, double-tap clears
 * whatever mark is set, hold or the kebab button opens a menu with every
 * other action - the kebab exists so the same actions are reachable by
 * keyboard/screen reader and don't depend on gesture timing at all.
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
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const presentReveal = useTransform(x, [0, SWIPE_COMMIT_PX], [0, 1]);
  const absentReveal = useTransform(x, [-SWIPE_COMMIT_PX, 0], [1, 0]);
  const iconScale = useTransform(x, [-SWIPE_COMMIT_PX, 0, SWIPE_COMMIT_PX], [1.15, 0.6, 1.15]);
  const crossedRef = useRef(false);

  const handleDrag = (_: unknown, info: PanInfo) => {
    const crossed = Math.abs(info.offset.x) >= SWIPE_COMMIT_PX;
    if (crossed !== crossedRef.current) {
      crossedRef.current = crossed;
      if (crossed) buzz();
    }
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    crossedRef.current = false;
    if (info.offset.x >= SWIPE_COMMIT_PX) onMarkPresent();
    else if (info.offset.x <= -SWIPE_COMMIT_PX) onMarkAbsent();
    animate(x, 0, { type: "spring", stiffness: 500, damping: 35 });
  };

  const gesture = useTapHoldGesture({
    onTap: onMarkPresent,
    onHold: () => setMenuOpen(true),
    onDoubleTap: () => {
      if (status) onClear();
    },
  });

  const menuItems: ChipMenuItem[] = [
    { label: "Mark Absent", icon: XIcon, onClick: onMarkAbsent, tone: "destructive" },
    { label: "Mark Cancelled", icon: Ban, onClick: onMarkCancelled, tone: "muted" },
    ...(status ? [{ label: "Clear Mark", icon: RotateCcw, onClick: onClear, tone: "muted" as const }] : []),
    ...(onEdit ? [{ label: "Edit Class", icon: Pencil, onClick: onEdit }] : []),
    ...(onDelete
      ? [{ label: "Delete Class", icon: Trash2, onClick: onDelete, tone: "destructive" as const }]
      : []),
  ];

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Revealed underneath as the card slides: present on the left edge
          (swiping right), absent on the right edge (swiping left). */}
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-start rounded-xl pl-4 text-success"
        style={{
          opacity: presentReveal,
          backgroundImage: "linear-gradient(color-mix(in srgb, var(--success) 22%, transparent), color-mix(in srgb, var(--success) 22%, transparent))",
        }}
      >
        <motion.span style={{ scale: iconScale }} className="flex items-center gap-1.5 text-sm font-semibold">
          <Check className="h-5 w-5" /> Present
        </motion.span>
      </motion.div>
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-end rounded-xl pr-4 text-destructive"
        style={{
          opacity: absentReveal,
          backgroundImage: "linear-gradient(color-mix(in srgb, var(--destructive) 20%, transparent), color-mix(in srgb, var(--destructive) 20%, transparent))",
        }}
      >
        <motion.span style={{ scale: iconScale }} className="flex items-center gap-1.5 text-sm font-semibold">
          Absent <XIcon className="h-5 w-5" />
        </motion.span>
      </motion.div>

      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.6}
        dragSnapToOrigin={false}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        style={{ x, touchAction: "pan-y" }}
        whileTap={{ scale: 0.985 }}
        className="relative"
      >
        <button
          type="button"
          {...gesture}
          className={`frosted-inset neu-pressable w-full select-none rounded-xl border p-3 text-left transition-colors duration-300 ${
            status === "CANCELLED" ? "opacity-70" : ""
          }`}
          // Opaque base so the swipe reveal underneath only shows at the edge
          // the card has slid away from, not through the card itself.
          style={{ backgroundColor: "var(--tile-inset)", ...(status ? STATUS_STYLE[status] : {}) }}
          aria-label={`${courseName}, ${formatTime12h(startTime)} to ${formatTime12h(endTime)}${
            status ? `, marked ${status.toLowerCase()}` : ""
          }. Tap to mark present.`}
        >
          <div className="pr-7">
            <p
              className={`text-sm font-semibold text-foreground ${
                status === "CANCELLED" ? "line-through" : ""
              }`}
            >
              {courseName}
            </p>
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            {formatTime12h(startTime)} - {formatTime12h(endTime)}
          </p>
          {(room || instructor) && (
        <p className="truncate text-xs text-muted-foreground">
          {[room, instructor].filter(Boolean).join(" · ")}
        </p>
      )}
        </button>
      </motion.div>

      <button
        ref={menuButtonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen((v) => !v);
        }}
        className="absolute right-1.5 top-1.5 rounded-md p-1 text-muted-foreground hover:bg-black/5 hover:text-foreground"
        aria-label={`More options for ${courseName}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      <ChipMenuPortal
        open={menuOpen}
        anchorRef={menuButtonRef}
        items={menuItems}
        onClose={() => setMenuOpen(false)}
      />
    </div>
  );
}
