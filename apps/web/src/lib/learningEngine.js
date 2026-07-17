// AI learning engine — analyses completed trades to surface winning/losing
// patterns, best/worst coins, hours and days, and generates actionable
// strategy recommendations. Pure functions over the closedTrades array.

const DAY_NAMES = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

function agg(trades, keyFn) {
  const map = {};
  for (const t of trades) {
    const k = keyFn(t);
    if (k == null) continue;
    if (!map[k]) map[k] = { key: k, trades: 0, wins: 0, pnl: 0 };
    map[k].trades += 1;
    map[k].wins += t.win ? 1 : 0;
    map[k].pnl += t.pnl || 0;
  }
  return Object.values(map).map((r) => ({
    ...r,
    winRate: r.trades ? Math.round((r.wins / r.trades) * 100) : 0,
  }));
}

function bestWorst(rows, min = 1) {
  const valid = rows.filter((r) => r.trades >= min);
  if (!valid.length) return { best: null, worst: null };
  const byPnl = [...valid].sort((a, b) => b.pnl - a.pnl);
  return { best: byPnl[0], worst: byPnl[byPnl.length - 1], all: byPnl };
}

export function analyzeTrades(closedTrades, periodDays = null) {
  const now = Date.now();
  const trades = periodDays
    ? closedTrades.filter((t) => now - (t.closedAt || 0) < periodDays * 864e5)
    : closedTrades;

  const wins = trades.filter((t) => t.win);
  const losses = trades.filter((t) => !t.win);
  const totalPnl = trades.reduce((a, t) => a + (t.pnl || 0), 0);

  const coins = agg(trades, (t) => t.symbol);
  const hours = agg(trades, (t) => (t.closedAt ? new Date(t.closedAt).getHours() : null));
  const days = agg(trades, (t) => (t.closedAt ? new Date(t.closedAt).getDay() : null));
  const sides = agg(trades, (t) => t.side);

  const coinRank = bestWorst(coins);
  const hourRank = bestWorst(hours);
  const dayRank = bestWorst(days);

  // Winning/losing pattern: avg confidence and RR.
  const avg = (arr, f) => (arr.length ? arr.reduce((a, x) => a + (f(x) || 0), 0) / arr.length : 0);
  const patterns = {
    winAvgConfidence: Math.round(avg(wins, (t) => t.confidence)),
    lossAvgConfidence: Math.round(avg(losses, (t) => t.confidence)),
    winAvgRr: +avg(wins, (t) => parseFloat(t.rr) || 0).toFixed(2),
    lossAvgRr: +avg(losses, (t) => parseFloat(t.rr) || 0).toFixed(2),
    bestSide: sides.length ? [...sides].sort((a, b) => b.pnl - a.pnl)[0] : null,
  };

  return {
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: trades.length ? Math.round((wins.length / trades.length) * 100) : 0,
    totalPnl,
    coins, hours, days, sides,
    coinRank, hourRank, dayRank,
    patterns,
    dayNames: DAY_NAMES,
  };
}

export function buildRecommendations(analysis) {
  const recs = [];
  const a = analysis;
  if (!a || a.totalTrades < 3) {
    recs.push({
      title: 'Daha fazla veri gerekiyor',
      category: 'genel',
      detail: 'Anlamlı öneriler üretmek için en az birkaç kapalı işlem gerekli. Bot çalıştıkça öneriler otomatik güncellenecek.',
      severity: 'info',
    });
    return recs;
  }

  if (a.winRate < 45) {
    recs.push({
      title: 'Güven eşiğini yükseltin',
      category: 'confidence',
      detail: `Kazanma oranınız %${a.winRate}. Kazanan işlemlerin ortalama güveni %${a.patterns.winAvgConfidence}, kaybedenlerin %${a.patterns.lossAvgConfidence}. Minimum güven eşiğini yükselterek düşük kaliteli sinyalleri eleyin.`,
      severity: 'warning',
    });
  }

  if (a.coinRank.worst && a.coinRank.worst.pnl < 0) {
    recs.push({
      title: `${a.coinRank.worst.key} coinini filtreleyin`,
      category: 'coin',
      detail: `${a.coinRank.worst.key} üzerinde ${a.coinRank.worst.trades} işlemde net ${a.coinRank.worst.pnl.toFixed(2)} USDT (kazanma %${a.coinRank.worst.winRate}). Bu coini strateji filtresinden çıkarmayı değerlendirin.`,
      severity: 'warning',
    });
  }
  if (a.coinRank.best && a.coinRank.best.pnl > 0) {
    recs.push({
      title: `${a.coinRank.best.key} en iyi performans`,
      category: 'coin',
      detail: `${a.coinRank.best.key} en kârlı coininiz: ${a.coinRank.best.pnl.toFixed(2)} USDT, kazanma %${a.coinRank.best.winRate}. Bu tür coinlere ağırlık verin.`,
      severity: 'info',
    });
  }

  if (a.hourRank.worst && a.hourRank.worst.pnl < 0) {
    recs.push({
      title: `${a.hourRank.worst.key}:00 saatinden kaçının`,
      category: 'time',
      detail: `${a.hourRank.worst.key}:00 saatinde açılan işlemler zararda (${a.hourRank.worst.pnl.toFixed(2)} USDT). Bu saat aralığında işlem açmayı sınırlayın.`,
      severity: 'warning',
    });
  }
  if (a.hourRank.best) {
    recs.push({
      title: `En verimli saat: ${a.hourRank.best.key}:00`,
      category: 'time',
      detail: `${a.hourRank.best.key}:00 saatinde kazanma oranı %${a.hourRank.best.winRate}. Bu zaman diliminde daha aktif olun.`,
      severity: 'info',
    });
  }

  if (a.patterns.bestSide) {
    recs.push({
      title: `${a.patterns.bestSide.key} yönü daha kârlı`,
      category: 'strategy',
      detail: `${a.patterns.bestSide.key} pozisyonlarda net ${a.patterns.bestSide.pnl.toFixed(2)} USDT (kazanma %${a.patterns.bestSide.winRate}). Piyasa yönüne göre bu tarafa ağırlık verin.`,
      severity: 'info',
    });
  }

  if (a.patterns.lossAvgRr > a.patterns.winAvgRr && a.patterns.winAvgRr > 0) {
    recs.push({
      title: 'Risk/Ödül oranını gözden geçirin',
      category: 'risk',
      detail: `Kaybeden işlemlerin ortalama RR'ı (${a.patterns.lossAvgRr}) kazananlardan (${a.patterns.winAvgRr}) yüksek — çok geniş TP hedefleri işlemleri zarara çeviriyor olabilir. TP/SL oranını sıkılaştırın.`,
      severity: 'warning',
    });
  }

  if (a.winRate >= 60 && a.totalPnl > 0) {
    recs.push({
      title: 'Strateji sağlıklı çalışıyor',
      category: 'genel',
      detail: `Kazanma oranı %${a.winRate}, toplam kâr ${a.totalPnl.toFixed(2)} USDT. Mevcut ayarları koruyun; kaldıraç veya risk yüzdesini kademeli artırmayı değerlendirebilirsiniz.`,
      severity: 'info',
    });
  }

  return recs;
}
