"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface SemesterOption {
  id: string;
  name: string;
}

/**
 * Dashboard sub-pages are linked to without a semesterId query param from
 * some entry points (e.g. direct nav before a semester is selected). This
 * resolves a semesterId to fetch against either way, and reports whether
 * the user has no semesters at all so pages can show that state instead of
 * spinning forever waiting for a param that will never arrive.
 */
export function useActiveSemester() {
  const searchParams = useSearchParams();
  const paramSemesterId = searchParams.get("semesterId");

  const [semesters, setSemesters] = useState<SemesterOption[]>([]);
  const [isLoadingSemesters, setIsLoadingSemesters] = useState(!paramSemesterId);

  useEffect(() => {
    if (paramSemesterId) return;

    let isMounted = true;
    fetch("/api/semesters")
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) setSemesters(Array.isArray(data) ? data : []);
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setIsLoadingSemesters(false);
      });

    return () => {
      isMounted = false;
    };
  }, [paramSemesterId]);

  const semesterId = paramSemesterId || semesters[0]?.id || null;

  return {
    semesterId,
    isResolvingSemester: !paramSemesterId && isLoadingSemesters,
    hasNoSemesters: !paramSemesterId && !isLoadingSemesters && semesters.length === 0,
  };
}
