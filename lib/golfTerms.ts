// Golf scoring terminology and presentation helpers.

export type GolfTerm = {
  label: string;     // human label
  short: string;     // 1-2 char chip
  diff: number;      // strokes vs par; null when no score
  color: string;     // tailwind classes
  bg: string;
  icon: string;
};

export function termFor(strokes: number | null | undefined, par: number): GolfTerm | null {
  if (strokes == null) return null;
  const d = strokes - par;
  if (strokes === 1) return { label: "Hole-in-One", short: "H1", diff: d, color: "text-fuchsia-300", bg: "bg-fuchsia-500/20 border-fuchsia-500/40", icon: "🏆" };
  if (d <= -3) return { label: "Albatross", short: "AL", diff: d, color: "text-violet-300", bg: "bg-violet-500/20 border-violet-500/40", icon: "🦅" };
  if (d === -2) return { label: "Eagle",    short: "EA", diff: d, color: "text-sky-300",    bg: "bg-sky-500/20 border-sky-500/40", icon: "🦅" };
  if (d === -1) return { label: "Birdie",   short: "BD", diff: d, color: "text-cyan-300",   bg: "bg-cyan-500/20 border-cyan-500/40", icon: "🐦" };
  if (d ===  0) return { label: "Par",      short: "PA", diff: d, color: "text-white",      bg: "bg-white/10 border-white/20", icon: "·" };
  if (d ===  1) return { label: "Bogey",    short: "BG", diff: d, color: "text-amber-300",  bg: "bg-amber-500/20 border-amber-500/40", icon: "" };
  if (d ===  2) return { label: "Double",   short: "DB", diff: d, color: "text-orange-300", bg: "bg-orange-500/20 border-orange-500/40", icon: "" };
  if (d ===  3) return { label: "Triple",   short: "TR", diff: d, color: "text-red-300",    bg: "bg-red-500/20 border-red-500/40", icon: "" };
  return       { label: `+${d}`,        short: `+${d}`, diff: d, color: "text-red-400",    bg: "bg-red-500/20 border-red-500/40", icon: "" };
}

// Buttons shown for score entry. One per stroke value from 1..maxStrokes (cap 9).
// Labels follow standard golf names relative to the hole's par.
export function entryButtonsFor(par: number, maxStrokes: number) {
  const cap = Math.min(maxStrokes, 9);
  const labelFor = (diff: number) =>
    diff <= -3 ? "Albatross" :
    diff === -2 ? "Eagle" :
    diff === -1 ? "Birdie" :
    diff === 0  ? "Par" :
    diff === 1  ? "Bogey" :
    diff === 2  ? "Double" :
    diff === 3  ? "Triple" :
    `+${diff}`;

  const out: { strokes: number; diff: number; label: string; short: string }[] = [];
  for (let s = 1; s <= cap; s++) {
    const diff = s - par;
    out.push({ strokes: s, diff, label: labelFor(diff), short: labelFor(diff) });
  }
  return out;
}
