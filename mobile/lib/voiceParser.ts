// Turn a voice transcript into a score patch.
// Grammar (English, v1):
//   "three", "four", "5", "six", "seven", "eight", "nine"   → strokes = N
//   "birdie" / "eagle" / "par" / "bogey" / "double" / "triple"
//                                                           → strokes = par + offset
//   "olympic two", "oly minus one", "plus three olympic"    → olympic_points
//   "special five", "kp"                                    → olympic_special_points
//   "next" / "back" / "previous"                            → navigation command
//
// Returns null when nothing parseable was found.

export type ParsedScore = {
  strokes?:                 number;
  olympic_points?:          number;
  olympic_special_points?:  number;
  command?:                 "next" | "back";
  // Human-readable summary for toast/feedback. Always set when result is non-null.
  summary:                  string;
};

const WORD_NUM: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  minus: -1, negative: -1, plus: 1, positive: 1
};

// Term → strokes offset relative to par
const TERM_OFFSET: Record<string, number> = {
  "hole in one": -100,   // sentinel: caller resolves to strokes=1
  "ace":         -100,
  "albatross":   -3,
  "double eagle":-3,
  "eagle":       -2,
  "birdie":      -1,
  "par":          0,
  "bogey":        1,
  "double bogey": 2,
  "double":       2,
  "triple bogey": 3,
  "triple":       3,
  "quad":         4
};

function findFirstNumber(words: string[], allowNegative = false): { value: number; index: number } | null {
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const digit = /^-?\d+$/.test(w) ? Number(w) : null;
    if (digit !== null && !Number.isNaN(digit)) {
      // negative-prefix handling for spoken "minus three"
      if (allowNegative && i > 0 && (words[i - 1] === "minus" || words[i - 1] === "negative")) {
        return { value: -digit, index: i };
      }
      return { value: digit, index: i };
    }
    if (w in WORD_NUM) {
      const n = WORD_NUM[w];
      // "minus three" → -3
      if (allowNegative && (w === "minus" || w === "negative") && i + 1 < words.length) {
        const next = words[i + 1];
        const nv = /^\d+$/.test(next) ? Number(next) : (next in WORD_NUM ? WORD_NUM[next] : null);
        if (nv !== null) return { value: -Math.abs(nv), index: i + 1 };
      }
      if (n >= 0 && n <= 10) return { value: n, index: i };
    }
  }
  return null;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s\-]/g, " ")   // drop punctuation
    .replace(/\s+/g, " ")
    .trim();
}

export function parseVoice(raw: string, par: number): ParsedScore | null {
  const text = normalize(raw);
  if (!text) return null;

  // ── Navigation commands ──────────────────────────────────────────────
  if (/\b(next|forward)\b/.test(text) && !/(hole|par)/.test(text)) {
    return { command: "next", summary: "Next hole" };
  }
  if (/\b(back|previous|prev|last)\b/.test(text) && !/(hole|par)/.test(text)) {
    return { command: "back", summary: "Previous hole" };
  }

  // ── Olympic Special (must come before plain "olympic") ───────────────
  if (/\b(special|kp|near\s*pin|nearest\s*pin)\b/.test(text)) {
    const words = text.split(" ");
    const found = findFirstNumber(words, true);
    const value = found?.value ?? 1;   // "kp" alone → +1
    return {
      olympic_special_points: value,
      summary: `Special ${value > 0 ? "+" : ""}${value}`
    };
  }

  // ── Olympic ──────────────────────────────────────────────────────────
  if (/\b(olympic|oly)\b/.test(text)) {
    const words = text.split(" ");
    const found = findFirstNumber(words, false);
    const value = found?.value ?? 1;
    return {
      olympic_points: value,
      summary: `Olympic ${value}`
    };
  }

  // ── Golf terms (birdie, par, bogey, …) ───────────────────────────────
  // Check longer terms first so "double bogey" beats "bogey".
  const sortedTerms = Object.keys(TERM_OFFSET).sort((a, b) => b.length - a.length);
  for (const term of sortedTerms) {
    if (new RegExp(`\\b${term.replace(/\s+/g, "\\s+")}\\b`).test(text)) {
      let strokes: number;
      const off = TERM_OFFSET[term];
      if (off === -100) {                  // "ace" / "hole in one"
        strokes = 1;
      } else {
        strokes = Math.max(1, par + off);
      }
      const niceTerm = term.replace(/\b\w/g, c => c.toUpperCase());
      return { strokes, summary: `${niceTerm} · ${strokes} strokes` };
    }
  }

  // ── Bare number → strokes ────────────────────────────────────────────
  const words = text.split(" ");
  const num = findFirstNumber(words, false);
  if (num && num.value >= 1 && num.value <= 12) {
    return { strokes: num.value, summary: `${num.value} strokes` };
  }

  return null;
}
