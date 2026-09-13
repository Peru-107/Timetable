"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  CalendarClock,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/timetable", label: "Timetable", icon: CalendarDays },
  { href: "/dashboard/attendance", label: "Attendance", icon: ClipboardCheck },
  { href: "/dashboard/grades", label: "Grades", icon: GraduationCap },
  { href: "/dashboard/calendar", label: "Calendar", icon: CalendarClock },
];

export function DashboardNav({ semesterId }: { semesterId?: string | null }) {
  const pathname = usePathname();

  const withSemester = (href: string) =>
    semesterId ? `${href}?semesterId=${semesterId}` : href;

  return (
    <nav className="neu-raised sticky top-4 z-10 mx-4 mb-8 rounded-2xl px-4 py-3 sm:mx-6 sm:px-6 lg:mx-8">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <Link href="/dashboard" className="text-lg font-bold text-foreground">
          Timetable Tracker
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={withSemester(href)}
                className={cn(
                  "neu-pressable flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-foreground transition-colors",
                  active ? "neu-inset text-primary" : "hover:neu-raised-sm"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
          <Link
            href="/api/auth/signout"
            className="neu-pressable flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-destructive hover:neu-raised-sm"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
