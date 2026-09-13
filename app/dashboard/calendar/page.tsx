"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth } from "date-fns";

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  eventType: string;
  dueDate: string;
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const semesterId = searchParams.get("semesterId");

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    eventType: "exam",
    dueDate: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (semesterId) {
      fetchEvents();
    }
  }, [semesterId]);

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

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newEvent, semesterId }),
      });

      if (res.ok) {
        setNewEvent({
          title: "",
          description: "",
          eventType: "exam",
          dueDate: new Date().toISOString().split("T")[0],
        });
        setShowForm(false);
        fetchEvents();
      }
    } catch (error) {
      console.error("Error adding event:", error);
    }
  };

  const getDaysInMonth = () => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  };

  const getEventsForDate = (date: Date) => {
    return events.filter((event) => {
      const eventDate = new Date(event.dueDate);
      return isSameDay(eventDate, date);
    });
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case "exam":
        return "bg-red-100 text-red-800";
      case "assignment":
        return "bg-blue-100 text-blue-800";
      case "deadline":
        return "bg-yellow-100 text-yellow-800";
      case "holiday":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  const daysInMonth = getDaysInMonth();
  const firstDayOfMonth = daysInMonth[0].getDay();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="space-x-4">
            <Link href="/dashboard">
              <Button variant="ghost">← Dashboard</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Calendar</h1>
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "+ Add Event"}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Calendar */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold text-gray-800">
                  {format(currentDate, "MMMM yyyy")}
                </h2>
                <div className="space-x-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      setCurrentDate(
                        new Date(
                          currentDate.getFullYear(),
                          currentDate.getMonth() - 1
                        )
                      )
                    }
                  >
                    ← Prev
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      setCurrentDate(
                        new Date(
                          currentDate.getFullYear(),
                          currentDate.getMonth() + 1
                        )
                      )
                    }
                  >
                    Next →
                  </Button>
                </div>
              </div>

              {/* Days of week */}
              <div className="grid grid-cols-7 gap-2 mb-2">
                {DAYS_OF_WEEK.map((day) => (
                  <div
                    key={day}
                    className="text-center font-semibold text-gray-600 py-2"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-2">
                {/* Empty cells for days before month starts */}
                {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square"></div>
                ))}

                {/* Days of month */}
                {daysInMonth.map((day, index) => {
                  const dayEvents = getEventsForDate(day);
                  const isCurrentMonth = isSameMonth(day, currentDate);

                  return (
                    <div
                      key={index}
                      className={`aspect-square p-2 rounded border cursor-pointer hover:bg-gray-50 ${
                        isCurrentMonth
                          ? "border-gray-200"
                          : "border-gray-100 bg-gray-50"
                      }`}
                      onClick={() => {
                        setSelectedDate(day);
                        setNewEvent({
                          ...newEvent,
                          dueDate: format(day, "yyyy-MM-dd"),
                        });
                        setShowForm(true);
                      }}
                    >
                      <div
                        className={`text-sm font-semibold mb-1 ${
                          isCurrentMonth ? "text-gray-800" : "text-gray-400"
                        }`}
                      >
                        {day.getDate()}
                      </div>
                      <div className="space-y-1">
                        {dayEvents.slice(0, 2).map((event) => (
                          <div
                            key={event.id}
                            className={`text-xs px-1 py-0.5 rounded truncate ${getEventColor(
                              event.eventType
                            )}`}
                          >
                            {event.title}
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <div className="text-xs text-gray-600 px-1">
                            +{dayEvents.length - 2} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div>
            {/* Add Event Form */}
            {showForm && (
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-800">
                  New Event
                </h3>
                <form onSubmit={handleAddEvent} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Type
                    </label>
                    <select
                      value={newEvent.eventType}
                      onChange={(e) =>
                        setNewEvent({
                          ...newEvent,
                          eventType: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="exam">Exam</option>
                      <option value="assignment">Assignment</option>
                      <option value="deadline">Deadline</option>
                      <option value="holiday">Holiday</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description (Optional)
                    </label>
                    <Input
                      value={newEvent.description}
                      onChange={(e) =>
                        setNewEvent({
                          ...newEvent,
                          description: e.target.value,
                        })
                      }
                      placeholder="Add details"
                    />
                  </div>

                  <Button type="submit" className="w-full">
                    Add Event
                  </Button>
                </form>
              </div>
            )}

            {/* Upcoming Events */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-800">
                Upcoming Events
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {events
                  .filter(
                    (e) =>
                      new Date(e.dueDate) >= new Date()
                  )
                  .sort(
                    (a, b) =>
                      new Date(a.dueDate).getTime() -
                      new Date(b.dueDate).getTime()
                  )
                  .map((event) => (
                    <div
                      key={event.id}
                      className={`p-3 rounded-lg ${getEventColor(
                        event.eventType
                      )}`}
                    >
                      <p className="font-semibold text-sm">{event.title}</p>
                      <p className="text-xs mt-1">
                        {format(new Date(event.dueDate), "MMM d, yyyy")}
                      </p>
                      {event.description && (
                        <p className="text-xs mt-1 opacity-75">
                          {event.description}
                        </p>
                      )}
                    </div>
                  ))}
                {events.filter((e) => new Date(e.dueDate) >= new Date()).length === 0 && (
                  <p className="text-gray-500 text-sm text-center py-4">
                    No upcoming events
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
