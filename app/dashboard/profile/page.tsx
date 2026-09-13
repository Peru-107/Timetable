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
import { CheckCircle2, AlertCircle, Sun, Moon, MonitorSmartphone, Trash2 } from "lucide-react";

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
