"use client";

import { Suspense, useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DashboardNav } from "@/components/DashboardNav";
import { PageLoader } from "@/components/PageLoader";
import { useActiveSemester } from "@/lib/hooks/useActiveSemester";
import { useTheme, type ThemePreference } from "@/components/ThemeProvider";
import { CheckCircle2, AlertCircle, Sun, Moon, MonitorSmartphone, Trash2, Bell, BellOff } from "lucide-react";

/**
 * Notification.requestPermission(), serviceWorker.ready, and pushManager.subscribe()
 * are all promises that some browsers/OEM Android builds will leave pending
 * forever instead of rejecting when push isn't actually available - without
 * this, the button gets stuck on "Working..." with no feedback at all.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const bytes = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) bytes[i] = rawData.charCodeAt(i);
  return bytes.buffer;
}

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
  { value: "auto", label: "Auto", icon: MonitorSmartphone },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

export default function ProfilePage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ProfileContent />
    </Suspense>
  );
}

function ProfileContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { semesterId } = useActiveSemester();
  const { preference, setPreference } = useTheme();

  const [isLoading, setIsLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [detailsResult, setDetailsResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordResult, setPasswordResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [notifSupported, setNotifSupported] = useState(false);
  const [notifSubscribed, setNotifSubscribed] = useState(false);
  const [notifBusy, setNotifBusy] = useState(false);
  const [notifError, setNotifError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/profile");
      if (res.ok) {
        const data = await res.json();
        setName(data.name || "");
        setEmail(data.email || "");
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    const supported =
      typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
    setNotifSupported(supported);
    if (!supported) return;

    (async () => {
      try {
        const registration = await withTimeout(
          navigator.serviceWorker.ready,
          10000,
          "Timed out waiting for the app's background service to start."
        );
        const existing = await registration.pushManager.getSubscription();
        setNotifSubscribed(!!existing);
      } catch (error) {
        console.error("Error checking push subscription:", error);
      }
    })();
  }, []);

  const handleEnableNotifications = async () => {
    setNotifBusy(true);
    setNotifError("");
    try {
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        setNotifError("Notifications aren't configured on this deployment yet.");
        return;
      }

      const permission = await withTimeout(
        Notification.requestPermission(),
        20000,
        "Timed out waiting for the notification permission prompt."
      );
      if (permission !== "granted") {
        setNotifError("Notification permission was denied in the browser.");
        return;
      }

      const registration = await withTimeout(
        navigator.serviceWorker.ready,
        10000,
        "Timed out waiting for the app's background service to start."
      );
      const subscription = await withTimeout(
        registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        }),
        15000,
        "Timed out registering with the push service - your browser or network may be blocking it."
      );
      const json = subscription.toJSON();

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      if (!res.ok) throw new Error("Failed to save subscription");

      setNotifSubscribed(true);
    } catch (error) {
      console.error("Error enabling notifications:", error);
      const message = error instanceof Error ? error.message : "";
      setNotifError(
        message.startsWith("Timed out") ? message : "Couldn't turn on notifications. Please try again."
      );
    } finally {
      setNotifBusy(false);
    }
  };

  const handleDisableNotifications = async () => {
    setNotifBusy(true);
    setNotifError("");
    try {
      const registration = await withTimeout(
        navigator.serviceWorker.ready,
        10000,
        "Timed out waiting for the app's background service to start."
      );
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`, {
          method: "DELETE",
        });
        await subscription.unsubscribe();
      }
      setNotifSubscribed(false);
    } catch (error) {
      console.error("Error disabling notifications:", error);
      const message = error instanceof Error ? error.message : "";
      setNotifError(
        message.startsWith("Timed out") ? message : "Couldn't turn off notifications. Please try again."
      );
    } finally {
      setNotifBusy(false);
    }
  };

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingDetails(true);
    setDetailsResult(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json();
      if (res.ok) {
        setDetailsResult({ type: "success", message: "Profile updated" });
      } else {
        setDetailsResult({ type: "error", message: data.error || "Could not update profile" });
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      setDetailsResult({ type: "error", message: "Network error. Please try again." });
    } finally {
      setIsSavingDetails(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordResult(null);

    if (newPassword !== confirmPassword) {
      setPasswordResult({ type: "error", message: "New passwords don't match" });
      return;
    }

    setIsSavingPassword(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setPasswordResult({ type: "success", message: "Password updated" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setPasswordResult({ type: "error", message: data.error || "Could not update password" });
      }
    } catch (error) {
      console.error("Error updating password:", error);
      setPasswordResult({ type: "error", message: "Network error. Please try again." });
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !confirm(
        "This permanently deletes your account and everything in it - semesters, courses, timetable, attendance records, grades, and calendar events. This cannot be undone. Continue?"
      )
    ) {
      return;
    }

    setDeleteError("");
    setIsDeleting(true);
    try {
      const res = await fetch("/api/profile", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword }),
      });
      if (res.ok) {
        await signOut({ callbackUrl: "/" });
      } else {
        const data = await res.json();
        setDeleteError(data.error || "Could not delete your account");
      }
    } catch (error) {
      console.error("Error deleting account:", error);
      setDeleteError("Network error. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (status === "loading" || isLoading) {
    return <PageLoader />;
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <DashboardNav semesterId={semesterId} />

      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="mb-8 text-3xl font-bold text-foreground">Profile</h1>

        <div className="space-y-8">
          {/* Account details */}
          <div className="frosted rounded-2xl p-6">
            <h2 className="mb-4 text-xl font-semibold text-foreground">Account Details</h2>
            <form onSubmit={handleSaveDetails} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>

              {detailsResult && (
                <div
                  className={`frosted-inset flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
                    detailsResult.type === "success" ? "text-success" : "text-destructive"
                  }`}
                >
                  {detailsResult.type === "success" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0" />
                  )}
                  {detailsResult.message}
                </div>
              )}

              <Button type="submit" disabled={isSavingDetails}>
                {isSavingDetails ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </div>

          {/* Password */}
          <div className="frosted rounded-2xl p-6">
            <h2 className="mb-4 text-xl font-semibold text-foreground">Change Password</h2>
            <form onSubmit={handleSavePassword} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Current Password
                </label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    New Password
                  </label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Confirm New Password
                  </label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                </div>
              </div>

              {passwordResult && (
                <div
                  className={`frosted-inset flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
                    passwordResult.type === "success" ? "text-success" : "text-destructive"
                  }`}
                >
                  {passwordResult.type === "success" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0" />
                  )}
                  {passwordResult.message}
                </div>
              )}

              <Button type="submit" disabled={isSavingPassword}>
                {isSavingPassword ? "Saving..." : "Update Password"}
              </Button>
            </form>
          </div>

          {/* Appearance */}
          <div className="frosted rounded-2xl p-6">
            <h2 className="mb-1 text-xl font-semibold text-foreground">Appearance</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Auto switches to dark from 7pm to 6am based on your device&apos;s clock.
            </p>
            <div className="frosted-inset inline-flex gap-1 rounded-xl p-1">
              {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPreference(value)}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    preference === value
                      ? "frosted text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Notifications */}
          <div className="frosted rounded-2xl p-6">
            <h2 className="mb-1 text-xl font-semibold text-foreground">Class-End Reminders</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              {notifSupported
                ? "Get a notification right when a class ends, with one-tap Present / Absent buttons - no need to open the app. On iPhone, add this app to your Home Screen first (Share -> Add to Home Screen) for notifications to work."
                : "This browser doesn't support push notifications."}
            </p>

            {notifError && (
              <div className="frosted-inset mb-4 flex items-center gap-2 rounded-xl p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {notifError}
              </div>
            )}

            {notifSupported && (
              <Button
                variant={notifSubscribed ? "outline" : "default"}
                onClick={notifSubscribed ? handleDisableNotifications : handleEnableNotifications}
                disabled={notifBusy}
              >
                {notifSubscribed ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                {notifBusy ? "Working..." : notifSubscribed ? "Turn Off Reminders" : "Turn On Reminders"}
              </Button>
            )}
          </div>

          {/* Danger Zone */}
          <div className="frosted rounded-2xl border border-destructive/40 p-6">
            <h2 className="mb-1 text-xl font-semibold text-destructive">Danger Zone</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Permanently delete your account and everything in it - semesters, courses,
              timetable, attendance records, grades, and calendar events. This cannot be
              undone.
            </p>

            {!showDeleteConfirm ? (
              <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 className="h-4 w-4" /> Delete My Account
              </Button>
            ) : (
              <form onSubmit={handleDeleteAccount} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Confirm your password
                  </label>
                  <Input
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    required
                  />
                </div>

                {deleteError && (
                  <div className="frosted-inset flex items-center gap-2 rounded-xl px-4 py-3 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {deleteError}
                  </div>
                )}

                <div className="flex gap-3">
                  <Button type="submit" variant="destructive" disabled={isDeleting}>
                    {isDeleting ? "Deleting..." : "Permanently Delete Account"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeletePassword("");
                      setDeleteError("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
