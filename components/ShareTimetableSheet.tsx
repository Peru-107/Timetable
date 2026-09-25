"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Link2Off, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";
import { showToast } from "@/lib/toast";

/**
 * Share this semester's weekly timetable with classmates: a link (copy or
 * send via the phone's share sheet) plus a QR code to scan in class.
 * Classmates see only subjects and weekly slots, and can copy them into
 * their own account.
 */
export function ShareTimetableSheet({
  semesterId,
  open,
  onClose,
}: {
  semesterId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [url, setUrl] = useState("");
  const [qr, setQr] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !semesterId) return;
    let cancelled = false;
    fetch("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ semesterId }),
    })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || "Couldn't create a link");
        const link = `${window.location.origin}/share/${body.token}`;
        const dataUrl = await QRCode.toDataURL(link, { margin: 1, width: 240 });
        if (!cancelled) {
          setUrl(link);
          setQr(dataUrl);
          setError("");
        }
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [open, semesterId]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      showToast({ message: "Link copied" });
    } catch {
      (document.getElementById("share-url") as HTMLInputElement | null)?.select();
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title: "My timetable", text: "Copy my class timetable:", url });
    } catch {
      // Dismissed, or not supported - the copy button still works.
    }
  };

  const turnOff = async () => {
    const res = await fetch(`/api/share?semesterId=${semesterId}`, { method: "DELETE" });
    if (res.ok) {
      setUrl("");
      setQr("");
      showToast({ message: "Link turned off - old links no longer work" });
      onClose();
    }
  };

  const canNativeShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <ResponsiveSheet open={open} onClose={onClose} title="Share timetable">
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : !url ? (
        <p className="text-sm text-muted-foreground">Creating link...</p>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input id="share-url" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
            <Button type="button" variant="outline" size="icon" onClick={copy} aria-label="Copy link">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          {qr && (
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- a generated data: URL */}
              <img src={qr} alt="QR code for the share link" width={200} height={200} className="rounded-xl bg-white p-2" />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {canNativeShare && (
              <Button type="button" onClick={nativeShare}>
                <Share2 className="h-4 w-4" /> Send link
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={turnOff} className="text-destructive hover:text-destructive">
              <Link2Off className="h-4 w-4" /> Turn off link
            </Button>
          </div>
        </div>
      )}
    </ResponsiveSheet>
  );
}
