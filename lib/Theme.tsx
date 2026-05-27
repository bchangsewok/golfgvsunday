"use client";
import { createContext, useContext, useEffect, useState } from "react";

export type ThemeMode = "dark" | "light";
export type AccentName = "fairway" | "ocean" | "sunset" | "royal" | "rose";

export const ACCENTS: { name: AccentName; label: string; swatch: string }[] = [
  { name: "fairway", label: "Fairway", swatch: "#16a34a" },
  { name: "ocean",   label: "Ocean",   swatch: "#0ea5e9" },
  { name: "sunset",  label: "Sunset",  swatch: "#f97316" },
  { name: "royal",   label: "Royal",   swatch: "#a855f7" },
  { name: "rose",    label: "Rose",    swatch: "#f43f5e" }
];

type Ctx = {
  mode: ThemeMode;
  accent: AccentName;
  setMode: (m: ThemeMode) => void;
  setAccent: (a: AccentName) => void;
  toggleMode: () => void;
};

const ThemeCtx = createContext<Ctx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Read initial values written by the inline pre-hydration script (see layout).
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const [accent, setAccentState] = useState<AccentName>("fairway");

  useEffect(() => {
    const m = (document.documentElement.classList.contains("light") ? "light" : "dark") as ThemeMode;
    const a = (document.documentElement.dataset.accent || "fairway") as AccentName;
    setModeState(m);
    setAccentState(a);
  }, []);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    document.documentElement.classList.toggle("light", m === "light");
    try { localStorage.setItem("gv:theme", m); } catch {}
  };
  const setAccent = (a: AccentName) => {
    setAccentState(a);
    document.documentElement.dataset.accent = a;
    try { localStorage.setItem("gv:accent", a); } catch {}
  };
  const toggleMode = () => setMode(mode === "dark" ? "light" : "dark");

  return (
    <ThemeCtx.Provider value={{ mode, accent, setMode, setAccent, toggleMode }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme outside ThemeProvider");
  return ctx;
}

// Inline script string — runs in <head> before React hydrates, prevents FOUC.
export const THEME_INIT_SCRIPT = `
(function(){
  try {
    var m = localStorage.getItem('gv:theme') || 'dark';
    var a = localStorage.getItem('gv:accent') || 'fairway';
    if (m === 'light') document.documentElement.classList.add('light');
    document.documentElement.dataset.accent = a;
  } catch(e) {}
})();`;
