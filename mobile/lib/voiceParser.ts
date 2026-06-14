// Voice transcript → score patch.
//
// One utterance can carry up to three intents at once, in order:
//   1. Hole selector       — "hole 7", "h 7", "hole seven"
//   2. Player selector     — first word(s) matching a player name on the round
//   3. Score data          — digits / keywords, e.g. "4133", "birdie", "olympic 2"
//
// Examples (round with players Noo, BK, Pong on a par-4 hole):
//   "hole 1 noo 4133"          → jump hole 1, switch to Noo, str=4 oly=1 spc=3 sao=3
//   "noo birdie"               → switch to Noo, strokes = par-1
//   "bk olympic 2"             → switch to BK, olympic_points=2 (no stroke change)
//   "4"                        → strokes=4 for current player on current hole
//   "next"                     → navigate hole+1
//
// Anything the parser can't match returns `null` so the UI shows the raw text.

export type PlayerRef  = { id: string; name: string };
export type HoleRef    = { id: string; number: number; par: number };

export type ParseCtx = {
  par:      number;          // par for the CURRENT hole (used by birdie/par/bogey terms when no hole jump)
  players?: PlayerRef[];     // optional — enables player-name matching
  holes?:   HoleRef[];       // optional — enables hole-number matching
};

export type ParsedScore = {
  hole_number?:             number;
  player_id?:               string;
  strokes?:                 number;
  olympic_points?:          number;
  olympic_special_points?:  number;
  sao_points?:              number;
  command?:                 "next" | "back";
  summary:                  string;     // human-readable, set when any field is set
};

// ───────────────────────── lexicons ─────────────────────────
const WORD_NUM: Record<string, number> = {
  // English
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  minus: -1, negative: -1, plus: 1, positive: 1,
  // Thai (romanized + native script)
  "ศูนย์": 0, "หนึ่ง": 1, "สอง": 2, "สาม": 3, "สี่": 4, "ห้า": 5,
  "หก":   6, "เจ็ด":  7, "แปด":  8, "เก้า": 9, "สิบ":   10,
  // Common romanizations spoken aloud / mis-heard by EN engine
  "nung": 1, "song": 2, "sam": 3, "see": 4, "ha": 5,
  "hok":  6, "jed":  7, "paet": 8, "kao": 9, "sip": 10,
  // Thai negative / positive markers
  "ลบ": -1, "บวก": 1
};
const TERM_OFFSET: Record<string, number> = {
  // English
  "hole in one": -100, "ace": -100,
  "albatross": -3, "double eagle": -3,
  "eagle": -2,
  "birdie": -1,
  "par":     0,
  "bogey":   1,
  "double bogey": 2, "double": 2,
  "triple bogey": 3, "triple": 3,
  "quad":    4,
  // Thai equivalents (commonly used)
  "อีเกิ้ล": -2, "อีเกิล": -2,
  "เบอร์ดี้": -1, "เบอร์ดี": -1, "เบิร์ดดี้": -1,
  "พาร์": 0, "พา": 0,
  "โบกี้": 1, "โบกี": 1,
  "ดับเบิ้ลโบกี้": 2, "ดับเบิ้ล": 2,
  "ทริปเปิ้ล": 3
};

// Thai numeral digits → Arabic
const THAI_DIGITS: Record<string, string> = {
  "๐": "0", "๑": "1", "๒": "2", "๓": "3", "๔": "4",
  "๕": "5", "๖": "6", "๗": "7", "๘": "8", "๙": "9"
};

function normalize(s: string): string {
  // Convert Thai digits to Arabic, then strip punctuation but keep Thai letters.
  let out = "";
  for (const c of s) out += THAI_DIGITS[c] ?? c;
  return out.toLowerCase()
            .replace(/[^a-z0-9฀-๿\s\-]/g, " ")    // keep Thai Unicode block
            .replace(/\s+/g, " ")
            .trim();
}

