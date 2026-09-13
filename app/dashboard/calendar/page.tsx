"use client";

import { Suspense, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/ui/select-native";
import { DashboardNav } from "@/components/DashboardNav";
import { PageLoader } from "@/components/PageLoader";
import { NoSemesterState } from "@/components/NoSemesterState";
import { EventListItem } from "@/components/EventListItem";
import { useActiveSemester } from "@/lib/hooks/useActiveSemester";
import { Plus, X, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
} from "date-fns";

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  eventType: string;
  dueDate: string;
}

interface AttendanceRecord {
  id: string;
  date: string;
  status: "PRESENT" | "ABSENT" | "CANCELLED";
  course: { name: string };
}

const ATTENDANCE_DOT_COLOR: Record<AttendanceRecord["status"], string> = {
  PRESENT: "bg-success",
  ABSENT: "bg-destructive",
  CANCELLED: "bg-muted-foreground",
};

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const EVENT_COLORS: Record<string, string> = {
  exam: "text-destructive",
  assignment: "text-primary",
  deadline: "text-warning",
  holiday: "text-success",
  default: "text-muted-foreground",
};

const EMPTY_EVENT = {
  title: "",
  description: "",
  eventType: "exam",
  dueDate: new Date().toISOString().split("T")[0],
};

export default function CalendarPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <CalendarContent />
    </Suspense>
  );
}

function CalendarContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { semesterId, isResolvingSemester, hasNoSemesters } = useActiveSemester();

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [newEvent, setNewEvent] = useState(EMPTY_EVENT);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (semesterId) {
      fetchEvents();
      fetchAttendance();
    } else if (!isResolvingSemester) {
      setIsLoading(false);
    }
  }, [semesterId, isResolvingSemester]);

  const fetchEvents = async () => {
    try {
      const res = await fetch(`/api/calendar?semesterId=${semesterId}`);
      const data = await res.json();
      setEvents(data);
    } catch (error) {
      console.error("Error fetching events:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAttendance = async () => {
    try {
      const res = await fetch(`/api/attendance?semesterId=${semesterId}`);
      const data = await res.json();
      setAttendance(data.records || []);
    } catch (error) {
      console.error("Error fetching attendance:", error);
    }
  };

  const resetForm = () => {
    setNewEvent(EMPTY_EVENT);
    setEditingEventId(null);
    setShowForm(false);
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/calendar", {
        method: editingEventId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingEventId ? { ...newEvent, id: editingEventId } : { ...newEvent, semesterId }
        ),
      });

      if (res.ok) {
        resetForm();
        fetchEvents();
      }
    } catch (error) {
      console.error("Error saving event:", error);
    }
  };

  const startEditEvent = (event: CalendarEvent) => {
    setNewEvent({
      title: event.title,
      description: event.description || "",
      eventType: event.eventType,
      dueDate: format(new Date(event.dueDate), "yyyy-MM-dd"),
    });
    setEditingEventId(event.id);
    setShowForm(true);
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm("Delete this event?")) return;
    try {
      const res = await fetch(`/api/calendar?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        if (editingEventId === id) resetForm();
        fetchEvents();
      }
    } catch (error) {
      console.error("Error deleting event:", error);
    }
  };

  const getDaysInMonth = () => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  };

  const getEventsForDate = (date: Date) => {
    return events.filter((event) => isSameDay(new Date(event.dueDate), date));
  };

  const getAttendanceForDate = (date: Date) => {
    return attendance.filter((record) => isSameDay(new Date(record.date), date));
  };

  const getEventColor = (type: string) => EVENT_COLORS[type] || EVENT_COLORS.default;

  if (status === "loading" || isLoading || isResolvingSemester) {
    return <PageLoader />;
  }

  const daysInMonth = getDaysInMonth();
  const firstDayOfMonth = daysInMonth[0].getDay();

  return (
    <div className="min-h-screen bg-background pb-12">
      <DashboardNav semesterId={semesterId} />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-bold text-foreground">Calendar</h1>
          {semesterId && (
            <Button onClick={() => (showForm ? resetForm() : setShowForm(true))}>
              {showForm ? (
                <>
                  <X className="h-4 w-4" /> Cancel
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" /> Add Event
                </>
              )}
            </Button>
          )}
        </div>

        {hasNoSemesters ? (
          <NoSemesterState />
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Calendar */}
            <div className="lg:col-span-2">
              <div className="frosted rounded-2xl p-6">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-2xl font-semibold text-foreground">
                    {format(currentDate, "MMMM yyyy")}
                  </h2>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        setCurrentDate(
                          new Date(currentDate.getFullYear(), currentDate.getMonth() - 1)
                        )
                      }
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        setCurrentDate(
                          new Date(currentDate.getFullYear(), currentDate.getMonth() + 1)
                        )
                      }
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Days of week */}
                <div className="mb-2 grid grid-cols-7 gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <div
                      key={day}
                      className="py-2 text-center text-sm font-semibold text-muted-foreground"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square" />
                  ))}

                  {daysInMonth.map((day, index) => {
                    const dayEvents = getEventsForDate(day);
                    const dayAttendance = getAttendanceForDate(day);
                    const attendanceStatuses = Array.from(
                      new Set(dayAttendance.map((r) => r.status))
                    );
                    const isCurrentMonth = isSameMonth(day, currentDate);

                    return (
                      <div
                        key={index}
                        className={`neu-pressable aspect-square cursor-pointer rounded-xl p-2 ${
                          isCurrentMonth ? "frosted-inset" : "opacity-40"
                        }`}
                        onClick={() => {
                          setEditingEventId(null);
                          setNewEvent({
                            ...EMPTY_EVENT,
                            dueDate: format(day, "yyyy-MM-dd"),
                          });
                          setShowForm(true);
                        }}
                      >
                        <div className="mb-1 flex items-center justify-between gap-1">
                          <span className="text-sm font-semibold text-foreground">
                            {day.getDate()}
                          </span>
                          {attendanceStatuses.length > 0 && (
                            <span
                              className="flex items-center gap-0.5"
                              title={dayAttendance
                                .map((r) => `${r.course.name}: ${r.status.toLowerCase()}`)
                                .join(", ")}
                            >
                              {attendanceStatuses.map((s) => (
                                <span
                                  key={s}
                                  className={`h-1.5 w-1.5 rounded-full ${ATTENDANCE_DOT_COLOR[s]}`}
                                />
                              ))}
                            </span>
                          )}
                        </div>
                        <div className="space-y-1">
                          {dayEvents.slice(0, 2).map((event) => (
                            <button
                              key={event.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditEvent(event);
                              }}
                              className={`block w-full truncate text-left text-xs font-medium hover:underline ${getEventColor(
                                event.eventType
                              )}`}
                            >
                              {event.title}
                            </button>
                          ))}
                          {dayEvents.length > 2 && (
                            <div className="text-xs text-muted-foreground">
                              +{dayEvents.length - 2} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" /> Present
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-destructive" /> Absent
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" /> Cancelled
                  </span>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div>
              {/* Add/Edit Event Form */}
              {showForm && (
                <div className="frosted mb-6 rounded-2xl p-6">
                  <h3 className="mb-4 text-lg font-semibold text-foreground">
                    {editingEventId ? "Edit Event" : "New Event"}
                  </h3>
                  <form onSubmit={handleAddEvent} className="space-y-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        Title
                      </label>
                      <Input
                        value={newEvent.title}
                        onChange={(e) =>
                          setNewEvent({ ...newEvent, title: e.target.value })
                        }
                        placeholder="e.g., Math Exam"
                        required
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        Type
                      </label>
                      <SelectNative
                        value={newEvent.eventType}
                        onChange={(e) =>
                          setNewEvent({ ...newEvent, eventType: e.target.value })
                        }
                      >
                        <option value="exam">Exam</option>
                        <option value="assignment">Assignment</option>
                        <option value="deadline">Deadline</option>
                        <option value="holiday">Holiday</option>
                      </SelectNative>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        Date
                      </label>
                      <Input
                        type="date"
                        value={newEvent.dueDate}
                        onChange={(e) =>
                          setNewEvent({ ...newEvent, dueDate: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-foreground">
                        Description (Optional)
                      </label>
                      <Input
                        value={newEvent.description}
                        onChange={(e) =>
                          setNewEvent({ ...newEvent, description: e.target.value })
                        }
                        placeholder="Add details"
                      />
                    </div>

                    <div className="flex gap-3">
                      <Button type="submit" className="flex-1">
                        {editingEventId ? "Save Changes" : "Add Event"}
                      </Button>
                      {editingEventId && (
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={() => handleDeleteEvent(editingEventId)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </form>
                </div>
              )}

              {/* Upcoming Events */}
              <div className="frosted rounded-2xl p-6">
                <h3 className="mb-4 text-lg font-semibold text-foreground">
                  Upcoming Events
                </h3>
                <div className="max-h-96 space-y-2 overflow-y-auto">
                  {events
                    .filter((e) => new Date(e.dueDate) >= new Date())
                    .sort(
                      (a, b) =>
                        new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
                    )
                    .map((event) => (
                      <EventListItem
                        key={event.id}
                        title={event.title}
                        dateLabel={format(new Date(event.dueDate), "MMM d, yyyy")}
                        description={event.description}
                        colorClassName={getEventColor(event.eventType)}
                        onEdit={() => startEditEvent(event)}
                        onDelete={() => handleDeleteEvent(event.id)}
                      />
                    ))}
                  {events.filter((e) => new Date(e.dueDate) >= new Date()).length === 0 && (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      No upcoming events
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
