"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type ThemePreference = "auto" | "light" | "dark";

export const ACCENTS = [
  { id: "saffron", name: "Saffron", light: "#c97a1f", dark: "#eaa556" },
  { id: "ocean", name: "Ocean", light: "#1f6fd1", dark: "#5aa2ff" },
  { id: "forest", name: "Forest", light: "#23804d", dark: "#5cc98a" },
  { id: "plum", name: "Plum", light: "#6e45c9", dark: "#a88bff" },
  { id: "rose", name: "Rose", light: "#c73b63", dark: "#ff7a9c" },
  { id: "lagoon", name: "Lagoon", light: "#0d8184", dark: "#3fd0c9" },
  { id: "graphite", name: "Graphite", light: "#2e2e36", dark: "#e4e4ea" },
] as const;
export type AccentId = (typeof ACCENTS)[number]["id"];

export const STYLES = [
  { id: "glass", name: "Bento + Glass", hint: "Apple-style tiles with soft frosted chrome" },
  { id: "apple", name: "Apple", hint: "iOS greys, system font, flat tiles" },
  { id: "bento", name: "Bento", hint: "Solid tiles, no blur or glow" },
  { id: "minimal", name: "Minimal", hint: "Flat, hairline borders, no effects" },
] as const;
export type StyleId = (typeof STYLES)[number]["id"];
const STYLE_STORAGE_KEY = "timetable-style";

/** How the Overview draws per-subject attendance. */
export type ChartStyle = "rings" | "sunflower";
const CHART_STORAGE_KEY = "timetable-chart-style";

const STORAGE_KEY = "timetable-theme-preference";
export const ACCENT_STORAGE_KEY = "timetable-accent";

function readStored<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(key) as T | null) || fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode / blocked storage - the choice still applies this session.
  }
}
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
  accent: AccentId;
  setAccent: (accent: AccentId) => void;
  chartStyle: ChartStyle;
  setChartStyle: (style: ChartStyle) => void;
  designStyle: StyleId;
  setDesignStyle: (style: StyleId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("auto");
  const [accent, setAccentState] = useState<AccentId>("saffron");
  const [chartStyle, setChartStyleState] = useState<ChartStyle>("rings");
  const [designStyle, setDesignStyleState] = useState<StyleId>("glass");

  const applyTheme = useCallback((pref: ThemePreference) => {
    const resolved = pref === "auto" ? computeAutoTheme() : pref;
    document.documentElement.setAttribute("data-theme", resolved);
  }, []);

  useEffect(() => {
    const stored = readStored<ThemePreference>(STORAGE_KEY, "auto");
    setPreferenceState(stored);
    applyTheme(stored);
    const storedAccent = readStored<AccentId>(ACCENT_STORAGE_KEY, "saffron");
    setAccentState(storedAccent);
    document.documentElement.setAttribute("data-accent", storedAccent);
    setChartStyleState(readStored<ChartStyle>(CHART_STORAGE_KEY, "rings"));
    const storedStyle = readStored<StyleId>(STYLE_STORAGE_KEY, "glass");
    setDesignStyleState(storedStyle);
    document.documentElement.setAttribute("data-style", storedStyle);
  }, [applyTheme]);

  useEffect(() => {
    if (preference !== "auto") return;
    const id = setInterval(() => applyTheme("auto"), AUTO_RECHECK_MS);
    return () => clearInterval(id);
  }, [preference, applyTheme]);

  const setPreference = useCallback(
    (pref: ThemePreference) => {
      setPreferenceState(pref);
      writeStored(STORAGE_KEY, pref);
      applyTheme(pref);
    },
    [applyTheme]
  );

  const setAccent = useCallback((next: AccentId) => {
    setAccentState(next);
    writeStored(ACCENT_STORAGE_KEY, next);
    document.documentElement.setAttribute("data-accent", next);
  }, []);

  const setChartStyle = useCallback((next: ChartStyle) => {
    setChartStyleState(next);
    writeStored(CHART_STORAGE_KEY, next);
  }, []);

  const setDesignStyle = useCallback((next: StyleId) => {
    setDesignStyleState(next);
    writeStored(STYLE_STORAGE_KEY, next);
    document.documentElement.setAttribute("data-style", next);
  }, []);

  return (
    <ThemeContext.Provider
      value={{ preference, setPreference, accent, setAccent, chartStyle, setChartStyle, designStyle, setDesignStyle }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
