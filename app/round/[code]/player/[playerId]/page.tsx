"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useRound } from "@/lib/useRound";
import { calculate } from "@/lib/scoring";
import { ChevronLeft, Trophy, Swords, Zap, Sparkles, Target, HelpCircle, Flag } from "lucide-react";

export default function PlayerDetail({ params }: { params: { code: string; playerId: string } }) {
  const code = params.code.toUpperCase();
  const search = useSearchParams();
  const adminToken = search.get("admin") || "";
  const { round, players, holes, scores, loading, err } = useRound(code);

  const totals = useMemo(() => {
    if (!round) return null;
    return calculate(players, holes, scores, round.settings, {
      dogFlight: Number(round.dog_flight_stake ?? round.stake_per_point ?? 100),
      olympic:   Number(round.olympic_stake   ?? round.stake_per_point ?? 10)
    });
  }, [round, players, holes, scores]);

  if (loading) return <div className="text-white/60 text-center py-20">Loading…</div>;
  if (err || !round) return <div className="text-red-400 text-center py-20">{err || "Not found"}</div>;
  const me = players.find(p => p.id === params.playerId);
  if (!me) return <div className="text-red-400 text-center py-20">Player not found</div>;

  const sortedHoles = [...holes].sort((a, b) => a.number - b.number);
  const currency = round.currency;
  const N = players.length;
  const K = N;     // Olympic Extra bundle / set size = number of players
  const dfStake = Number(round.dog_flight_stake ?? round.stake_per_point ?? 100);
  const olyStake = Number(round.olympic_stake ?? round.stake_per_point ?? 10);

  // Per-player aggregates from totals
  const dfMoney   = totals?.dogFlightMoney?.[me.id]    || 0;
  const olyMoney  = totals?.olympicMoney?.[me.id]      || 0;   // (olympic + special)
  const saoMoney  = totals?.saoMoney?.[me.id]          || 0;
  const olyExMoney= totals?.olympicExtraMoney?.[me.id] || 0;
  const totalMoney = dfMoney + olyMoney + saoMoney + olyExMoney;
  const foodPaid   = Number(me.food_expenses) || 0;
  const foodPool   = players.reduce((s, x) => s + (Number(x.food_expenses) || 0), 0);
  const foodShare  = players.length > 0 ? foodPool / players.length : 0;
  const totalCost  = totalMoney + foodPaid - foodShare;   // bet + paid − fair share

  const olyNet = totals?.olympicTotal?.[me.id] || 0;
  const saoNet = totals?.saoTotal?.[me.id]     || 0;
  const olyExNet = totals?.olympicExtraTotal?.[me.id] || 0;
  const olyExRaw = totals?.olympicExtraRaw?.[me.id]   || 0;

  // Per-player Olympic raw (own inputs only)
  let myOlyInputSum = 0, myOlySpInputSum = 0, mySaoInputSum = 0;
  for (const s of scores) {
    if (s.player_id !== me.id) continue;
    myOlyInputSum   += Number(s.olympic_points)         || 0;
    myOlySpInputSum += Number(s.olympic_special_points) || 0;
    mySaoInputSum   += Number(s.sao_points)             || 0;
  }

  // Olympic-value counts for the player (for showing bundle / set math)
  const olympicCounts = new Map<number, number>();
  for (const s of scores) {
    if (s.player_id !== me.id) continue;
    const v = Math.round(Number(s.olympic_points) || 0);
    if (v >= 1 && v <= K) olympicCounts.set(v, (olympicCounts.get(v) || 0) + 1);
  }
  const bundles: { v: number; count: number; bundlePts: number; isBest: boolean }[] = [];
  for (const [v, c] of olympicCounts) {
    const b = v * Math.floor(c / K) * K;
    bundles.push({ v, count: c, bundlePts: b, isBest: false });
  }
  bundles.sort((a, b) => a.v - b.v);
  const bestBundle = bundles.reduce((m, b) => Math.max(m, b.bundlePts), 0);
  for (const b of bundles) if (b.bundlePts === bestBundle && bestBundle > 0) { b.isBest = true; break; }
  let hasFullSet = K > 0;
  for (let v = 1; v <= K; v++) if ((olympicCounts.get(v) || 0) < 1) { hasFullSet = false; break; }
  const fullSetBonus = hasFullSet ? (K * (K + 1)) / 2 : 0;

  // Totals strokes + vs par
  const totalStrokes = sortedHoles.reduce((sum, h) => {
    const s = scores.find(x => x.hole_id === h.id && x.player_id === me.id);
    return sum + (s?.strokes || 0);
  }, 0);
  const totalPar = sortedHoles.reduce((s, h) => s + h.par, 0);
  const vsPar = totalStrokes - totalPar;

  const fmt = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(0)}`;
  const fmtMoney = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(0)} ${currency}`;
  const dashboardHref = `/round/${code}${adminToken ? `?admin=${adminToken}` : ""}`;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link href={dashboardHref} className="btn-ghost">
          <ChevronLeft className="w-4 h-4" /> Dashboard
        </Link>
        <div className="text-white/40 text-xs">
          Round <code className="text-fairway-500 font-bold">{code}</code> · {round.name}
        </div>
      </div>

      {/* Header card */}
      <div className="card p-5 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full grid place-items-center text-white font-bold text-2xl shadow-lg"
             style={{ background: me.color }}>
          {me.name[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-white truncate">{me.name}</h1>
          <div className="text-white/60 text-sm flex flex-wrap gap-x-3">
            <span>Seat {me.seat}</span>
            <span>HCP {me.handicap}</span>
            <span><Flag className="inline w-3 h-3" /> {totalStrokes > 0 ? `${totalStrokes} strokes` : "no strokes yet"}</span>
            {totalStrokes > 0 && (
              <span className={vsPar > 0 ? "text-red-400" : vsPar < 0 ? "text-sky-300" : "text-white/50"}>
                ({vsPar > 0 ? "+" : ""}{vsPar} vs par {totalPar})
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className={`text-3xl font-bold tabular-nums ${totalCost > 0 ? "text-fairway-500" : totalCost < 0 ? "text-red-400" : "text-white/60"}`}>
            {fmtMoney(totalCost)}
          </div>
          <div className="text-white/40 text-xs">
            Total Cost
            {(foodPool > 0) && (
              <span className="ml-1 tabular-nums">
                = bet {totalMoney > 0 ? "+" : ""}{totalMoney.toFixed(0)}
                {" "}+ food {foodPaid.toFixed(0)}
                {" "}− share {foodShare.toFixed(0)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Money breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MoneyCard icon={<Swords className="w-4 h-4" />} color="text-orange-300" label="Dog Flight" value={fmtMoney(dfMoney)} />
        <MoneyCard icon={<Trophy className="w-4 h-4" />} color="text-sand-500"   label="Olympic"
                   value={fmtMoney(olyMoney + saoMoney)}
                   sub={`Oly ${fmt(olyNet)} pt · SAO ${fmt(saoNet)} pt`} />
        <MoneyCard icon={<Trophy className="w-4 h-4" />} color="text-amber-300"  label="Olympic Extra"
                   value={fmtMoney(olyExMoney)}
                   sub={`raw ${fmt(olyExRaw)} · net ${fmt(olyExNet)} pt`} />
        <MoneyCard icon={<Sparkles className="w-4 h-4" />} color="text-fuchsia-300" label="Inputs you typed"
                   value={`${myOlyInputSum + myOlySpInputSum + mySaoInputSum}`}
                   sub={`🏆 ${myOlyInputSum} · ✨ ${myOlySpInputSum} · ⚡ ${mySaoInputSum}`} />
      </div>

      {/* Hole-by-hole */}
      <div className="card p-3 overflow-x-auto">
        <h2 className="text-white/80 font-semibold mb-2">Hole-by-hole</h2>
        <table className="w-full text-sm min-w-[640px]">
          <thead className="text-white/40 text-xs">
            <tr className="border-b border-white/10">
              <th className="text-left py-1.5 px-2">#</th>
              <th className="text-center py-1.5 px-2">Par</th>
              <th className="text-center py-1.5 px-2">×Mult</th>
              <th className="text-center py-1.5 px-2">Score</th>
              <th className="text-center py-1.5 px-2 text-fairway-500">DF pt</th>
              <th className="text-center py-1.5 px-2 text-sand-500">🏆 Oly</th>
              <th className="text-center py-1.5 px-2 text-amber-300">✨ Sp</th>
              <th className="text-center py-1.5 px-2 text-fuchsia-300">⚡ SAO</th>
              <th className="text-right py-1.5 px-2">DF {currency}</th>
              <th className="text-right py-1.5 px-2">Oly {currency}</th>
              <th className="text-right py-1.5 px-2 font-bold">Hole {currency}</th>
            </tr>
          </thead>
          <tbody>
            {sortedHoles.map(h => {
              const s = scores.find(x => x.hole_id === h.id && x.player_id === me.id);
              const ph = totals?.perHole.find(x => x.holeId === h.id);
              const dfPts = ph?.dogFlightPoints?.[me.id] || 0;
              const dfM = ph?.dogFlightMoney?.[me.id] || 0;
              const olyHole = ph?.olympic?.[me.id] || 0;
              const saoHole = ph?.sao?.[me.id] || 0;
              const olyHoleM = (olyHole + saoHole) * olyStake;
              const totHoleM = dfM + olyHoleM;
              const term = s?.strokes != null ? scoreTerm(s.strokes, h.par) : null;
              return (
                <tr key={h.id} className="border-b border-white/5">
                  <td className="py-1.5 px-2 text-white/70 font-mono">{h.number}</td>
                  <td className="py-1.5 px-2 text-center text-white/50">{h.par}</td>
                  <td className="py-1.5 px-2 text-center text-white/40">{h.multiplier > 1 ? `×${h.multiplier}` : "—"}</td>
                  <td className="py-1.5 px-2 text-center">
                    {s?.strokes != null
                      ? <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${term!.chip}`}>{s.strokes}</span>
                      : <span className="text-white/30">—</span>}
                  </td>
                  <td className={`py-1.5 px-2 text-center tabular-nums ${dfPts > 0 ? "text-fairway-500" : dfPts < 0 ? "text-red-400" : "text-white/30"}`}>{dfPts !== 0 ? fmt(dfPts) : "—"}</td>
                  <td className="py-1.5 px-2 text-center tabular-nums text-sand-500/80">{s?.olympic_points || ""}</td>
                  <td className="py-1.5 px-2 text-center tabular-nums text-amber-300/80">{s?.olympic_special_points ? fmt(s.olympic_special_points) : ""}</td>
                  <td className="py-1.5 px-2 text-center tabular-nums text-fuchsia-300/80">{s?.sao_points ? fmt(s.sao_points) : ""}</td>
                  <td className={`py-1.5 px-2 text-right tabular-nums ${dfM > 0 ? "text-fairway-500" : dfM < 0 ? "text-red-400" : "text-white/30"}`}>{dfM !== 0 ? fmt(dfM) : "—"}</td>
                  <td className={`py-1.5 px-2 text-right tabular-nums ${olyHoleM > 0 ? "text-fairway-500" : olyHoleM < 0 ? "text-red-400" : "text-white/30"}`}>{olyHoleM !== 0 ? fmt(olyHoleM) : "—"}</td>
                  <td className={`py-1.5 px-2 text-right tabular-nums font-bold ${totHoleM > 0 ? "text-fairway-500" : totHoleM < 0 ? "text-red-400" : "text-white/30"}`}>{totHoleM !== 0 ? fmt(totHoleM) : "—"}</td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-white/10 font-bold">
              <td className="py-2 px-2 text-white">Total</td>
              <td className="py-2 px-2 text-center text-white/60">{totalPar}</td>
              <td></td>
              <td className="py-2 px-2 text-center text-white">{totalStrokes}</td>
              <td className="py-2 px-2 text-center text-white/60 tabular-nums" colSpan={4}>
                {vsPar > 0 ? "+" : ""}{vsPar} vs par
              </td>
              <td className={`py-2 px-2 text-right tabular-nums ${dfMoney > 0 ? "text-fairway-500" : "text-red-400"}`}>{fmt(dfMoney)}</td>
              <td className={`py-2 px-2 text-right tabular-nums ${(olyMoney+saoMoney) > 0 ? "text-fairway-500" : (olyMoney+saoMoney) < 0 ? "text-red-400" : "text-white/40"}`}>{fmt(olyMoney + saoMoney)}</td>
              <td className={`py-2 px-2 text-right tabular-nums ${(dfMoney+olyMoney+saoMoney) > 0 ? "text-fairway-500" : (dfMoney+olyMoney+saoMoney) < 0 ? "text-red-400" : "text-white/40"}`}>{fmt(dfMoney+olyMoney+saoMoney)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Calculation explanations */}
      <div className="space-y-3">
        <h2 className="text-white/80 font-semibold">How your money was calculated</h2>

        {/* Dog Flight */}
        <ExplainSection
          icon={<Swords className="w-4 h-4 text-orange-300" />}
          color="text-orange-300"
          title="Dog Flight"
          formula={`Per hole, you're compared 1-on-1 with each other player. If your stroke count is lower you win the pair; lower wins by ${`birdie ×${(round.settings as any)?.localRules?.dfBirdieMult ?? 2}`} / eagle ×${(round.settings as any)?.localRules?.dfEagleMult ?? 5} if you achieved that. Points include the hole multiplier (×${'mult'}). Money = points × ${dfStake} (DF stake).`}
        >
          <div className="text-white/70 text-sm">
            Your total: <b className={dfMoney > 0 ? "text-fairway-500" : "text-red-400"}>{fmtMoney(dfMoney)}</b>{" "}
            (sum of DF $ column above)
          </div>
        </ExplainSection>

        {/* Olympic */}
        <ExplainSection
          icon={<Trophy className="w-4 h-4 text-sand-500" />}
          color="text-sand-500"
          title="Olympic (incl. Special + SAO)"
          formula={`For each hole, every entered Olympic value (🏆) + Olympic Special (✨) + SAO (⚡) counts as a "call" against each opponent. Zero-sum: net = your_call × (N−1) − Σ others' calls. Money = net × ${olyStake} (Olympic stake). N = ${N} players.`}
        >
          <div className="text-white/70 text-sm space-y-0.5">
            <div>Your inputs: 🏆 {myOlyInputSum} · ✨ {myOlySpInputSum} · ⚡ {mySaoInputSum} = {myOlyInputSum + myOlySpInputSum + mySaoInputSum}</div>
            <div>Net (sum of zero-sum per-hole settlements): <b>{fmt(olyNet + saoNet)} pt</b></div>
            <div>Money: <b className={(olyMoney+saoMoney) > 0 ? "text-fairway-500" : (olyMoney+saoMoney) < 0 ? "text-red-400" : ""}>{fmtMoney(olyMoney + saoMoney)}</b></div>
          </div>
        </ExplainSection>

        {/* Olympic Extra */}
        <ExplainSection
          icon={<Trophy className="w-4 h-4 text-amber-300" />}
          color="text-amber-300"
          title="Olympic Extra"
          formula={`Derived from your Olympic input only (🏆), not Special. With K = N = ${K} players: for each value V in 1..${K}, bundle[V] = V × floor(count[V] / ${K}) × ${K}. Only the MAX bundle counts (best single repeat), not the sum. If you have ≥1 of every value 1..${K}, add fullSetBonus = ${(K * (K + 1)) / 2}. raw = bestBundle + fullSetBonus. Net = raw × N − Σ all raws. Money = net × ${olyStake}.`}
          help="/help/olympic-extra"
        >
          <div className="text-white/70 text-sm space-y-1">
            <div className="font-semibold text-amber-300">Per-value bundles:</div>
            {bundles.length === 0 && <div className="text-white/40 text-xs ml-2">— no value 1..{K} entered —</div>}
            <ul className="text-xs ml-2 space-y-0.5 font-mono">
              {bundles.map(b => (
                <li key={b.v} className={b.isBest ? "text-amber-300 font-bold" : b.bundlePts ? "text-amber-300/70" : "text-white/40"}>
                  V={b.v}, count={b.count} → {b.v} × floor({b.count}/{K}) × {K} = {b.bundlePts}
                  {b.isBest && <span className="ml-1 chip bg-amber-500/30 text-amber-200 border border-amber-500/40">best</span>}
                </li>
              ))}
            </ul>
            <div className="text-white/70 text-xs">bestBundle (MAX) = <b className="text-amber-300">{bestBundle}</b></div>
            <div className="text-white/70 text-xs">
              Full set 1..{K}? <b className={hasFullSet ? "text-fairway-500" : "text-white/40"}>{hasFullSet ? "Yes" : "No"}</b>
              {hasFullSet && <> → +{fullSetBonus} bonus</>}
            </div>
            <div className="border-t border-white/10 pt-1.5 mt-1">
              <span className="text-white/70 text-xs">raw = </span>
              <b className="text-amber-300">{olyExRaw}</b>
              <span className="text-white/40 text-xs"> · net = </span>
              <b className={olyExNet > 0 ? "text-fairway-500" : olyExNet < 0 ? "text-red-400" : "text-white/40"}>{fmt(olyExNet)} pt</b>
              <span className="text-white/40 text-xs"> · money = </span>
              <b className={olyExMoney > 0 ? "text-fairway-500" : olyExMoney < 0 ? "text-red-400" : "text-white/40"}>{fmtMoney(olyExMoney)}</b>
            </div>
          </div>
        </ExplainSection>
      </div>

      {/* Other players nav */}
      <div className="card p-3">
        <div className="text-white/60 text-xs mb-2">Other players</div>
        <div className="flex flex-wrap gap-2">
          {players.filter(p => p.id !== me.id).map(p => (
            <Link key={p.id}
              href={`/round/${code}/player/${p.id}${adminToken ? `?admin=${adminToken}` : ""}`}
              className="btn-ghost text-xs py-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
              {p.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function MoneyCard({ icon, color, label, value, sub }: { icon: React.ReactNode; color: string; label: string; value: string; sub?: string }) {
  return (
    <div className="card p-3">
      <div className={`flex items-center gap-1.5 text-xs font-semibold ${color}`}>{icon}{label}</div>
      <div className={`text-lg font-bold tabular-nums mt-0.5 ${value.startsWith("+") ? "text-fairway-500" : value.startsWith("-") ? "text-red-400" : "text-white"}`}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-white/40 mt-0.5">{sub}</div>}
    </div>
  );
}

function ExplainSection({
  icon, color, title, formula, help, children
}: {
  icon: React.ReactNode; color: string; title: string;
  formula: string; help?: string; children: React.ReactNode
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-1.5 mb-2">
        <span className={color}>{icon}</span>
        <h3 className={`font-semibold ${color}`}>{title}</h3>
        {help && (
          <Link href={help} className="ml-auto text-white/40 hover:text-white/80" title="More detail">
            <HelpCircle className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
      <p className="text-white/50 text-xs leading-relaxed mb-2">{formula}</p>
      {children}
    </div>
  );
}

function scoreTerm(strokes: number, par: number) {
  const d = strokes - par;
  if (d <= -1) return { chip: "bg-red-600 text-white" };
  if (d >= 1)  return { chip: "bg-blue-900 text-white" };
  return { chip: "border border-white/30 text-white" };
}
