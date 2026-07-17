import { useCallback, useEffect, useMemo, useState } from 'react';
import pb from '@/lib/pocketbaseClient';
import { DEXES, LENDERS, chainByKey } from '@/lib/web3/config';

// Reference USD prices for common tokens (indicative, used for quote math).
export const TOKEN_PRICES = {
  ETH: 3120, WETH: 3120, BTC: 64200, WBTC: 64200, SOL: 148, BNB: 592,
  MATIC: 0.72, AVAX: 36, ARB: 1.1, OP: 2.4, USDC: 1, USDT: 1, DAI: 1,
  LINK: 17.4, UNI: 11.2, AAVE: 96, CRV: 0.42, CAKE: 2.6, CHZ: 0.11,
};

export const TOKENS_BY_CHAIN = {
  ethereum: ['ETH', 'USDC', 'USDT', 'DAI', 'WBTC', 'LINK', 'UNI', 'AAVE'],
  polygon: ['MATIC', 'USDC', 'USDT', 'DAI', 'WETH', 'WBTC', 'LINK'],
  bnb: ['BNB', 'USDT', 'USDC', 'CAKE', 'ETH', 'BTC'],
  arbitrum: ['ETH', 'USDC', 'USDT', 'ARB', 'WBTC', 'LINK'],
  avalanche: ['AVAX', 'USDC', 'USDT', 'WETH', 'WBTC'],
  base: ['ETH', 'USDC', 'DAI', 'WBTC'],
  solana: ['SOL', 'USDC', 'USDT'],
  chiliz: ['CHZ', 'USDT'],
};

const priceOf = (sym) => TOKEN_PRICES[(sym || '').toUpperCase()] || 1;

