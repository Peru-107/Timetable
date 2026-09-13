"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { ArrowLeft, CalendarRange, AlertCircle } from "lucide-react";

export default function NewSemesterPage() {
  const router = useRouter();
  const { status } = useSession();
  const [formData, setFormData] = useState({
    name: "",
    startDate: "",
    endDate: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/semesters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create semester");
        return;
      }

      const semester = await res.json();
      router.push(`/dashboard?semesterId=${semester.id}`);
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-12">
      <nav className="mx-4 mb-8 mt-4 sm:mx-6 lg:mx-8">
        <div className="neu-raised mx-auto flex max-w-7xl items-center rounded-2xl px-6 py-4">
          <Link href="/dashboard">
            <Button variant="ghost">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <div className="neu-raised rounded-2xl p-8">
          <div className="neu-inset mb-6 flex h-14 w-14 items-center justify-center rounded-2xl">
            <CalendarRange className="h-7 w-7 text-primary" />
          </div>
          <h1 className="mb-8 text-3xl font-bold text-foreground">
            Create New Semester
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                Semester Name
              </label>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Fall 2024, Spring 2025"
                required
              />
              <p className="mt-1 text-sm text-muted-foreground">
                Use a descriptive name like &quot;Fall 2024&quot; or &quot;Semester 5&quot;
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Start Date
                </label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) =>
                    setFormData({ ...formData, startDate: e.target.value })
                  }
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  End Date
                </label>
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) =>
                    setFormData({ ...formData, endDate: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            {error && (
              <div className="neu-inset flex items-center gap-2 rounded-xl px-4 py-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <Button type="submit" disabled={isLoading} size="lg" className="w-full">
              {isLoading ? "Creating..." : "Create Semester"}
            </Button>
          </form>

          <div className="neu-inset mt-8 rounded-2xl p-4">
            <p className="mb-2 text-sm font-semibold text-foreground">Next Steps</p>
            <p className="text-sm text-muted-foreground">
              After creating a semester, you&apos;ll be able to:
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>Add courses to the semester</li>
              <li>Create your timetable</li>
              <li>Track attendance and grades</li>
              <li>Set important deadlines and exams</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
