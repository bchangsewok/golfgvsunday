import { useEffect, useState, useCallback } from "react";
import { api } from "./api";
import type { Round, Player, Hole, Score } from "./types";

export type RoundData = {
  round: Round | null;
  players: Player[];
  holes: Hole[];
  scores: Score[];
};

// Loads round data + scores. Re-fetches on refresh().
// SSE realtime is deferred to Sprint 4 (works natively but needs polyfill on web).
export function useRound(code: string) {
  const [data, setData] = useState<RoundData>({ round: null, players: [], holes: [], scores: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fresh = await api.getRound(code);
      setData(fresh);
    } catch (e: any) {
      setError(e?.message || "Couldn't load round");
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => { refresh(); }, [refresh]);

  // Optimistic update of a single score
  function setScore(newOrUpdated: Score) {
    setData(d => {
      const i = d.scores.findIndex(s => s.hole_id === newOrUpdated.hole_id && s.player_id === newOrUpdated.player_id);
      const next = [...d.scores];
      if (i >= 0) next[i] = { ...next[i], ...newOrUpdated };
      else        next.push(newOrUpdated);
      return { ...d, scores: next };
    });
  }

  // Optimistic update of a single hole (used for multiplier edits)
  function setHole(updated: Hole) {
    setData(d => ({ ...d, holes: d.holes.map(h => h.id === updated.id ? { ...h, ...updated } : h) }));
  }

  return { ...data, loading, error, refresh, setScore, setHole };
}
