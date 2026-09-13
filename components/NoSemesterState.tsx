import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NoSemesterState() {
  return (
    <div className="neu-raised mx-auto mt-8 max-w-md rounded-2xl p-10 text-center">
      <div className="neu-inset mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full">
        <CalendarPlus className="h-7 w-7 text-primary" />
      </div>
      <h2 className="mb-2 text-xl font-semibold text-foreground">
        No semester yet
      </h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Create a semester first to start tracking your timetable, attendance,
        and grades.
      </p>
      <Link href="/dashboard/semesters/new">
        <Button>Create a semester</Button>
      </Link>
    </div>
  );
}