function parseWordOrDigitInto(tokens: string[], start = 0): { value: number; nextIndex: number } | null {
  for (let i = start; i < tokens.length; i++) {
    const t = tokens[i];
    if (/^\d+$/.test(t)) return { value: Number(t), nextIndex: i + 1 };
    if (t in WORD_NUM)   return { value: WORD_NUM[t], nextIndex: i + 1 };
  }
  return null;
}

// ── Hole prefix ─────────────────────────────────────────────
// Strip leading "hole N" / "h N" / "หลุม N" and return the number.
// In Thai script "หลุม" may be merged with the number (e.g. "หลุม7" or "หลุม๗")
// so we also accept that form.
function extractHoleNumber(tokens: string[], ctx: ParseCtx): { holeNumber: number; remaining: string[] } | null {
  if (tokens.length === 0) return null;
  const head = tokens[0];
  const HOLE_WORDS = new Set(["hole", "h", "หลุม"]);
  const isHole = HOLE_WORDS.has(head);

  // Merged form "หลุม7" or "hole7"
  if (!isHole) {
    const m = head.match(/^(หลุม|hole)(\d+)$/);
    if (m) {
      const n = Number(m[2]);
      const maxHole = ctx.holes?.length ?? 18;
      if (n >= 1 && n <= maxHole) return { holeNumber: n, remaining: tokens.slice(1) };
    }
    return null;
  }

  const got = parseWordOrDigitInto(tokens, 1);
  if (!got) return null;
  const maxHole = ctx.holes?.length ?? 18;
  if (got.value < 1 || got.value > maxHole) return null;
  return { holeNumber: got.value, remaining: tokens.slice(got.nextIndex) };
}

// ── Player prefix ───────────────────────────────────────────
// Match the longest player-name prefix at the start of the tokens.
// Player names can be multi-word; sort by length so "Big BK" beats "BK".
function extractPlayer(tokens: string[], ctx: ParseCtx): { playerId: string; remaining: string[] } | null {
  if (!ctx.players || ctx.players.length === 0 || tokens.length === 0) return null;
  type Entry = { id: string; words: string[] };
  const entries: Entry[] = ctx.players.map(p => ({
    id: p.id,
    words: normalize(p.name).split(" ").filter(Boolean)
  })).filter(e => e.words.length > 0);
  // Longest-first so multi-word names match before their substrings.
  entries.sort((a, b) => b.words.length - a.words.length);
  for (const e of entries) {
    if (tokens.length < e.words.length) continue;
    let ok = true;
    for (let i = 0; i < e.words.length; i++) {
      if (tokens[i] !== e.words[i]) { ok = false; break; }
    }
    if (ok) return { playerId: e.id, remaining: tokens.slice(e.words.length) };
  }
  return null;
}

// ── Positional digit sequence — "4133" / "4 1 3 3" / "four one three three" ──
function tryDigitSequence(tokens: string[]): number[] | null {
  if (tokens.length === 0) return null;
  const digits: number[] = [];
  for (const t of tokens) {
    if (/^\d+$/.test(t)) for (const c of t) digits.push(Number(c));
    else if (t in WORD_NUM) {
      const n = WORD_NUM[t];
      if (n < 0 || n > 9) return null;
      digits.push(n);
    } else return null;
  }
  return digits.length > 0 ? digits : null;
}

