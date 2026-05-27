"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRound } from "@/lib/useRound";
import { calcTeamPlay } from "@/lib/teamPlay";
import { mergedSettings } from "@/lib/defaults";
import { ChevronLeft, Users, Trophy, Flag, Crown } from "lucide-react";

export default function TeamPlayDashboard({ params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  const search = useSearchParams();
  const adminToken = search.get("admin") || "";
  const { round, players, holes, scores, loading, err } = useRound(code);

  const settings = useMemo(() => round ? mergedSettings(round.settings) : null, [round]);
  const tp = settings?.teamPlay;
  const stake = Number(round?.team_play_stake ?? 100);

  const totals = useMemo(() => {
    if (!round || !tp) return null;
    return calcTeamPlay(players, holes, scores, tp, stake);
  }, [round, players, holes, scores, tp, stake]);

  if (loading) return <div className="text-white/60 text-center py-20">Loading…</div>;
  if (err || !round) return <div className="text-red-400 text-center py-20">{err || "Not found"}</div>;
  if ((round.team_play_enabled ?? 0) !== 1) {
    return (
      <div className="card p-6 text-center space-y-3">
        <Users className="w-10 h-10 mx-auto text-white/30" />
        <h2 className="text-white font-bold text-lg">Team Play is disabled for this round</h2>
        <p className="text-white/60 text-sm">Open the round admin and check "Enable Team Play" to start.</p>
        <Link href={`/round/${code}/admin?admin=${adminToken}`} className="btn-primary inline-flex">
          <Crown className="w-4 h-4" /> Go to Admin
        </Link>
      </div>
    );
  }

  const teamA = players.filter(p => p.team === "A");
  const teamB = players.filter(p => p.team === "B");
  const unassigned = players.filter(p => !p.team);
  const sortedHoles = [...holes].sort((a, b) => a.number - b.number);
  const moneyA = totals?.teamMoneyTotal.A ?? 0;
  const moneyB = totals?.teamMoneyTotal.B ?? 0;
  const ptsA = totals?.teamPointsTotal.A ?? 0;
  const ptsB = totals?.teamPointsTotal.B ?? 0;
  const dashboardHref = `/round/${code}${adminToken ? `?admin=${adminToken}` : ""}`;
  const fmt = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(0)}`;
  const fmtPts = (n: number) => `${n > 0 ? "+" : ""}${n}`;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Link href={dashboardHref} className="btn-ghost">
          <ChevronLeft className="w-4 h-4" /> Round dashboard
        </Link>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Users className="w-6 h-6 text-fairway-500" /> Team Play — {round.name}
        </h1>
      </div>

      {/* Team summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <TeamCard
          name={tp!.teamAName} color={tp!.teamAColor}
          members={teamA} points={ptsA} money={moneyA}
          stake={stake} currency={round.currency} />
        <TeamCard
          name={tp!.teamBName} color={tp!.teamBColor}
          members={teamB} points={ptsB} money={moneyB}
          stake={stake} currency={round.currency} />
      </div>

      {unassigned.length > 0 && (
        <div className="card p-3 bg-amber-500/10 border border-amber-500/30">
          <div className="text-amber-300 text-sm">
            ⚠️ Unassigned: {unassigned.map(p => p.name).join(", ")} — these players don't participate in Team Play.
            <Link href={`/round/${code}/admin?admin=${adminToken}`} className="ml-2 underline">Assign teams</Link>
          </div>
        </div>
      )}

      {/* Hole-by-hole */}
      <div className="card p-3 overflow-x-auto">
        <h2 className="text-white/80 font-semibold mb-2 px-1">Hole-by-hole · best-of-team</h2>
        <table className="w-full text-sm min-w-[640px]">
          <thead className="text-white/40 text-xs">
            <tr className="border-b border-white/10">
              <th className="text-left py-1.5 px-2">Hole</th>
              <th className="text-center py-1.5 px-2">Par</th>
              <th className="text-center py-1.5 px-2" style={{ color: tp!.teamAColor }}>{tp!.teamAName} best</th>
              <th className="text-center py-1.5 px-2" style={{ color: tp!.teamBColor }}>{tp!.teamBName} best</th>
              <th className="text-center py-1.5 px-2">Winner</th>
              <th className="text-right py-1.5 px-2" style={{ color: tp!.teamAColor }}>{tp!.teamAName} pts</th>
              <th className="text-right py-1.5 px-2" style={{ color: tp!.teamBColor }}>{tp!.teamBName} pts</th>
            </tr>
          </thead>
          <tbody>
            {sortedHoles.map(h => {
              const ph = totals?.perHole.find(x => x.holeId === h.id);
              return (
                <tr key={h.id} className="border-b border-white/5">
                  <td className="py-1.5 px-2 text-white font-mono">{h.number}</td>
                  <td className="py-1.5 px-2 text-center text-white/50">{h.par}</td>
                  <td className="py-1.5 px-2 text-center text-white">{ph?.bestA ?? "—"}</td>
                  <td className="py-1.5 px-2 text-center text-white">{ph?.bestB ?? "—"}</td>
                  <td className="py-1.5 px-2 text-center">
                    {ph?.winner === "A" && <WinnerChip color={tp!.teamAColor} label={tp!.teamAName} kind={ph.kind} />}
                    {ph?.winner === "B" && <WinnerChip color={tp!.teamBColor} label={tp!.teamBName} kind={ph.kind} />}
                    {ph?.winner === "tie" && <span className="text-white/40 text-xs">tie</span>}
                    {ph?.winner === "incomplete" && <span className="text-white/30 text-xs">—</span>}
                  </td>
                  <td className={`py-1.5 px-2 text-right tabular-nums font-bold ${(ph?.teamPoints.A ?? 0) > 0 ? "text-fairway-500" : (ph?.teamPoints.A ?? 0) < 0 ? "text-red-400" : "text-white/30"}`}>
                    {(ph?.teamPoints.A ?? 0) !== 0 ? fmtPts(ph!.teamPoints.A) : "—"}
                  </td>
                  <td className={`py-1.5 px-2 text-right tabular-nums font-bold ${(ph?.teamPoints.B ?? 0) > 0 ? "text-fairway-500" : (ph?.teamPoints.B ?? 0) < 0 ? "text-red-400" : "text-white/30"}`}>
                    {(ph?.teamPoints.B ?? 0) !== 0 ? fmtPts(ph!.teamPoints.B) : "—"}
                  </td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-white/10 font-bold">
              <td className="py-2 px-2 text-white" colSpan={4}>Totals</td>
              <td className="py-2 px-2 text-center text-white/60 text-xs">
                A {totals?.holesWonByA ?? 0} · B {totals?.holesWonByB ?? 0} · tied {totals?.holesTied ?? 0}
              </td>
              <td className={`py-2 px-2 text-right tabular-nums ${ptsA > 0 ? "text-fairway-500" : ptsA < 0 ? "text-red-400" : "text-white/60"}`}>{fmtPts(ptsA)}</td>
              <td className={`py-2 px-2 text-right tabular-nums ${ptsB > 0 ? "text-fairway-500" : ptsB < 0 ? "text-red-400" : "text-white/60"}`}>{fmtPts(ptsB)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Settlement */}
      <div className="card p-4">
        <h2 className="text-white/80 font-semibold mb-3">Settlement</h2>
        <div className="space-y-2">
          {players.map(p => {
            if (!p.team) return null;
            const money = totals?.playerMoney[p.id] ?? 0;
            const teamName = p.team === "A" ? tp!.teamAName : tp!.teamBName;
            const teamColor = p.team === "A" ? tp!.teamAColor : tp!.teamBColor;
            return (
              <div key={p.id} className="flex items-center justify-between py-1 border-b border-white/5 last:border-b-0">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: p.color }} />
                  <span className="text-white">{p.name}</span>
                  <span className="chip text-[10px]" style={{ background: `${teamColor}33`, color: teamColor, border: `1px solid ${teamColor}66` }}>
                    {teamName}
                  </span>
                </div>
                <span className={`font-bold tabular-nums ${money > 0 ? "text-fairway-500" : money < 0 ? "text-red-400" : "text-white/40"}`}>
                  {fmt(money)} {round.currency}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-white/40 text-xs mt-3 leading-relaxed">
          Each team's money = team points × {stake} {round.currency}. Split equally among that team's members.
          Hole counts: <b className="text-white/70">{totals?.countByKind.par ?? 0}</b> won by par,{" "}
          <b className="text-white/70">{totals?.countByKind.birdie ?? 0}</b> by birdie,{" "}
          <b className="text-white/70">{totals?.countByKind.eagle ?? 0}</b> by eagle-or-better.
        </p>
      </div>
    </div>
  );
}

function TeamCard({
  name, color, members, points, money, stake, currency
}: { name: string; color: string; members: any[]; points: number; money: number; stake: number; currency: string }) {
  return (
    <div className="card p-4 relative overflow-hidden" style={{ borderLeft: `4px solid ${color}` }}>
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-white font-bold text-lg" style={{ color }}>{name}</h2>
        <span className="text-white/40 text-xs">{members.length} {members.length === 1 ? "player" : "players"}</span>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {members.length === 0 && <span className="text-white/30 text-xs">no players assigned</span>}
        {members.map(p => (
          <span key={p.id} className="chip bg-white/5 border border-white/10 text-white/80">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} /> {p.name}
          </span>
        ))}
      </div>
      <div className="flex items-baseline justify-between border-t border-white/10 pt-2">
        <div>
          <div className="text-white/40 text-xs">Points</div>
          <div className={`text-2xl font-bold tabular-nums ${points > 0 ? "text-fairway-500" : points < 0 ? "text-red-400" : "text-white/60"}`}>
            {points > 0 ? "+" : ""}{points}
          </div>
        </div>
        <div className="text-right">
          <div className="text-white/40 text-xs">Money ({stake}/pt)</div>
          <div className={`text-2xl font-bold tabular-nums ${money > 0 ? "text-fairway-500" : money < 0 ? "text-red-400" : "text-white/60"}`}>
            {money > 0 ? "+" : ""}{money.toFixed(0)} {currency}
          </div>
        </div>
      </div>
    </div>
  );
}

function WinnerChip({ color, label, kind }: { color: string; label: string; kind: string }) {
  const kindBg =
    kind === "eagle"  ? "bg-violet-500/30 text-violet-200" :
    kind === "birdie" ? "bg-cyan-500/30 text-cyan-200"     :
                        "bg-white/10 text-white/70";
  return (
    <span className="inline-flex items-center gap-1">
      <span className="chip text-[10px]" style={{ background: `${color}33`, color, border: `1px solid ${color}66` }}>
        {label}
      </span>
      <span className={`chip text-[10px] ${kindBg}`}>{kind}</span>
    </span>
  );
}
