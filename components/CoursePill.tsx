"use client";

import { useRef, useState } from "react";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { ChipMenuPortal, type ChipMenuItem } from "@/components/ChipMenuPortal";

interface CoursePillProps {
  name: string;
  creditHours: number;
  active?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

/** A course chip in the Courses panel: name + credits plus a single kebab menu for edit/delete. */
export function CoursePill({ name, creditHours, active, onEdit, onDelete }: CoursePillProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const menuItems: ChipMenuItem[] = [
    { label: "Edit Course", icon: Pencil, onClick: onEdit },
    { label: "Delete Course", icon: Trash2, onClick: onDelete, tone: "destructive" },
  ];

  return (
    <span
      className={`frosted-inset flex items-center gap-2 rounded-full py-1 pl-3 pr-1.5 text-sm font-medium text-foreground ${
        active ? "ring-2 ring-primary" : ""
      }`}
    >
      {name}
      <span className="font-mono text-xs text-muted-foreground">{creditHours} cr</span>
      <button
        ref={menuButtonRef}
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className="rounded-md p-1 text-muted-foreground hover:bg-black/5 hover:text-foreground"
        aria-label={`More options for ${name}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </button>

      <ChipMenuPortal
        open={menuOpen}
        anchorRef={menuButtonRef}
        items={menuItems}
        onClose={() => setMenuOpen(false)}
      />
    </span>
  );
}
