import { useCallback, useEffect, useMemo, useState } from 'react';
import pb from '@/lib/pocketbaseClient';
import { analyzeTrades, buildRecommendations } from '@/lib/learningEngine';

// Derives learning insights from closed trades and persists AI recommendations
// (with a followed / feedback flag) to PocketBase for the feedback loop.
export function useLearning(closedTrades) {
  const [period, setPeriod] = useState(30); // 7 | 30 | 90 | null(all)
  const [recFeedback, setRecFeedback] = useState([]);

  const analysis = useMemo(() => analyzeTrades(closedTrades || [], period), [closedTrades, period]);
  const analysisAll = useMemo(() => analyzeTrades(closedTrades || [], null), [closedTrades]);

  const trends = useMemo(() => ({
    d7: analyzeTrades(closedTrades || [], 7),
    d30: analyzeTrades(closedTrades || [], 30),
    d90: analyzeTrades(closedTrades || [], 90),
  }), [closedTrades]);

  const recommendations = useMemo(() => buildRecommendations(analysisAll), [analysisAll]);

  const reloadFeedback = useCallback(async () => {
    try {
      const items = await pb.collection('ai_recommendations').getFullList({ sort: '-created' });
      setRecFeedback(items);
    } catch { /* offline */ }
  }, []);

  useEffect(() => { reloadFeedback(); }, [reloadFeedback]);

  // Persist the current recommendation set (feedback loop tracking).
  const saveRecommendations = useCallback(async () => {
    let n = 0;
    for (const r of recommendations) {
      try {
        await pb.collection('ai_recommendations').create(
          { title: r.title, category: r.category, detail: r.detail, severity: r.severity, followed: false, meta: {} },
          { requestKey: `rec-${n++}` },
        );
      } catch { /* ignore */ }
    }
    await reloadFeedback();
  }, [recommendations, reloadFeedback]);

  const toggleFollowed = useCallback(async (rec) => {
    try {
      await pb.collection('ai_recommendations').update(rec.id, { followed: !rec.followed });
      setRecFeedback((prev) => prev.map((r) => (r.id === rec.id ? { ...r, followed: !r.followed } : r)));
    } catch { /* ignore */ }
  }, []);

  const clearFeedback = useCallback(async () => {
    for (const r of recFeedback) {
      try { await pb.collection('ai_recommendations').delete(r.id); } catch { /* ignore */ }
    }
    setRecFeedback([]);
  }, [recFeedback]);

  const saveInsight = useCallback(async () => {
    try {
      await pb.collection('learning_insights').create({
        period: period ? `${period}d` : 'all',
        data: { winRate: analysis.winRate, totalPnl: analysis.totalPnl, totalTrades: analysis.totalTrades, coinRank: analysis.coinRank },
      });
    } catch { /* ignore */ }
  }, [analysis, period]);

  return {
    period, setPeriod,
    analysis, analysisAll, trends,
    recommendations, recFeedback,
    saveRecommendations, toggleFollowed, clearFeedback, saveInsight, reloadFeedback,
  };
}
