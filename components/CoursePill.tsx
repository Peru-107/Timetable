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
      className={`frosted-inset flex items-center gap-2.5 rounded-full py-1.5 pl-4 pr-1.5 text-sm font-medium text-foreground ${
        active ? "ring-2 ring-primary" : ""
      }`}
    >
      {name}
      <span className="font-mono text-xs text-muted-foreground">{creditHours} cr</span>
      <button
        ref={menuButtonRef}
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-black/5 hover:text-foreground"
        aria-label={`More options for ${name}`}
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
    </span>
  );
}
