"use client";
import { useState, useEffect, useRef } from "react";
import { useTheme, ACCENTS } from "@/lib/Theme";
import { Moon, Sun, Palette } from "lucide-react";

export function ThemeToggle() {
  const { mode, accent, toggleMode, setAccent } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (open && ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="flex items-center gap-1" ref={ref}>
      <button
        onClick={toggleMode}
        title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition"
        aria-label="Toggle theme">
        {mode === "dark"
          ? <Sun className="w-4 h-4 text-sand-500" />
          : <Moon className="w-4 h-4 text-fairway-500" />}
      </button>

      <div className="relative">
        <button
          onClick={() => setOpen(s => !s)}
          title="Color scheme"
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition flex items-center gap-1.5"
          aria-label="Color scheme">
          <Palette className="w-4 h-4" style={{ color: ACCENTS.find(a => a.name === accent)?.swatch }} />
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-2 card p-2 min-w-[160px] z-40 shadow-2xl">
            <div className="text-white/50 text-[10px] font-semibold uppercase tracking-wider px-2 py-1">Accent</div>
            {ACCENTS.map(a => (
              <button
                key={a.name}
                onClick={() => { setAccent(a.name); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition
                  ${accent === a.name ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5"}`}>
                <span className="w-3 h-3 rounded-full ring-2 ring-white/20" style={{ background: a.swatch }} />
                {a.label}
                {accent === a.name && <span className="ml-auto text-white/50">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