// ── Main entry point ────────────────────────────────────────
export function parseVoice(raw: string, ctx: ParseCtx | number): ParsedScore | null {
  // Backwards-compat: old callers passed just `par` as a number.
  const context: ParseCtx = typeof ctx === "number" ? { par: ctx } : ctx;

  const text = normalize(raw);
  if (!text) return null;

  // ── Navigation commands (whole utterance only) ──────────────
  if (/^(next|forward|ถัดไป|ต่อไป)$/.test(text))           return { command: "next", summary: "Next hole" };
  if (/^(back|previous|prev|last|ก่อนหน้า|ย้อนกลับ)$/.test(text)) return { command: "back", summary: "Previous hole" };

  // Tokenize once and walk through prefixes (hole, player) before the score body.
  let tokens = text.split(" ").filter(Boolean);
  const result: ParsedScore = { summary: "" };
  const summary: string[] = [];

  // Hole prefix
  const h = extractHoleNumber(tokens, context);
  if (h) {
    result.hole_number = h.holeNumber;
    summary.push(`Hole ${h.holeNumber}`);
    tokens = h.remaining;
  }

  // Player prefix
  const p = extractPlayer(tokens, context);
  if (p) {
    result.player_id = p.playerId;
    const playerName = context.players!.find(x => x.id === p.playerId)?.name;
    if (playerName) summary.push(playerName);
    tokens = p.remaining;
  }

  // Whatever remains is the "score body" — par for stroke math comes from
  // the targeted hole (if a hole was named) else the current par.
  let parForBody = context.par;
  if (result.hole_number != null && context.holes) {
    const tgt = context.holes.find(x => x.number === result.hole_number);
    if (tgt) parForBody = tgt.par;
  }

  // ── Olympic Special (must precede generic "olympic" match) ──
  const bodyText = tokens.join(" ");
  if (/(\bspecial\b|\bkp\b|near\s*pin|nearest\s*pin|พิเศษ|เข้าหลุม)/.test(bodyText)) {
    const found = parseWordOrDigitInto(tokens, 0) ||
                  // fallback: search for any number after "minus"
                  (() => {
                    const minusIdx = tokens.indexOf("minus");
                    if (minusIdx >= 0) {
                      const n = parseWordOrDigitInto(tokens, minusIdx + 1);
                      if (n) return { value: -Math.abs(n.value), nextIndex: n.nextIndex };
                    }
                    return null;
                  })();
    const v = found?.value ?? 1;
    result.olympic_special_points = v;
    summary.push(`Special ${v > 0 ? "+" : ""}${v}`);
    return finalize(result, summary);
  }

  // ── Olympic ─────────────────────────────────────────────────
  if (/(\bolympic\b|\boly\b|โอลิม|โอลิมปิก)/.test(bodyText)) {
    const found = parseWordOrDigitInto(tokens, 0);
    const v = found?.value ?? 1;
    result.olympic_points = v;
    summary.push(`Olympic ${v}`);
    return finalize(result, summary);
  }

  // ── Golf terms (birdie, par, bogey, …) ──────────────────────
  const sortedTerms = Object.keys(TERM_OFFSET).sort((a, b) => b.length - a.length);
  for (const term of sortedTerms) {
    const re = new RegExp(`\\b${term.replace(/\s+/g, "\\s+")}\\b`);
    if (re.test(bodyText)) {
      const off = TERM_OFFSET[term];
      const strokes = off === -100 ? 1 : Math.max(1, parForBody + off);
      result.strokes = strokes;
      const nice = term.replace(/\b\w/g, c => c.toUpperCase());
      summary.push(`${nice} · ${strokes}`);
      return finalize(result, summary);
    }
  }

  // ── Positional digit grammar — "4133" → str·oly·spec·sao ────
  const digits = tryDigitSequence(tokens);
  if (digits && digits.length > 0 && digits[0] >= 1) {
    result.strokes                                  = digits[0];
    summary.push(`${digits[0]} strokes`);
    if (digits.length > 1) { result.olympic_points         = digits[1]; summary.push(`Oly ${digits[1]}`); }
    if (digits.length > 2) { result.olympic_special_points = digits[2]; summary.push(`Spec ${digits[2]}`); }
    if (digits.length > 3) { result.sao_points             = digits[3]; summary.push(`SAO ${digits[3]}`); }
    return finalize(result, summary);
  }

  // ── Bare single number → strokes ────────────────────────────
  const num = parseWordOrDigitInto(tokens, 0);
  if (num && num.value >= 1 && num.value <= 12) {
    result.strokes = num.value;
    summary.push(`${num.value} strokes`);
    return finalize(result, summary);
  }

  // No score body, but we may still have hole/player jumps to apply.
  if (result.hole_number != null || result.player_id != null) {
    return finalize(result, summary);
  }
  return null;
}

function finalize(r: ParsedScore, parts: string[]): ParsedScore {
  r.summary = parts.join(" · ");
  return r;
}
