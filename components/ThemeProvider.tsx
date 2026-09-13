"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type ThemePreference = "auto" | "light" | "dark";

const STORAGE_KEY = "timetable-theme-preference";
const AUTO_RECHECK_MS = 5 * 60 * 1000;

// Fixed sunset/sunrise window (no location permission needed): dark from
// 7pm to 6am local time.
function computeAutoTheme(): "light" | "dark" {
  const hour = new Date().getHours();
  return hour >= 19 || hour < 6 ? "dark" : "light";
}

interface ThemeContextValue {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("auto");

  const applyTheme = useCallback((pref: ThemePreference) => {
    const resolved = pref === "auto" ? computeAutoTheme() : pref;
    document.documentElement.setAttribute("data-theme", resolved);
  }, []);

  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as ThemePreference | null) || "auto";
    setPreferenceState(stored);
    applyTheme(stored);
  }, [applyTheme]);

  useEffect(() => {
    if (preference !== "auto") return;
    const id = setInterval(() => applyTheme("auto"), AUTO_RECHECK_MS);
    return () => clearInterval(id);
  }, [preference, applyTheme]);

  const setPreference = useCallback(
    (pref: ThemePreference) => {
      setPreferenceState(pref);
      localStorage.setItem(STORAGE_KEY, pref);
      applyTheme(pref);
    },
    [applyTheme]
  );

  return (
    <ThemeContext.Provider value={{ preference, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
