"use client";
import { useRouter } from "next/navigation";
import { ChevronLeft, Trophy, Info, Calculator, ArrowRight } from "lucide-react";

// Help page uses a 5-player example throughout (matches the active round MDXB4W).
const K = 5;

export default function OlympicExtraHelp() {
  const router = useRouter();
  return (
    <div className="space-y-6 max-w-4xl">
      <button onClick={() => router.back()} className="btn-ghost text-sm">
        <ChevronLeft className="w-4 h-4" /> Back
      </button>

      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-white flex items-center gap-2">
          <Trophy className="w-7 h-7 text-amber-300" /> Olympic Extra
        </h1>
        <p className="text-white/70">
          A side-bet derived from the same Olympic <code>🏆</code> values players already typed.
          Rewards either a <b className="text-white">single strong repeat</b> of one value
          or a <b className="text-white">complete distinct set</b> from 1 to N (the number of players).
          Examples below assume a {K}-player round.
        </p>
      </header>

      {/* The rule */}
      <section className="card p-4 space-y-3">
        <h2 className="text-white/80 font-semibold flex items-center gap-2">
          <Calculator className="w-4 h-4 text-amber-300" /> The rule (per player)
        </h2>
        <div className="bg-black/30 rounded-lg p-3 space-y-3 text-sm">
          <div>
            <div className="text-amber-300 font-semibold">A · Best single-value bundle</div>
            <div className="ml-3 text-white/80 mt-1">
              For each Olympic value <code className="text-white">V</code> in 1..N that the player
              got <code className="text-white">count[V]</code> times:
              <div className="font-mono text-xs mt-1 ml-2 text-fairway-500">
                bundle[V] = V × floor(count[V] / N) × N
              </div>
              Take the <b className="text-amber-300">MAX</b> across all values — only the player's strongest
              repeat counts (not the sum):
              <div className="font-mono text-xs mt-1 ml-2 text-fairway-500">
                bestBundle = max(bundle[1], bundle[2], …, bundle[N])
              </div>
            </div>
          </div>
          <div>
            <div className="text-amber-300 font-semibold">B · Full distinct set bonus</div>
            <div className="ml-3 text-white/80 mt-1">
              If the player has at least one of <i>every</i> value 1..N, add a flat bonus:
              <div className="font-mono text-xs mt-1 ml-2 text-fairway-500">
                fullSetBonus = 1 + 2 + … + N
              </div>
              The full-set bonus stacks on top of the best bundle.
            </div>
          </div>
          <div>
            <div className="text-amber-300 font-semibold">Total raw</div>
            <div className="font-mono text-xs mt-1 ml-3 text-white">
              raw[P] = bestBundle + fullSetBonus
            </div>
          </div>
          <div className="border-t border-white/10 pt-2">
            <div className="text-amber-300 font-semibold">Settlement (zero-sum)</div>
            <div className="font-mono text-xs mt-1 ml-3 text-white">
              net[P]   = raw[P] × N − Σ all raws
              <br />money[P] = net[P] × olympic_stake
            </div>
          </div>
        </div>
        <p className="text-white/40 text-xs leading-relaxed">
          <b>Inputs not used:</b> Olympic Special (✨), strokes, Dog Flight, SAO, hole multipliers.
          Olympic value <code>0</code> and any value above N are ignored. The bundle size scales with
          the number of players — for a {K}-player round, K = {K}.
        </p>
      </section>

      {/* Worked examples from the real round */}
      <section className="card p-4 space-y-4">
        <h2 className="text-white/80 font-semibold">Worked examples · {K}-player round (real data, K = {K})</h2>

        <Example
          title="Daf · counts {1:4, 2:6, 4:2}"
          steps={[
            `V=1, count=4 → 1 × floor(4/${K}) × ${K} = 0`,
            `V=2, count=6 → 2 × floor(6/${K}) × ${K} = 10`,
            `V=4, count=2 → 4 × floor(2/${K}) × ${K} = 0`,
            "bestBundle = max(0, 10, 0) = 10",
            `Full set 1..${K}? Missing values 3 and ${K} → no bonus`,
            "raw = 10 + 0 = 10"
          ]}
          raw={10} />

        <Example
          title="R · counts {1:2, 3:5}"
          steps={[
            `V=1, count=2 → 1 × floor(2/${K}) × ${K} = 0`,
            `V=3, count=5 → 3 × floor(5/${K}) × ${K} = 15`,
            "bestBundle = max(0, 15) = 15",
            `Full set? Missing many values → no bonus`,
            "raw = 15 + 0 = 15"
          ]}
          raw={15} />

        <Example
          title="POP · counts {1:3, 2:1, 3:1, 4:2}"
          steps={[
            `Every per-value bundle: floor(count/${K}) = 0 → all = 0`,
            "bestBundle = 0",
            `Full set 1..${K}? Missing value ${K} → no bonus`,
            "raw = 0 + 0 = 0"
          ]}
          raw={0} />

        <Example
          title="Champ · counts {1:3, 2:3}"
          steps={[
            `Both counts < ${K} → no bundle fires`,
            "Full set? Missing several values → no bonus",
            "raw = 0"
          ]}
          raw={0} />

        <Example
          title="Nong · counts {1:2, 2:1, 3:2}"
          steps={[
            `All counts < ${K} → no bundle fires`,
            "Full set? Missing several values → no bonus",
            "raw = 0"
          ]}
          raw={0} />
      </section>

      {/* Settlement table */}
      <section className="card p-4 space-y-3">
        <h2 className="text-white/80 font-semibold">Zero-sum settlement (N = {K}, stake = 10 THB/pt)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-white/40 text-xs">
              <tr className="border-b border-white/10">
                <th className="text-left py-1.5 px-2">Player</th>
                <th className="text-right py-1.5 px-2 text-amber-300">raw</th>
                <th className="text-left  py-1.5 px-2">Net calc</th>
                <th className="text-right py-1.5 px-2 text-amber-300">net</th>
                <th className="text-right py-1.5 px-2">money</th>
              </tr>
            </thead>
            <tbody className="text-white/80">
              <SettlementRow name="R"     raw={15} totalRaw={25} N={5} stake={10} color="#0ea5e9" />
              <SettlementRow name="Daf"   raw={10} totalRaw={25} N={5} stake={10} color="#16a34a" />
              <SettlementRow name="POP"   raw={0}  totalRaw={25} N={5} stake={10} color="#dc2626" />
              <SettlementRow name="Champ" raw={0}  totalRaw={25} N={5} stake={10} color="#f59e0b" />
              <SettlementRow name="Nong"  raw={0}  totalRaw={25} N={5} stake={10} color="#a855f7" />
              <tr className="border-t border-white/10 font-semibold">
                <td className="py-1.5 px-2 text-white/60">Σ check</td>
                <td className="text-right py-1.5 px-2 text-white">25</td>
                <td></td>
                <td className="text-right py-1.5 px-2 text-fairway-500">0 ✓</td>
                <td className="text-right py-1.5 px-2 text-fairway-500">0 THB ✓</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-white/50 text-xs leading-relaxed">
          Only R and Daf have bundles that fire (their value-3 and value-2 reach the 5-count threshold).
          POP has no bundle and is missing value 5, so no full-set bonus — she earns 0 raw.
        </p>
      </section>

      {/* Edge cases */}
      <section className="card p-4 space-y-2">
        <h2 className="text-white/80 font-semibold flex items-center gap-2">
          <Info className="w-4 h-4 text-fairway-500" /> Edge cases & FAQ
        </h2>
        <ul className="text-white/70 text-sm space-y-1.5 list-disc list-inside">
          <li><b>Why MAX and not sum of bundles?</b> House rule — only the player's strongest repeat counts toward Olympic Extra.</li>
          <li><b>Bundle threshold scales with players.</b> For 4 players, a bundle needs 4 occurrences of the same value. For 5 players, you need 5 to form a bundle.</li>
          <li><b>Multi-bundle of the same value</b> (e.g. value 2 × 10 in a 5-player round): bundle = 2 × floor(10/5) × 5 = 20. The MAX still considers this single value's full bundle stack.</li>
          <li><b>Full set + bundle</b>: both can fire. A player who has every value 1..N with one value reaching the bundle threshold gets both bonuses.</li>
          <li><b>Olympic value 0 entries</b>: ignored. Don't contribute to bundles or full set.</li>
          <li><b>Olympic Special (✨)</b> is excluded — only 🏆 input feeds Olympic Extra.</li>
          <li><b>Hole multiplier</b> is not applied to Olympic Extra points.</li>
        </ul>
      </section>

      <section className="text-center text-white/40 text-xs">
        Back to <button onClick={() => router.back()} className="text-fairway-500 hover:underline inline-flex items-center gap-1">round dashboard <ArrowRight className="w-3 h-3" /></button>
      </section>
    </div>
  );
}

