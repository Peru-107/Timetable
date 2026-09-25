"use client";

import { Suspense } from "react";
import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { DashboardNav } from "@/components/DashboardNav";
import { PageLoader } from "@/components/PageLoader";
import { StudyChat } from "@/components/StudyChat";
import { ArrowLeft } from "lucide-react";

export default function StudyAllPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <StudyAllContent />
    </Suspense>
  );
}

function StudyAllContent() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const semesterId = searchParams.get("semesterId");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading") {
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

        <h1 className="mb-8 font-display text-4xl font-bold tracking-tight text-foreground">
          Ask Across All Subjects
        </h1>

        {semesterId ? (
          <StudyChat semesterId={semesterId} scopeLabel="everything you've uploaded this semester" />
        ) : (
          <div className="frosted rounded-2xl p-8 text-center text-muted-foreground">
            Select a semester first from the Overview tab.
          </div>
        )}
      </div>
    </div>
  );
}
