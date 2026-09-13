"use client";

import { useRef, useState } from "react";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { ChipMenuPortal, type ChipMenuItem } from "@/components/ChipMenuPortal";

interface EventListItemProps {
  title: string;
  dateLabel: string;
  description?: string;
  colorClassName: string;
  onEdit: () => void;
  onDelete: () => void;
}

/** A calendar event row in the Upcoming Events list: display plus a single kebab menu for edit/delete. */
export function EventListItem({
  title,
  dateLabel,
  description,
  colorClassName,
  onEdit,
  onDelete,
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

      <p className={`pr-6 text-sm font-semibold ${colorClassName}`}>{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{dateLabel}</p>
      {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}

      <ChipMenuPortal
        open={menuOpen}
        anchorRef={menuButtonRef}
        items={menuItems}
        onClose={() => setMenuOpen(false)}
      />
    </div>
  );
}