function Example({ title, steps, raw }: { title: string; steps: string[]; raw: number }) {
  return (
    <div className="bg-white/5 rounded-lg p-3 border border-white/10">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-sand-500 font-semibold text-sm">{title}</h3>
        <span className="chip bg-amber-500/20 text-amber-300 border border-amber-500/30">
          raw = {raw}
        </span>
      </div>
      <ol className="text-white/70 text-xs space-y-0.5 list-decimal list-inside font-mono">
        {steps.map((s, i) => <li key={i}>{s}</li>)}
      </ol>
    </div>
  );
}

function SettlementRow({ name, raw, totalRaw, N, stake, color }:
  { name: string; raw: number; totalRaw: number; N: number; stake: number; color: string }) {
  const net = raw * N - totalRaw;
  const money = net * stake;
  const c = money > 0 ? "text-fairway-500" : money < 0 ? "text-red-400" : "text-white/40";
  return (
    <tr className="border-b border-white/5">
      <td className="py-1.5 px-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: color }} />
          {name}
        </span>
      </td>
      <td className="text-right py-1.5 px-2 text-amber-300 tabular-nums">{raw}</td>
      <td className="py-1.5 px-2 text-white/60 font-mono text-xs">{raw} × {N} − {totalRaw}</td>
      <td className={`text-right py-1.5 px-2 tabular-nums font-bold ${net > 0 ? "text-fairway-500" : net < 0 ? "text-red-400" : "text-white/40"}`}>
        {net > 0 ? "+" : ""}{net}
      </td>
      <td className={`text-right py-1.5 px-2 tabular-nums font-bold ${c}`}>
        {money > 0 ? "+" : ""}{money}
      </td>
    </tr>
  );
}
