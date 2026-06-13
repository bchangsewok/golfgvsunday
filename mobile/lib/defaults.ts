// Player color palette + small helpers shared between screens.
export const PLAYER_COLORS = [
  "#16a34a", "#0ea5e9", "#f59e0b", "#dc2626", "#a855f7", "#0891b2"
];

// Random 6-char join code.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function genCode(): string {
  let out = "";
  for (let i = 0; i < 6; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

// Random token (admin / player token).
export function genToken(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  }).replace(/-/g, "");
}
