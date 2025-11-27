import dotenv from 'dotenv';
dotenv.config();

export const config = {
  // Relayer wallet
  relayerPrivateKey: process.env.RELAYER_PRIVATE_KEY,
  // RPC URLs (with backups)
  bscRpcUrl: process.env.BSC_RPC_URL || 'https://data-seed-prebsc-1-s1.bnbchain.org:8545',
  bscRpcUrlBackup: process.env.BSC_RPC_URL_BACKUP || 'https://bsc-dataseed1.binance.org',
  bscRpcUrlBackup2: process.env.BSC_RPC_URL_BACKUP2 || 'https://bsc-dataseed2.binance.org',
  bscRpcUrlBackup3: process.env.BSC_RPC_URL_BACKUP23|| 'https://bsc-dataseed.binance.org',
  ucRpcUrl: process.env.UC_RPC_URL || 'https://rpc.mainnet.ucchain.org',

  // Contract addresses
  bscBridgeAddress: process.env.BSC_BRIDGE_ADDRESS || '0xE4363F8FbD39FB0930772644Ebd14597e5756986',
  ucBridgeAddress: process.env.UC_BRIDGE_ADDRESS || '0x9b7f2CF537F81f2fCfd3252B993b7B12a47648d1',
  
  bscUsdtAddress: process.env.BSC_USDT_ADDRESS || '0x55d398326f99059fF775485246999027B3197955',
  ucUsdtAddress: process.env.UC_USDT_ADDRESS || '0x5B4bB8DC15B345D67Cc333Bd1266108DfE206c76',

  // Chain IDs
  bscChainId: parseInt(process.env.BSC_CHAIN_ID || '56'),
  ucChainId: parseInt(process.env.UC_CHAIN_ID || '1137'),

  // Monitoring settings
  pollInterval: parseInt(process.env.POLL_INTERVAL || '5000'),
  maxBlocksPerQuery: parseInt(process.env.MAX_BLOCKS_PER_QUERY || '500'),
  catchUpPollInterval: parseInt(process.env.CATCH_UP_POLL_INTERVAL || '1000'),
  realtimeEnabled: process.env.REALTIME_ENABLED !== 'false',
  startBlockBsc: process.env.START_BLOCK_BSC || 'latest',
  startBlockUc: process.env.START_BLOCK_UC || 'latest',

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info'
};

// Validate required config
if (!config.relayerPrivateKey) {
  console.error('ERROR: RELAYER_PRIVATE_KEY is required in .env file');
  process.exit(1);
}
