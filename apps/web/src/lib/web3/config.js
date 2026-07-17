// Web3 chain, wallet, DEX and lending configuration (Phase 6)

export const CHAINS = [
  { key: 'ethereum', name: 'Ethereum', symbol: 'ETH', chainId: '0x1', rpc: 'https://eth.llamarpc.com', explorer: 'https://etherscan.io', color: '#627eea' },
  { key: 'solana', name: 'Solana', symbol: 'SOL', chainId: 'solana', rpc: 'https://api.mainnet-beta.solana.com', explorer: 'https://solscan.io', color: '#14f195' },
  { key: 'polygon', name: 'Polygon', symbol: 'MATIC', chainId: '0x89', rpc: 'https://polygon-rpc.com', explorer: 'https://polygonscan.com', color: '#8247e5' },
  { key: 'bnb', name: 'BNB Chain', symbol: 'BNB', chainId: '0x38', rpc: 'https://bsc-dataseed.binance.org', explorer: 'https://bscscan.com', color: '#f0b90b' },
  { key: 'arbitrum', name: 'Arbitrum', symbol: 'ARB', chainId: '0xa4b1', rpc: 'https://arb1.arbitrum.io/rpc', explorer: 'https://arbiscan.io', color: '#28a0f0' },
  { key: 'avalanche', name: 'Avalanche', symbol: 'AVAX', chainId: '0xa86a', rpc: 'https://api.avax.network/ext/bc/C/rpc', explorer: 'https://snowtrace.io', color: '#e84142' },
  { key: 'base', name: 'Base', symbol: 'BASE', chainId: '0x2105', rpc: 'https://mainnet.base.org', explorer: 'https://basescan.org', color: '#0052ff' },
  { key: 'chiliz', name: 'Chiliz', symbol: 'CHZ', chainId: '0x15b38', rpc: 'https://rpc.ankr.com/chiliz', explorer: 'https://chiliscan.com', color: '#cd0124' },
];

export const CHAIN_BY_ID = Object.fromEntries(CHAINS.map((c) => [c.chainId, c]));
export const chainByKey = (k) => CHAINS.find((c) => c.key === k);

export const WALLETS = [
  { key: 'metamask', name: 'MetaMask', kind: 'evm', chains: ['ethereum', 'polygon', 'bnb', 'arbitrum', 'avalanche', 'base', 'chiliz'], detect: () => typeof window !== 'undefined' && window.ethereum?.isMetaMask },
  { key: 'coinbase', name: 'Coinbase Wallet', kind: 'evm', chains: ['ethereum', 'polygon', 'base', 'arbitrum'], detect: () => typeof window !== 'undefined' && (window.ethereum?.isCoinbaseWallet || window.coinbaseWalletExtension) },
  { key: 'walletconnect', name: 'WalletConnect', kind: 'evm', chains: ['ethereum', 'polygon', 'bnb', 'arbitrum', 'avalanche', 'base'], detect: () => false },
  { key: 'phantom', name: 'Phantom', kind: 'solana', chains: ['solana'], detect: () => typeof window !== 'undefined' && window.solana?.isPhantom },
  { key: 'solflare', name: 'Solflare', kind: 'solana', chains: ['solana'], detect: () => typeof window !== 'undefined' && window.solflare?.isSolflare },
  { key: 'ledger', name: 'Ledger', kind: 'hardware', chains: CHAINS.map((c) => c.key), detect: () => false },
  { key: 'trezor', name: 'Trezor', kind: 'hardware', chains: CHAINS.map((c) => c.key), detect: () => false },
];

export const DEXES = [
  { key: 'uniswap', name: 'Uniswap', chains: ['ethereum', 'polygon', 'arbitrum', 'base'], tvl: 5.2e9, color: '#ff007a' },
  { key: 'pancakeswap', name: 'PancakeSwap', chains: ['bnb'], tvl: 1.9e9, color: '#1fc7d4' },
  { key: 'raydium', name: 'Raydium', chains: ['solana'], tvl: 1.1e9, color: '#c200fb' },
  { key: 'orca', name: 'Orca', chains: ['solana'], tvl: 0.4e9, color: '#ffd15c' },
  { key: 'curve', name: 'Curve', chains: ['ethereum', 'polygon', 'arbitrum'], tvl: 2.3e9, color: '#40e0d0' },
  { key: 'balancer', name: 'Balancer', chains: ['ethereum', 'polygon', 'arbitrum'], tvl: 0.9e9, color: '#00c9a7' },
  { key: 'sushiswap', name: 'SushiSwap', chains: ['ethereum', 'polygon', 'arbitrum', 'bnb'], tvl: 0.3e9, color: '#fa52a0' },
];

export const LENDERS = [
  { key: 'aave', name: 'Aave', chains: ['ethereum', 'polygon', 'arbitrum', 'avalanche'], supplyApy: 3.2, borrowApy: 4.8, tvl: 12e9 },
  { key: 'compound', name: 'Compound', chains: ['ethereum'], supplyApy: 2.7, borrowApy: 4.1, tvl: 3e9 },
  { key: 'curve', name: 'Curve', chains: ['ethereum', 'polygon', 'arbitrum'], supplyApy: 5.4, borrowApy: 6.2, tvl: 2.3e9 },
  { key: 'lido', name: 'Lido', chains: ['ethereum'], supplyApy: 3.6, borrowApy: 0, tvl: 22e9 },
];

export const shortAddr = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');
