"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { compressImageIfNeeded, MAX_UPLOAD_BYTES } from "@/lib/imageUpload";
import { Upload, AlertCircle, Loader2, CheckCircle2, X } from "lucide-react";

interface ExtractedHoliday {
  title: string;
  date: string;
  selected: boolean;
}

interface HolidayImportPanelProps {
  semesterId: string;
  /** Called after holidays are added, so the parent can refetch its events. */
  onImported: () => void;
  onClose: () => void;
}

/**
 * Upload a holiday list (image/PDF) and extract candidate holidays with
 * Gemini, but never auto-add them: an institute-wide list can include days
 * that don't apply to every program, and the model can misread a date, so
 * the student reviews and picks which ones actually become calendar events.
 * The parent controls whether this panel is mounted at all (like the
 * Add/Edit Event form it sits alongside in the sidebar).
 */
export function HolidayImportPanel({ semesterId, onImported, onClose }: HolidayImportPanelProps) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [holidays, setHolidays] = useState<ExtractedHoliday[]>([]);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [resultHasFailures, setResultHasFailures] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clearState = () => {
    setIsExtracting(false);
    setIsAdding(false);
    setExtractError(null);
    setHolidays([]);
    setResultMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;

    if (!rawFile.type.startsWith("image/") && rawFile.size > MAX_UPLOAD_BYTES) {
      setExtractError("That file is too large to upload. Try a smaller file or a photo instead.");
      e.target.value = "";
      return;
    }

    setIsExtracting(true);
    setExtractError(null);
    setResultMessage(null);
    setHolidays([]);

    try {
      const file = await compressImageIfNeeded(rawFile);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("semesterId", semesterId);

      const res = await fetch("/api/holidays/extract", { method: "POST", body: formData });
      let data: { holidays?: Array<{ title: string; date: string }>; error?: string } | null = null;
      try {
        data = await res.json();
      } catch {
        // Non-JSON response, e.g. a platform-level size/timeout error page
      }

      if (!res.ok || !data?.holidays) {
        setExtractError(data?.error || "Could not read a holiday list from this file.");
        return;
      }
      if (data.holidays.length === 0) {
        setExtractError("No holidays found in that file. Try a clearer scan.");
        return;
      }

      setHolidays(data.holidays.map((h) => ({ ...h, selected: true })));
    } catch (error) {
      console.error("Error extracting holidays:", error);
      setExtractError("Something went wrong reading that file. Please try again.");
    } finally {
      setIsExtracting(false);
      e.target.value = "";
    }
  };

  const toggleAll = (selected: boolean) => {
    setHolidays((prev) => prev.map((h) => ({ ...h, selected })));
  };

  const updateHoliday = (index: number, patch: Partial<ExtractedHoliday>) => {
    setHolidays((prev) => prev.map((h, i) => (i === index ? { ...h, ...patch } : h)));
  };

  const handleAddSelected = async () => {
    const selected = holidays.filter((h) => h.selected);
    if (selected.length === 0) return;

    setIsAdding(true);
    let created = 0;
    const failures: string[] = [];

    for (const holiday of selected) {
      try {
        const res = await fetch("/api/calendar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: holiday.title,
            eventType: "holiday",
            dueDate: holiday.date,
            semesterId,
          }),
        });
        if (res.ok) {
          created++;
        } else {
          const data = await res.json().catch(() => null);
          failures.push(`${holiday.title} (${holiday.date}): ${data?.error || "failed"}`);
        }
      } catch {
        failures.push(`${holiday.title} (${holiday.date}): network error`);
      }
    }

    setIsAdding(false);
    let message = `Added ${created} holiday${created === 1 ? "" : "s"} to your calendar.`;
    if (failures.length > 0) {
      message += ` ${failures.length} couldn't be added: ${failures.join("; ")}`;
    }
    setResultMessage(message);
    setResultHasFailures(failures.length > 0);
    setHolidays([]);
    if (created > 0) onImported();
  };

  return (
    <div className="frosted mb-6 rounded-2xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Import Holidays</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:bg-black/5 hover:text-foreground"
          aria-label="Close holiday import"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {holidays.length === 0 && !resultMessage && (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            Upload the holiday list your institute sent you (a photo or PDF) - we'll read it and
            let you pick which days to add.
          </p>
          <Button
            variant="outline"
            disabled={isExtracting}
            onClick={() => fileInputRef.current?.click()}
          >
            {isExtracting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Reading file...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" /> Choose file
              </>
            )}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            className="hidden"
            onChange={handleFileUpload}
          />
          {extractError && (
            <div className="frosted-inset mt-4 flex items-start gap-2 rounded-xl p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{extractError}</span>
            </div>
          )}
        </>
      )}

      {holidays.length > 0 && (
        <>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Found {holidays.length} holiday{holidays.length === 1 ? "" : "s"} - review and pick
              which to add.
            </p>
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                onClick={() => toggleAll(true)}
                className="text-primary hover:underline"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => toggleAll(false)}
                className="text-muted-foreground hover:underline"
              >
                Select none
              </button>
            </div>
          </div>

          <div className="max-h-80 space-y-2 overflow-y-auto">
            {holidays.map((holiday, index) => (
              <div key={index} className="frosted-inset flex items-center gap-2 rounded-xl p-2.5">
                <Checkbox
                  checked={holiday.selected}
                  onCheckedChange={(checked) =>
                    updateHoliday(index, { selected: checked === true })
                  }
                  aria-label={`Include ${holiday.title}`}
                />
                <Input
                  value={holiday.title}
                  onChange={(e) => updateHoliday(index, { title: e.target.value })}
                  className="h-8 flex-1"
                />
                <Input
                  type="date"
                  value={holiday.date}
                  onChange={(e) => updateHoliday(index, { date: e.target.value })}
                  className="h-8 w-40"
                />
              </div>
            ))}
          </div>

          <div className="mt-4 flex gap-3">
            <Button
              className="flex-1"
              disabled={isAdding || holidays.every((h) => !h.selected)}
              onClick={handleAddSelected}
            >
              {isAdding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Adding...
                </>
              ) : (
                `Add ${holidays.filter((h) => h.selected).length} Selected`
              )}
            </Button>
            <Button type="button" variant="outline" onClick={clearState}>
              Cancel
            </Button>
          </div>
        </>
      )}

      {resultMessage && (
        <div
          className={`frosted-inset flex items-start gap-2 rounded-xl p-3 text-sm ${
            resultHasFailures ? "text-warning" : "text-success"
          }`}
        >
          {resultHasFailures ? (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{resultMessage}</span>
        </div>
      )}
    </div>
  );
}
