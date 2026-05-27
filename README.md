# GolfGVSunday ⛳

Realtime golf-betting scorecard for Sunday rounds. 1–6 players, Dog Flight + Japanese Olympic + Nearest-on-Green, live dashboard on every device.

## Features
- 1–6 players, mobile/tablet/web responsive (PWA-ready)
- Share round via 6-char code or QR
- Players record their own scores; **Admin** can record for everyone
- **Dog Flight**: each hole has a multiplier (default ×1, editable per hole)
- **Japanese Olympic**: gold/silver/bronze per hole
- **Nearest on Green**: distance buckets that scale by player count
- Maximum-score cap per hole (scales by player count)
- Realtime dashboard via Supabase Realtime — every device sees updates instantly

## Quick start

### 1. Create a Supabase project
- Go to https://supabase.com → **New project**
- Open **SQL Editor** and paste the contents of [`supabase/schema.sql`](supabase/schema.sql), run it
- Copy your **Project URL** and **anon key** from Project Settings → API

### 2. Configure env
```bash
cp .env.example .env.local
# then edit .env.local with your URL + anon key
```

### 3. Install + run
```bash
npm install
npm run dev
```
Open http://localhost:3000

### 4. Deploy (Vercel)
- Push to GitHub
- Import to https://vercel.com → set the two env vars → Deploy

## How to use
1. **Create round** → choose holes/players/stake → you get an admin link (keep it private)
2. **Share code** (the 6-char code, or QR) with the group
3. Each player opens the link, taps **Enter scores**, picks their name, records strokes + nearest-on-green per hole
4. The **Dashboard** (`/round/CODE`) updates live for everyone — leaderboard, per-hole points, money totals
5. The **Admin** (`/round/CODE?admin=TOKEN`) can edit names, hole pars, multipliers, stakes, and record anyone's score

## Scoring rules

### Dog Flight (default mode: loser-pays-each)
Worst score on each hole pays each better player by **1 point × hole multiplier**. Ties at the bottom split the loss. (Set `settings.dogFlightMode = "skins"` in the rounds table for Skins-style outright-winner scoring with ties carrying over.)

### Japanese Olympic
Gold/Silver/Bronze = 3/2/1 points per hole × multiplier. Ties share their tier evenly. Net-summed to zero across players.

### Nearest on Green
Buckets scale by player count — closer = higher rank. Points are symmetric around the center (closest player gains, farthest pays), zero-sum across players who entered a distance.

**Defaults** (editable per-round via `rounds.settings` JSON):

| Players | Distance buckets (m, closest first) | Max strokes over par |
|---|---|---|
| 2 | ≤2, >2 | par + 5 |
| 3 | ≤1, ≤3, >3 | par + 4 |
| 4 | ≤1, ≤2, ≤4, >4 | par + 4 |
| 5 | ≤1, ≤2, ≤3, ≤5, >5 | par + 3 |
| 6 | ≤0.5, ≤1, ≤2, ≤3, ≤5, >5 | par + 3 |

To customize for your group, update the `settings` JSON column on the round row. See [`lib/defaults.ts`](lib/defaults.ts) for shape.

## Project structure
```
app/
  page.tsx                    landing — create / join
  round/[code]/page.tsx       live dashboard
  round/[code]/score/page.tsx hole-by-hole score entry
  round/[code]/admin/page.tsx admin panel
lib/
  supabase.ts                 client + types
  useRound.ts                 hook: load + subscribe to realtime
  scoring.ts                  DF + Olympic + NG calculations
  defaults.ts                 default tables + helpers
supabase/schema.sql           DB schema, RLS, realtime publication
```

## Notes on auth
This app uses **share-code + admin-token** auth at the app layer (no email login). RLS is intentionally permissive — anyone with a round code can read/write that round. If you want stricter security, swap the RLS policies in `schema.sql` for ones that check a JWT custom claim.
