"use client";

import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/dashboard");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">📚 Timetable Tracker</h1>
          <div className="space-x-4">
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center max-w-4xl mx-auto">
          <h2 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Manage Your Academic Life
            <span className="text-blue-600"> Effortlessly</span>
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Track your timetable, attendance, CGPA, and important deadlines all in one place.
            Stay on top of your academics with our comprehensive tracking system.
          </p>

          <div className="flex justify-center gap-4 mb-12">
            <Link href="/register">
              <Button size="lg" className="text-lg px-8">
                Get Started Free
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg" className="text-lg px-8">
                Login
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mt-20">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-4xl mb-4">📅</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              Timetable Management
            </h3>
            <p className="text-gray-600">
              Upload your timetable via PDF, JPEG, or PNG. Organize classes by day and time.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-4xl mb-4">✓</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              Attendance Tracking
            </h3>
            <p className="text-gray-600">
              Track hourly attendance. Monitor your 80% requirement and see leaves available.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              CGPA Calculator
            </h3>
            <p className="text-gray-600">
              Calculate your GPA on a 4.0 scale. Track grades across multiple semesters.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-4xl mb-4">🗓️</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              Event Calendar
            </h3>
            <p className="text-gray-600">
              Mark exams, assignments, and important deadlines. Never miss a deadline.
            </p>
          </div>
        </div>

        {/* Stats Section */}
        <div className="bg-blue-600 text-white rounded-lg shadow-xl p-12 mt-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold mb-2">100%</div>
              <p>Free to Use</p>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">∞</div>
              <p>Unlimited Semesters</p>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">📱</div>
              <p>Web & Mobile Ready</p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center mt-20 mb-20">
          <h3 className="text-3xl font-bold text-gray-900 mb-4">
            Ready to take control of your academics?
          </h3>
          <p className="text-xl text-gray-600 mb-8">
            Start tracking your timetable, attendance, and grades today.
          </p>
          <Link href="/register">
            <Button size="lg" className="text-lg px-8">
              Create Your Free Account
            </Button>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-800 text-gray-400 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p>© 2024 Timetable Tracker. Made with ❤️ for students.</p>
        </div>
      </footer>
    </div>
  );
}
