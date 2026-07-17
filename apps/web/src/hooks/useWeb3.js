import { useCallback, useEffect, useState } from 'react';
import pb from '@/lib/pocketbaseClient';
import { CHAINS, CHAIN_BY_ID, chainByKey } from '@/lib/web3/config';

const hexToDec = (h) => (h ? parseInt(h, 16) : 0);
const weiToEth = (wei) => Number(BigInt(wei || '0x0')) / 1e18;

export function useWeb3() {
  const [wallets, setWallets] = useState([]);
  const [account, setAccount] = useState(null);
  const [chainKey, setChainKey] = useState('ethereum');
  const [nativeBalance, setNativeBalance] = useState(0);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  const loadWallets = useCallback(async () => {
    try {
      const list = await pb.collection('web3_wallets').getFullList({ sort: '-created' });
      setWallets(list);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadWallets(); }, [loadWallets]);

  const refreshBalance = useCallback(async (addr, chain) => {
    const c = chainByKey(chain) || CHAINS[0];
    if (!window.ethereum || c.key === 'solana') return;
    try {
      const bal = await window.ethereum.request({ method: 'eth_getBalance', params: [addr, 'latest'] });
      setNativeBalance(weiToEth(bal));
    } catch { setNativeBalance(0); }
  }, []);

  const persist = useCallback(async (addr, chain, walletType) => {
    const c = chainByKey(chain) || CHAINS[0];
    try {
      const existing = wallets.find((w) => w.address?.toLowerCase() === addr.toLowerCase());
      const data = { address: addr, label: walletType, walletType, chainId: c.chainId, chainKey: c.key, connected: true, primary: wallets.length === 0 };
      if (existing) await pb.collection('web3_wallets').update(existing.id, data);
      else await pb.collection('web3_wallets').create(data);
      await loadWallets();
    } catch (e) { setError(e?.message || 'Kayıt başarısız'); }
  }, [wallets, loadWallets]);

  const connect = useCallback(async (walletType = 'metamask') => {
    setError('');
    if (!window.ethereum) { setError('MetaMask veya uyumlu bir cüzdan bulunamadı. Lütfen bir Web3 cüzdanı yükleyin.'); return; }
    setConnecting(true);
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const cid = await window.ethereum.request({ method: 'eth_chainId' });
      const chain = CHAIN_BY_ID[cid]?.key || 'ethereum';
      const addr = accounts[0];
      setAccount(addr);
      setChainKey(chain);
      await refreshBalance(addr, chain);
      await persist(addr, chain, walletType);
    } catch (e) {
      setError(e?.message || 'Bağlantı reddedildi');
    } finally { setConnecting(false); }
  }, [refreshBalance, persist]);

  const switchNetwork = useCallback(async (chain) => {
    const c = chainByKey(chain);
    if (!window.ethereum || !c || c.key === 'solana') return;
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: c.chainId }] });
      setChainKey(chain);
      if (account) await refreshBalance(account, chain);
    } catch (e) { setError(e?.message || 'Ağ değiştirilemedi'); }
  }, [account, refreshBalance]);

  const disconnect = useCallback(async (id) => {
    try {
      const w = wallets.find((x) => x.id === id);
      await pb.collection('web3_wallets').update(id, { connected: false });
      if (w && account && w.address?.toLowerCase() === account.toLowerCase()) { setAccount(null); setNativeBalance(0); }
      await loadWallets();
    } catch (e) { setError(e?.message || 'Silinemedi'); }
  }, [wallets, account, loadWallets]);

  useEffect(() => {
    if (!window.ethereum) return;
    const onAcc = (accs) => { if (accs[0]) { setAccount(accs[0]); refreshBalance(accs[0], chainKey); } else setAccount(null); };
    const onChain = (cid) => { const k = CHAIN_BY_ID[cid]?.key; if (k) { setChainKey(k); if (account) refreshBalance(account, k); } };
    window.ethereum.on?.('accountsChanged', onAcc);
    window.ethereum.on?.('chainChanged', onChain);
    return () => {
      window.ethereum.removeListener?.('accountsChanged', onAcc);
      window.ethereum.removeListener?.('chainChanged', onChain);
    };
  }, [account, chainKey, refreshBalance]);

  return { wallets, account, chainKey, nativeBalance, connecting, error, connect, disconnect, switchNetwork, refreshBalance, loadWallets, setError };
}
