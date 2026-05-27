import "./globals.css";
import type { Metadata, Viewport } from "next";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/lib/Theme";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "GolfGVSunday — Sunday golf, settled.",
  description: "Realtime scoring & betting for Sunday golf rounds."
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0f172a"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply saved theme + accent BEFORE React hydrates, to prevent flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          <div className="min-h-screen flex flex-col">
            <header className="app-header sticky top-0 z-30 backdrop-blur-md bg-rough-900/70 border-b border-white/5">
              <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
                <a href="/" className="flex items-center gap-2 group">
                  <span className="text-2xl">⛳</span>
                  <span className="font-bold text-white tracking-tight">
                    Golf<span className="text-fairway-500">GV</span>Sunday
                  </span>
                </a>
                <div className="flex items-center gap-2">
                  <span className="chip bg-white/5 text-white/60 border border-white/10 hidden sm:inline-flex">v0.1</span>
                  <ThemeToggle />
                </div>
              </div>
            </header>
            <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">{children}</main>
            <footer className="text-center text-xs text-white/30 py-6">
              Made for Sunday rounds · ⛳ · Local-first SQLite
            </footer>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
