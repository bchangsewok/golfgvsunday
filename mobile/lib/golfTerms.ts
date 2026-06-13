// Mirror of web app golf-term helpers.
export function termFor(strokes: number | null | undefined, par: number) {
  if (strokes == null) return null;
  const d = strokes - par;
  if (strokes === 1) return { label: "Ace",     short: "Ace" };
  if (d <= -3)       return { label: "Albatross", short: "Alb" };
  if (d === -2)      return { label: "Eagle",   short: "Eag" };
  if (d === -1)      return { label: "Birdie",  short: "Bir" };
  if (d ===  0)      return { label: "Par",     short: "Par" };
  if (d ===  1)      return { label: "Bogey",   short: "Bog" };
  if (d ===  2)      return { label: "Double",  short: "Dbl" };
  if (d ===  3)      return { label: "Triple",  short: "Trp" };
  return { label: `+${d}`, short: `+${d}` };
}
export function entryButtonsFor(par: number, max = 9) {
  const out: { strokes: number; label: string }[] = [];
  for (let s = 1; s <= max; s++) {
    const t = termFor(s, par);
    out.push({ strokes: s, label: t?.short ?? `${s}` });
  }
  return out;
}
