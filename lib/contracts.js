import BSC_BRIDGE_ABI_JSON from './bsc-bridge-abi.json';
import UC_BRIDGE_ABI_JSON from './uc-bridge-abi.json';

// Contract addresses
export const CONTRACT_ADDRESSES = {
  // BSC Mainnet
  56: {
    Bridge: "0xE4363F8FbD39FB0930772644Ebd14597e5756986",
    USDT: "0x55d398326f99059fF775485246999027B3197955"
  },
  // Universe Chain
  1137: {
    Bridge: "0x0eAf708770c97152A2369CC28e356FBaA87e7E42",
    USDT: "0x4ABB3197C29018A05Ab8D6810B126D14A99abde9"
  }
};

// RPC Endpoints
export const RPC_URLS = {
  56: "https://bsc-dataseed.binance.org",
  1137: "https://rpc.mainnet.ucchain.org"
};

// Block Explorer URLs
export const EXPLORER_URLS = {
  56: "https://bscscan.com",
  1137: "https://ucscan.io"
};

// Import full ABIs for internal use
const BSC_BRIDGE_ABI_FULL = BSC_BRIDGE_ABI_JSON;
const UC_BRIDGE_ABI_FULL = UC_BRIDGE_ABI_JSON;

// Combined Bridge ABI for ethers (human-readable format)
export const BRIDGE_ABI = [
  // BSC Bridge Functions
  "function deposit(uint256 amount, string destinationAddress)",
  "function unlock(address user, uint256 amount, bytes32 burnId)",
  
  // UC Bridge Functions
  "function mint(address user, uint256 amount, bytes32 depositId)",
  "function withdraw(uint256 amount, string destinationAddress)",
  
  // View Functions (both contracts)
  "function getTransaction(bytes32 transactionId) view returns (tuple(bytes32 transactionId, address user, string transactionType, uint256 amount, string sourceChain, string destinationChain, string destinationAddress, uint8 status, uint256 timestamp, bytes32 linkedId))",
  "function getUserTransactionsByTimeRange(address user, uint256 timeRange) view returns (tuple(bytes32 transactionId, address user, string transactionType, uint256 amount, string sourceChain, string destinationChain, string destinationAddress, uint8 status, uint256 timestamp, bytes32 linkedId)[])",
  "function getTransactionsByStatusAndTimeRange(uint8 status, uint256 timeRange) view returns (tuple(bytes32 transactionId, address user, string transactionType, uint256 amount, string sourceChain, string destinationChain, string destinationAddress, uint8 status, uint256 timestamp, bytes32 linkedId)[])",
  "function getMarketOverview() view returns (uint256 current24hVolume, uint256 previous24hVolume, uint256 volumeIncreasePercent, uint256 successRate, uint256 avgProcessingTime)",
  "function getTotalTransactions() view returns (uint256)",
  
  // Events
  "event Deposit(address indexed user, uint256 amount, bytes32 depositId, string destinationChain, string destinationAddress)",
  "event Withdrawal(address indexed user, uint256 amount, bytes32 withdrawalId, string sourceChain, bytes32 burnId)",
  "event Mint(address indexed user, uint256 amount, bytes32 mintId, string sourceChain, bytes32 depositId)",
  "event Burn(address indexed user, uint256 amount, bytes32 burnId, string destinationChain, string destinationAddress)",
  "event TransactionStatusUpdated(bytes32 indexed transactionId, address indexed user, uint8 status)"
];

// USDT ABI (standard ERC20)
export const USDT_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

// Helper function to get bridge address for a chain
export const getBridgeAddress = (chainId) => {
  return CONTRACT_ADDRESSES[chainId]?.Bridge || '';
};

// Helper function to get USDT address for a chain
export const getUSDTAddress = (chainId) => {
  return CONTRACT_ADDRESSES[chainId]?.USDT || '';
};

// Helper function to get destination chain ID
export const getDestinationChain = (sourceChainId) => {
  if (sourceChainId === 56) return 1137;
  if (sourceChainId === 1137) return 56;
  return null;
};

// Helper function to get explorer URL
export const getExplorerUrl = (chainId, txHash) => {
  const baseUrl = EXPLORER_URLS[chainId];
  return baseUrl ? `${baseUrl}/tx/${txHash}` : '';
};

// Helper function to get network name
export const getNetworkName = (chainId) => {
  const networks = {
    56: 'BSC Mainnet',
    1137: 'Universe Chain'
  };
  return networks[chainId] || 'Unknown Network';
};

// Helper function to get chain icon
export const getChainIcon = (chainId) => {
  const icons = {
    56: 'fa-solid fa-coins',
    1137: 'fa-solid fa-infinity'
  };
  return icons[chainId] || 'fa-solid fa-circle';
};

// Helper to get the correct ABI for a chain
export const getBridgeABI = (chainId) => {
  if (chainId === 56) return BSC_BRIDGE_ABI_FULL;
  if (chainId === 1137) return UC_BRIDGE_ABI_FULL;
  return BRIDGE_ABI; // Fallback to human-readable
};

// Export full JSON ABIs (single export point)
export { BSC_BRIDGE_ABI_FULL, UC_BRIDGE_ABI_FULL };
