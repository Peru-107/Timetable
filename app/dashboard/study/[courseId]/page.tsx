"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion, type Variants } from "motion/react";
import { DashboardNav } from "@/components/DashboardNav";
import { PageLoader } from "@/components/PageLoader";
import { StudyChat } from "@/components/StudyChat";
import { ShimmerText } from "@/components/kokonutui/shimmer-text";
import { Button } from "@/components/ui/button";

const materialVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, height: 0, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } },
};
import {
  ArrowLeft,
  Upload,
  FileText,
  Image as ImageIcon,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
} from "lucide-react";

interface StudyMaterial {
  id: string;
  fileName: string;
  fileType: "pdf" | "image";
  extractedText: string | null;
  status: "processing" | "completed" | "failed";
  errorMessage: string | null;
  createdAt: string;
}

export default function StudyCoursePage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <StudyCourseContent />
    </Suspense>
  );
}

function StudyCourseContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams<{ courseId: string }>();
  const searchParams = useSearchParams();
  const semesterId = searchParams.get("semesterId");
  const courseId = params.courseId;

  const [courseName, setCourseName] = useState<string>("");
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (courseId) {
      fetchMaterials();
      fetchCourseName();
    }
  }, [courseId]);

  const fetchCourseName = async () => {
    try {
      if (!semesterId) return;
      const res = await fetch(`/api/courses?semesterId=${semesterId}`);
      const courses = await res.json();
      const match = Array.isArray(courses) ? courses.find((c) => c.id === courseId) : null;
      if (match) setCourseName(match.name);
    } catch (error) {
      console.error("Error fetching course:", error);
    }
  };

  const fetchMaterials = async () => {
    try {
      const res = await fetch(`/api/study-materials?courseId=${courseId}`);
      const data = await res.json();
      setMaterials(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching study materials:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploadError(null);
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("courseId", courseId);

      const res = await fetch("/api/study-materials", { method: "POST", body: formData });
      const data = await res.json();

      if (res.ok) {
        setMaterials((prev) => [data, ...prev]);
      } else {
        setUploadError(data.error || "Upload failed. Please try again.");
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      setUploadError("Network error while uploading. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this file? Its extracted content will no longer be available.")) return;
    try {
      const res = await fetch(`/api/study-materials?id=${id}`, { method: "DELETE" });
      if (res.ok) setMaterials((prev) => prev.filter((m) => m.id !== id));
    } catch (error) {
      console.error("Error deleting study material:", error);
    }
  };

  if (status === "loading" || isLoading) {
    return <PageLoader />;
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <DashboardNav semesterId={semesterId} />

      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <Link
          href={`/dashboard/study?semesterId=${semesterId}`}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Study Notebook
        </Link>

        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-3xl font-bold text-foreground">
            {courseName || "Course"}
          </h1>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" /> Upload File
              </>
            )}
          </Button>
        </div>

        {uploadError && (
          <div className="frosted-inset mb-6 flex items-center gap-2 rounded-xl p-4 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {uploadError}
          </div>
        )}

        {materials.length === 0 ? (
          <div className="frosted mb-8 rounded-2xl p-8 text-center text-muted-foreground">
            No study material uploaded yet for this course. Upload a PDF or a photo of your notes
            to ask AI questions about it below.
          </div>
        ) : (
          <motion.div
            className="mb-8 space-y-3"
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.06 } } }}
          >
            <AnimatePresence initial={false}>
            {materials.map((m) => (
              <motion.div
                key={m.id}
                layout
                variants={materialVariants}
                initial="hidden"
                animate="show"
                exit="exit"
                className="frosted overflow-hidden rounded-2xl"
              >
                <div className="flex items-center gap-3 p-4">
                  <div className="frosted-inset flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl">
                    {m.fileType === "pdf" ? (
                      <FileText className="h-4 w-4 text-primary" />
                    ) : (
                      <ImageIcon className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{m.fileName}</p>
                    {m.status === "processing" && (
                      <p className="flex items-center gap-1.5 text-sm">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        <ShimmerText text="Extracting text..." className="text-sm" />
                      </p>
                    )}
                    {m.status === "completed" && (
                      <p className="flex items-center gap-1.5 text-sm text-success">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Ready
                      </p>
                    )}
                    {m.status === "failed" && (
                      <p className="flex items-center gap-1.5 text-sm text-destructive">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {m.errorMessage || "Extraction failed"}
                      </p>
                    )}
                  </div>
                  {m.status === "completed" && m.extractedText && (
                    <button
                      type="button"
                      onClick={() => setExpandedId(expandedId === m.id ? null : m.id)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-black/5 hover:text-foreground"
                      aria-label={expandedId === m.id ? "Hide extracted text" : "Preview extracted text"}
                      aria-expanded={expandedId === m.id}
                    >
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${expandedId === m.id ? "rotate-180" : ""}`}
                      />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(m.id)}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-black/5 hover:text-destructive"
                    aria-label={`Delete ${m.fileName}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {expandedId === m.id && m.extractedText && (
                  <div data-lenis-prevent className="frosted-inset mx-4 mb-4 max-h-64 overflow-y-auto rounded-xl p-4 text-sm text-foreground whitespace-pre-wrap">
                    {m.extractedText}
                  </div>
                )}
              </motion.div>
            ))}
            </AnimatePresence>
          </motion.div>
        )}

        {semesterId && (
          <StudyChat semesterId={semesterId} courseId={courseId} scopeLabel={courseName || "this subject"} />
        )}
      </div>
    </div>
  );
}
