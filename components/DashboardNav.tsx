"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  CalendarClock,
  BookOpen,
  User,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ChipMenuPortal, type ChipMenuItem } from "@/components/ChipMenuPortal";

// The mobile bottom tab bar stays capped at these 5 - UX research caps a
// touch-friendly tab bar at 3-5 items before touch targets and spatial
// memory both suffer, so a 6th destination (Study) doesn't belong here.
// It gets a desktop-only link below instead, plus an entry point on the
// Overview hub for mobile - never a link buried only inside another page.
const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/timetable", label: "Timetable", icon: CalendarDays },
  { href: "/dashboard/attendance", label: "Attendance", icon: ClipboardCheck },
  { href: "/dashboard/grades", label: "Grades", icon: GraduationCap },
  { href: "/dashboard/calendar", label: "Calendar", icon: CalendarClock },
];

const DESKTOP_ONLY_NAV_ITEMS = [
  { href: "/dashboard/study", label: "Study", icon: BookOpen },
];

export function DashboardNav({ semesterId }: { semesterId?: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const avatarButtonRef = useRef<HTMLButtonElement>(null);

  const withSemester = (href: string) =>
    semesterId ? `${href}?semesterId=${semesterId}` : href;

  const avatarMenuItems: ChipMenuItem[] = [
    { label: "Profile", icon: User, onClick: () => router.push("/dashboard/profile") },
    { label: "Logout", icon: LogOut, onClick: () => router.push("/api/auth/signout"), tone: "destructive" },
  ];

  return (
    <>
      <nav className="glass sticky top-4 z-10 mx-4 mb-8 rounded-2xl px-4 py-3 sm:mx-6 sm:px-6 lg:mx-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <Link href="/dashboard" className="font-display text-lg font-bold text-foreground">
            Timetable Tracker
          </Link>

          {/* Desktop: full nav inline */}
          <div className="hidden flex-wrap items-center gap-2 lg:flex">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={withSemester(href)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-foreground transition-colors",
                    active ? "frosted-inset text-primary" : "hover:bg-black/5"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </Link>
              );
            })}
            {DESKTOP_ONLY_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={withSemester(href)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-foreground transition-colors",
                    active ? "frosted-inset text-primary" : "hover:bg-black/5"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </Link>
              );
            })}
            <Link
              href="/dashboard/profile"
              className={cn(
                "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-foreground transition-colors",
                pathname === "/dashboard/profile" ? "frosted-inset text-primary" : "hover:bg-black/5"
              )}
            >
              <User className="h-4 w-4" />
              <span>Profile</span>
            </Link>
            <Link
              href="/api/auth/signout"
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-destructive hover:bg-black/5"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </Link>
          </div>

          {/* Mobile: primary tabs live in the bottom bar, so only Profile/Logout need a home here */}
          <button
            ref={avatarButtonRef}
            type="button"
            onClick={() => setAvatarMenuOpen((v) => !v)}
            className="frosted-inset flex h-9 w-9 items-center justify-center rounded-full text-foreground lg:hidden"
            aria-label="Account menu"
            aria-haspopup="menu"
            aria-expanded={avatarMenuOpen}
          >
            <User className="h-4 w-4" />
          </button>
          <ChipMenuPortal
            open={avatarMenuOpen}
            anchorRef={avatarButtonRef}
            items={avatarMenuItems}
            onClose={() => setAvatarMenuOpen(false)}
          />
        </div>
      </nav>

      {/* Mobile bottom tab bar - kept on the plain glass look, not the liquid bevel */}
      <nav className="glass fixed inset-x-3 bottom-3 z-10 mx-auto max-w-lg rounded-[1.6rem] px-1 py-1 lg:hidden">
        <div className="flex items-center justify-between">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={withSemester(href)}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[10px] font-medium transition-colors",
                  active ? "frosted-inset text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