export function useDeFi(chainKey = 'ethereum', walletAddress = null) {
  const [transactions, setTransactions] = useState([]);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [txs, pos] = await Promise.all([
        pb.collection('defi_transactions').getFullList({ sort: '-created', requestKey: 'defi-tx' }),
        pb.collection('defi_positions').getFullList({ sort: '-created', requestKey: 'defi-pos' }),
      ]);
      setTransactions(txs);
      setPositions(pos);
    } catch (e) { setError(e?.message || 'Veri yüklenemedi'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const recordTx = useCallback(async (data) => {
    const txId = `${data.kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const rec = await pb.collection('defi_transactions').create({
      txId, walletAddress: walletAddress || '', chainKey, status: 'confirmed', ...data,
    }, { requestKey: txId });
    setTransactions((p) => [rec, ...p]);
    return rec;
  }, [chainKey, walletAddress]);

  // Quote for a swap: applies a protocol fee + slippage tolerance.
  const getQuote = useCallback((fromToken, toToken, amount, slippage = 0.5, fee = 0.3) => {
    const amt = Number(amount) || 0;
    const valueUsd = amt * priceOf(fromToken);
    const gross = valueUsd / priceOf(toToken);
    const afterFee = gross * (1 - fee / 100);
    const minReceived = afterFee * (1 - slippage / 100);
    const priceImpact = Math.min(4.8, (amt > 0 ? Math.log10(1 + valueUsd / 25000) : 0) * 1.4);
    return {
      toAmount: afterFee, minReceived, valueUsd,
      rate: priceOf(fromToken) / priceOf(toToken),
      fee, slippage, priceImpact: Number(priceImpact.toFixed(2)),
      gasUsd: chainKey === 'ethereum' ? 6.4 : chainKey === 'solana' ? 0.002 : 0.12,
    };
  }, [chainKey]);

  const swap = useCallback(async ({ protocol, fromToken, toToken, fromAmount, quote }) => {
    setError('');
    try {
      return await recordTx({
        kind: 'swap', protocol, fromToken, toToken,
        fromAmount: Number(fromAmount), toAmount: Number(quote.toAmount),
        valueUsd: Number(quote.valueUsd), gasUsd: Number(quote.gasUsd),
        meta: { priceImpact: quote.priceImpact, minReceived: quote.minReceived, slippage: quote.slippage },
      });
    } catch (e) { setError(e?.message || 'Swap başarısız'); throw e; }
  }, [recordTx]);

  const addLiquidity = useCallback(async ({ protocol, pair, amountUsd, apy }) => {
    const positionId = `lp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const rec = await pb.collection('defi_positions').create({
      positionId, walletAddress: walletAddress || '', chainKey, protocol, kind: 'liquidity',
      pair, amountUsd: Number(amountUsd), apy: Number(apy), rewardsUsd: 0, active: true,
      meta: {},
    }, { requestKey: positionId });
    await recordTx({ kind: 'addLiquidity', protocol, valueUsd: Number(amountUsd), gasUsd: 3.2, meta: { pair } });
    setPositions((p) => [rec, ...p]);
    return rec;
  }, [chainKey, walletAddress, recordTx]);

  const removeLiquidity = useCallback(async (position) => {
    await pb.collection('defi_positions').update(position.id, { active: false });
    await recordTx({ kind: 'removeLiquidity', protocol: position.protocol, valueUsd: position.amountUsd, gasUsd: 3.0, meta: { pair: position.pair } });
    setPositions((p) => p.map((x) => (x.id === position.id ? { ...x, active: false } : x)));
  }, [recordTx]);

  const stake = useCallback(async ({ protocol, pair, amountUsd, apy }) => {
    const positionId = `farm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const rec = await pb.collection('defi_positions').create({
      positionId, walletAddress: walletAddress || '', chainKey, protocol, kind: 'farm',
      pair, amountUsd: Number(amountUsd), apy: Number(apy), rewardsUsd: 0, active: true, meta: {},
    }, { requestKey: positionId });
    await recordTx({ kind: 'stake', protocol, valueUsd: Number(amountUsd), gasUsd: 2.4, meta: { pair } });
    setPositions((p) => [rec, ...p]);
    return rec;
  }, [chainKey, walletAddress, recordTx]);

  const unstake = useCallback(async (position) => {
    await pb.collection('defi_positions').update(position.id, { active: false });
    await recordTx({ kind: 'unstake', protocol: position.protocol, valueUsd: position.amountUsd, gasUsd: 2.2, meta: { pair: position.pair } });
    setPositions((p) => p.map((x) => (x.id === position.id ? { ...x, active: false } : x)));
  }, [recordTx]);

  const claim = useCallback(async (position) => {
    const rewards = position.rewardsUsd || Number((position.amountUsd * (position.apy / 100) / 52).toFixed(2));
    await recordTx({ kind: 'claim', protocol: position.protocol, valueUsd: rewards, gasUsd: 1.6, meta: { pair: position.pair } });
    await pb.collection('defi_positions').update(position.id, { rewardsUsd: 0 });
    setPositions((p) => p.map((x) => (x.id === position.id ? { ...x, rewardsUsd: 0 } : x)));
  }, [recordTx]);

  const supply = useCallback(async ({ protocol, token, amountUsd, apy }) => {
    const positionId = `lend-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const rec = await pb.collection('defi_positions').create({
      positionId, walletAddress: walletAddress || '', chainKey, protocol, kind: 'lending',
      pair: token, amountUsd: Number(amountUsd), apy: Number(apy), rewardsUsd: 0, healthFactor: 0, active: true, meta: {},
    }, { requestKey: positionId });
    await recordTx({ kind: 'deposit', protocol, fromToken: token, valueUsd: Number(amountUsd), gasUsd: 4.1, meta: {} });
    setPositions((p) => [rec, ...p]);
    return rec;
  }, [chainKey, walletAddress, recordTx]);

  const borrow = useCallback(async ({ protocol, token, amountUsd, apy, collateralUsd }) => {
    const positionId = `borrow-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const hf = collateralUsd && amountUsd ? Number(((collateralUsd * 0.8) / amountUsd).toFixed(2)) : 0;
    const rec = await pb.collection('defi_positions').create({
      positionId, walletAddress: walletAddress || '', chainKey, protocol, kind: 'borrow',
      pair: token, amountUsd: Number(amountUsd), apy: Number(apy), healthFactor: hf, active: true, meta: { collateralUsd },
    }, { requestKey: positionId });
    await recordTx({ kind: 'borrow', protocol, toToken: token, valueUsd: Number(amountUsd), gasUsd: 4.3, meta: {} });
    setPositions((p) => [rec, ...p]);
    return rec;
  }, [chainKey, walletAddress, recordTx]);

  const repay = useCallback(async (position) => {
    await pb.collection('defi_positions').update(position.id, { active: false });
    await recordTx({ kind: 'repay', protocol: position.protocol, fromToken: position.pair, valueUsd: position.amountUsd, gasUsd: 4.0, meta: {} });
    setPositions((p) => p.map((x) => (x.id === position.id ? { ...x, active: false } : x)));
  }, [recordTx]);

  const dexes = useMemo(() => DEXES.filter((d) => d.chains.includes(chainKey)), [chainKey]);
  const lenders = useMemo(() => LENDERS.filter((l) => l.chains.includes(chainKey)), [chainKey]);
  const activePositions = useMemo(() => positions.filter((p) => p.active), [positions]);
  const chain = chainByKey(chainKey);

  const summary = useMemo(() => {
    const supplied = activePositions.filter((p) => ['liquidity', 'farm', 'lending'].includes(p.kind)).reduce((a, p) => a + (p.amountUsd || 0), 0);
    const borrowed = activePositions.filter((p) => p.kind === 'borrow').reduce((a, p) => a + (p.amountUsd || 0), 0);
    const rewards = activePositions.reduce((a, p) => a + (p.rewardsUsd || 0), 0);
    const avgApy = activePositions.length ? activePositions.reduce((a, p) => a + (p.apy || 0), 0) / activePositions.length : 0;
    return { supplied, borrowed, net: supplied - borrowed, rewards, avgApy, count: activePositions.length };
  }, [activePositions]);

  return {
    transactions, positions, activePositions, loading, error, chain, dexes, lenders, summary,
    getQuote, swap, addLiquidity, removeLiquidity, stake, unstake, claim, supply, borrow, repay, reload: load,
  };
}
