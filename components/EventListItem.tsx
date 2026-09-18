"use client";

import { useRef, useState } from "react";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { ChipMenuPortal, type ChipMenuItem } from "@/components/ChipMenuPortal";
import { Checkbox } from "@/components/ui/checkbox";

interface EventListItemProps {
  title: string;
  dateLabel: string;
  description?: string;
  colorClassName: string;
  onEdit: () => void;
  onDelete: () => void;
  /** Only assignment/deadline events are things a student "finishes" - an
   * exam or holiday isn't, so the checkbox is opt-in per event. */
  completed?: boolean;
  onToggleComplete?: () => void;
}

/** A calendar event row in the Upcoming Events list: display plus a single kebab menu for edit/delete. */
export function EventListItem({
  title,
  dateLabel,
  description,
  colorClassName,
  onEdit,
  onDelete,
  completed,
  onToggleComplete,
}: EventListItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const menuItems: ChipMenuItem[] = [
    { label: "Edit Event", icon: Pencil, onClick: onEdit },
    { label: "Delete Event", icon: Trash2, onClick: onDelete, tone: "destructive" },
  ];

  return (
    <div className="frosted-inset relative rounded-xl p-3">
      <button
        ref={menuButtonRef}
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className="absolute right-1.5 top-1.5 rounded-md p-1 text-muted-foreground hover:bg-black/5 hover:text-foreground"
        aria-label={`More options for ${title}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-2.5 pr-6">
        {onToggleComplete && (
          <Checkbox
            checked={completed ?? false}
            onCheckedChange={() => onToggleComplete()}
            aria-label={completed ? `Mark ${title} as not done` : `Mark ${title} as done`}
            className="mt-0.5"
          />
        )}
        <div className="min-w-0 flex-1">
          <p
            className={`text-sm font-semibold ${colorClassName} ${completed ? "line-through opacity-50" : ""}`}
          >
            {title}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{dateLabel}</p>
          {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>

      <ChipMenuPortal
        open={menuOpen}
        anchorRef={menuButtonRef}
        items={menuItems}
        onClose={() => setMenuOpen(false)}
      />
    </div>
  );
}
