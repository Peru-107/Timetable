"use client";

import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/PageLoader";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  CalendarClock,
  Infinity as InfinityIcon,
  Smartphone,
  Sparkles,
} from "lucide-react";

const FEATURES = [
  {
    icon: CalendarDays,
    title: "Timetable Management",
    description:
      "Upload your timetable via PDF, JPEG, or PNG. Organize classes by day and time.",
  },
  {
    icon: ClipboardCheck,
    title: "Attendance Tracking",
    description:
      "Track hourly attendance. Monitor your 80% requirement and see leaves available.",
  },
  {
    icon: GraduationCap,
    title: "CGPA Calculator",
    description:
      "Calculate your GPA on a 4.0 scale. Track grades across multiple semesters.",
  },
  {
    icon: CalendarClock,
    title: "Event Calendar",
    description:
      "Mark exams, assignments, and important deadlines. Never miss a deadline.",
  },
];

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/dashboard");
    }
  }, [status, router]);

  if (status === "loading") {
    return <PageLoader />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="mx-4 mt-4 sm:mx-6 lg:mx-8">
        <div className="neu-raised mx-auto flex max-w-7xl items-center justify-between rounded-2xl px-6 py-4">
          <h1 className="text-xl font-bold text-foreground">
            Timetable Tracker
          </h1>
          <div className="flex gap-3">
            {!session ? (
              <>
                <Link href="/login">
                  <Button variant="outline">Login</Button>
                </Link>
                <Link href="/register">
                  <Button>Sign Up</Button>
                </Link>
              </>
            ) : (
              <Link href="/dashboard">
                <Button>Go to Dashboard</Button>
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <div className="neu-raised mx-auto mb-6 flex w-fit items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary">
            <Sparkles className="h-4 w-4" />
            Built for students
          </div>
          <h2 className="mb-6 text-4xl font-bold text-foreground sm:text-5xl md:text-6xl">
            Manage Your Academic Life
            <span className="text-primary"> Effortlessly</span>
          </h2>
          <p className="mb-8 text-lg text-muted-foreground sm:text-xl">
            Track your timetable, attendance, CGPA, and important deadlines
            all in one place. Stay on top of your academics with our
            comprehensive tracking system.
          </p>

          <div className="mb-12 flex flex-col justify-center gap-4 sm:flex-row">
            <Link href="/register">
              <Button size="lg" className="w-full px-8 sm:w-auto">
                Get Started Free
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg" className="w-full px-8 sm:w-auto">
                Login
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Section */}
        <div className="mt-20 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div key={title} className="neu-raised rounded-2xl p-8">
              <div className="neu-inset mb-4 flex h-12 w-12 items-center justify-center rounded-xl">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-foreground">
                {title}
              </h3>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>

        {/* Stats Section */}
        <div className="neu-raised mt-20 rounded-2xl p-10 sm:p-12">
          <div className="grid grid-cols-1 gap-8 text-center sm:grid-cols-3">
            <div>
              <div className="mb-2 text-4xl font-bold text-primary">100%</div>
              <p className="text-muted-foreground">Free to Use</p>
            </div>
            <div>
              <InfinityIcon className="mx-auto mb-2 h-9 w-9 text-primary" />
              <p className="text-muted-foreground">Unlimited Semesters</p>
            </div>
            <div>
              <Smartphone className="mx-auto mb-2 h-9 w-9 text-primary" />
              <p className="text-muted-foreground">Web & Mobile Ready</p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mb-8 mt-20 text-center">
          <h3 className="mb-4 text-2xl font-bold text-foreground sm:text-3xl">
            Ready to take control of your academics?
          </h3>
          <p className="mb-8 text-lg text-muted-foreground sm:text-xl">
            Start tracking your timetable, attendance, and grades today.
          </p>
          <Link href="/register">
            <Button size="lg" className="px-8">
              Create Your Free Account
            </Button>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-muted-foreground sm:px-6 lg:px-8">
          <p>&copy; 2026 Timetable Tracker. Made for students.</p>
        </div>
      </footer>
    </div>
  );
}
