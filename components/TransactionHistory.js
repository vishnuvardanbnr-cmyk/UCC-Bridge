import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ethers } from 'ethers';
import { useWeb3 } from '../contexts/Web3Context';
import { getAllUserTransactions } from '../lib/transactionService';
import { getExplorerUrl } from '../lib/contracts';

export default function TransactionHistory() {
  const { isConnected, account, chainId, connectWallet } = useWeb3();
  const [error, setError] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // all, pending, completed, failed

  // Load transactions when wallet is connected
  useEffect(() => {
    if (isConnected && account) {
      loadTransactions();
    }
  }, [isConnected, account]);

  const handleConnect = async () => {
    try {
      await connectWallet();
      setError('');
    } catch (error) {
      console.error('Error connecting wallet:', error);
      setError('Failed to connect wallet');
    }
  };

  const loadTransactions = async () => {
    if (!account) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      // Create providers for both chains
      const bscProvider = new ethers.JsonRpcProvider('https://bsc-dataseed.binance.org');
      const ucProvider = new ethers.JsonRpcProvider('https://rpc.mainnet.ucchain.org');
      
      // Fetch transactions from both chains
      const txs = await getAllUserTransactions(bscProvider, ucProvider, account, 30);
      setTransactions(txs);
    } catch (error) {
      console.error('Error loading transactions:', error);
      setError('Failed to load transactions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'text-green-400 bg-green-400/20';
      case 'pending':
        return 'text-yellow-400 bg-yellow-400/20';
      case 'failed':
        return 'text-red-400 bg-red-400/20';
      default:
        return 'text-slate-400 bg-slate-400/20';
    }
  };

  const getStatusIcon = (status) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'fa-check-circle';
      case 'pending':
        return 'fa-clock';
      case 'failed':
        return 'fa-times-circle';
      default:
        return 'fa-question-circle';
    }
  };

  const filteredTransactions = transactions.filter(tx => {
    if (filter === 'all') return true;
    return tx.status.toLowerCase() === filter;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 text-white p-3 sm:p-4 md:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/">
          <button className="mb-4 sm:mb-6 px-3 py-2 sm:px-4 sm:py-2 text-sm sm:text-base bg-slate-800 rounded-lg hover:bg-slate-700 transition-all flex items-center space-x-2">
            <i className="fa-solid fa-arrow-left text-xs sm:text-sm"></i>
            <span>Back to Bridge</span>
          </button>
        </Link>

        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6 md:mb-8">Transaction History</h1>

        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-lg sm:rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
            <div className="flex items-center space-x-2">
              <i className="fa-solid fa-exclamation-triangle text-red-400 text-sm sm:text-base"></i>
              <p className="text-red-400 text-xs sm:text-sm flex-1">{error}</p>
            </div>
          </div>
        )}

        {!isConnected ? (
          <div className="bg-slate-800/80 backdrop-blur-sm p-6 sm:p-8 md:p-10 rounded-xl sm:rounded-2xl text-center border border-slate-700/50">
            <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-lg shadow-yellow-500/20">
              <i className="fa-solid fa-wallet text-white text-xl sm:text-2xl md:text-3xl"></i>
            </div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-2 sm:mb-3 text-white">Connect Your Wallet</h2>
            <p className="mb-4 sm:mb-6 text-sm sm:text-base md:text-lg text-slate-300 px-2">Connect your wallet to view transaction history</p>
            <button
              onClick={handleConnect}
              className="px-6 sm:px-8 py-3 sm:py-3.5 bg-gradient-to-r from-yellow-400 to-orange-500 text-slate-900 font-bold text-sm sm:text-base rounded-lg sm:rounded-xl hover:from-yellow-500 hover:to-orange-600 transition-all shadow-lg hover:shadow-xl hover:scale-105"
            >
              <i className="fa-solid fa-wallet mr-2"></i>
              Connect Wallet
            </button>
          </div>
        ) : (
          <div className="bg-slate-800/80 backdrop-blur-sm p-4 sm:p-6 md:p-8 rounded-xl sm:rounded-2xl border border-slate-700/50">
            {/* Wallet Info Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 pb-4 border-b border-slate-700 gap-3 sm:gap-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <i className="fa-solid fa-check text-white text-base sm:text-lg"></i>
                </div>
                <div className="min-w-0">
                  <p className="text-base sm:text-lg font-bold text-green-400">Wallet Connected</p>
                  <p className="text-xs sm:text-sm text-slate-400 mt-0.5 truncate">
                    {account.slice(0, 8)}...{account.slice(-6)}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2 sm:text-right">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <div>
                  <p className="text-xs text-slate-400">Network</p>
                  <p className="text-xs sm:text-sm font-medium text-white">
                    {chainId === 56 ? 'BSC Mainnet' : chainId === 1137 ? 'Universe Chain' : `Chain ${chainId}`}
                  </p>
                </div>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center space-x-2 mb-4 sm:mb-6 overflow-x-auto pb-2">
              {[
                { key: 'all', label: 'All', icon: 'fa-list' },
                { key: 'completed', label: 'Completed', icon: 'fa-check-circle' },
                { key: 'pending', label: 'Pending', icon: 'fa-clock' },
                { key: 'failed', label: 'Failed', icon: 'fa-times-circle' }
              ].map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                    filter === key
                      ? 'bg-yellow-400 text-slate-900'
                      : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  <i className={`fa-solid ${icon} mr-1 sm:mr-2`}></i>
                  {label}
                </button>
              ))}
              <button
                onClick={loadTransactions}
                disabled={isLoading}
                className="ml-auto px-3 sm:px-4 py-2 bg-slate-700/50 text-slate-400 rounded-lg text-xs sm:text-sm hover:bg-slate-700 transition-all disabled:opacity-50"
              >
                <i className={`fa-solid fa-refresh mr-1 sm:mr-2 ${isLoading ? 'fa-spin' : ''}`}></i>
                Refresh
              </button>
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="text-center py-12">
                <div className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-400">Loading transactions from blockchain...</p>
              </div>
            )}

            {/* Transactions List */}
            {!isLoading && filteredTransactions.length > 0 && (
              <div className="space-y-3 sm:space-y-4">
                {filteredTransactions.map((tx, index) => (
                  <div
                    key={tx.transactionId || index}
                    className="bg-slate-700/30 rounded-lg p-3 sm:p-4 border border-slate-600/30 hover:border-yellow-400/30 transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
                          <i className="fa-solid fa-exchange-alt text-white text-sm sm:text-base"></i>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="font-bold text-white text-sm sm:text-base truncate">
                              {tx.type || 'Bridge Transfer'}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(tx.status)} flex items-center space-x-1 flex-shrink-0`}>
                              <i className={`fa-solid ${getStatusIcon(tx.status)}`}></i>
                              <span>{tx.status}</span>
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 truncate">
                            {tx.sourceChain} → {tx.destinationChain}
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <div className="font-bold text-yellow-400 text-sm sm:text-base whitespace-nowrap">
                          {parseFloat(tx.amount).toFixed(2)} USDT
                        </div>
                        <div className="text-xs text-slate-400 whitespace-nowrap">
                          {tx.date}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      {/* Blockchain Transaction Hashes */}
                      {tx.blockchainTxHashes ? (
                        <>
                          {/* Source Chain Transaction */}
                          <div className="bg-slate-800/50 rounded p-2">
                            <div className="text-slate-400 mb-1 flex items-center justify-between">
                              <span>{tx.blockchainTxHashes.type === 'deposit' ? 'Deposit TX' : 'Burn TX'} ({tx.blockchainTxHashes.sourceChain})</span>
                              <a
                                href={getExplorerUrl(tx.blockchainTxHashes.sourceChain === 'BSC' ? 56 : 1137, tx.blockchainTxHashes.sourceTxHash)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300"
                              >
                                <i className="fa-solid fa-external-link-alt"></i>
                              </a>
                            </div>
                            <div 
                              className="text-white font-mono truncate cursor-pointer hover:text-yellow-400 transition-colors" 
                              title={`${tx.blockchainTxHashes.sourceTxHash} (Click to copy)`}
                              onClick={() => {
                                navigator.clipboard.writeText(tx.blockchainTxHashes.sourceTxHash);
                                alert('Transaction hash copied!');
                              }}
                            >
                              {tx.blockchainTxHashes.sourceTxHash.slice(0, 12)}...{tx.blockchainTxHashes.sourceTxHash.slice(-10)}
                              <i className="fa-solid fa-copy ml-1 text-xs"></i>
                            </div>
                          </div>

                          {/* Destination Chain Transaction */}
                          {tx.blockchainTxHashes.destTxHash && (
                            <div className="bg-slate-800/50 rounded p-2">
                              <div className="text-slate-400 mb-1 flex items-center justify-between">
                                <span>{tx.blockchainTxHashes.type === 'deposit' ? 'Mint TX' : 'Unlock TX'} ({tx.blockchainTxHashes.destChain})</span>
                                <a
                                  href={getExplorerUrl(tx.blockchainTxHashes.destChain === 'BSC' ? 56 : 1137, tx.blockchainTxHashes.destTxHash)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-400 hover:text-blue-300"
                                >
                                  <i className="fa-solid fa-external-link-alt"></i>
                                </a>
                              </div>
                              <div 
                                className="text-green-400 font-mono truncate cursor-pointer hover:text-green-300 transition-colors" 
                                title={`${tx.blockchainTxHashes.destTxHash} (Click to copy)`}
                                onClick={() => {
                                  navigator.clipboard.writeText(tx.blockchainTxHashes.destTxHash);
                                  alert('Transaction hash copied!');
                                }}
                              >
                                {tx.blockchainTxHashes.destTxHash.slice(0, 12)}...{tx.blockchainTxHashes.destTxHash.slice(-10)}
                                <i className="fa-solid fa-copy ml-1 text-xs"></i>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {/* Fallback: Internal Transaction ID */}
                          <div className="bg-slate-800/50 rounded p-2">
                            <div className="text-slate-400 mb-1 flex items-center justify-between">
                              <span>Internal Transaction ID</span>
                              <span className="text-xs text-slate-500">
                                <i className="fa-solid fa-info-circle"></i>
                              </span>
                            </div>
                            <div 
                              className="text-white font-mono truncate cursor-pointer hover:text-yellow-400 transition-colors" 
                              title={`${tx.transactionId} (Click to copy)`}
                              onClick={() => {
                                navigator.clipboard.writeText(tx.transactionId);
                                alert('Internal transaction ID copied!');
                              }}
                            >
                              {tx.transactionId.slice(0, 12)}...{tx.transactionId.slice(-10)}
                              <i className="fa-solid fa-copy ml-1 text-xs"></i>
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              <i className="fa-solid fa-info-circle mr-1"></i>
                              Blockchain tx hashes not available yet
                            </div>
                          </div>
                        </>
                      )}

                      {/* Destination Address */}
                      <div className="bg-slate-800/50 rounded p-2">
                        <div className="text-slate-400 mb-1">Recipient Address</div>
                        <div 
                          className="text-white font-mono truncate cursor-pointer hover:text-yellow-400 transition-colors" 
                          title={`${tx.destinationAddress} (Click to copy)`}
                          onClick={() => {
                            navigator.clipboard.writeText(tx.destinationAddress);
                            alert('Address copied!');
                          }}
                        >
                          {tx.destinationAddress.slice(0, 12)}...{tx.destinationAddress.slice(-10)}
                          <i className="fa-solid fa-copy ml-1 text-xs"></i>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty State */}
            {!isLoading && filteredTransactions.length === 0 && (
              <div className="text-center py-8 sm:py-12 md:py-16">
                <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
                  <i className="fa-solid fa-clock-rotate-left text-3xl sm:text-4xl md:text-5xl text-slate-500"></i>
                </div>
                <h3 className="text-base sm:text-lg md:text-xl font-bold text-slate-300 mb-2">
                  {filter === 'all' ? 'No Completed Transactions' : `No ${filter.charAt(0).toUpperCase() + filter.slice(1)} Transactions`}
                </h3>
                <p className="text-xs sm:text-sm md:text-base text-slate-400 mb-1 px-4">
                  Only completed blockchain transactions are shown here
                </p>
                
                {/* Important Notice */}
                <div className="mt-4 mx-auto max-w-md bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-left">
                  <div className="flex items-start space-x-2">
                    <i className="fa-solid fa-info-circle text-yellow-400 mt-1"></i>
                    <div className="text-xs sm:text-sm text-slate-300">
                      <p className="font-semibold mb-1">Important:</p>
                      <p>If you just made a deposit, check your MetaMask for:</p>
                      <ul className="list-disc ml-4 mt-2 space-y-1">
                        <li>Pending transactions (wait for confirmation)</li>
                        <li>Failed transactions (try again)</li>
                        <li>Rejected transactions (approve in MetaMask)</li>
                      </ul>
                      <p className="mt-2">Transactions appear here only after blockchain confirmation (~20 seconds).</p>
                    </div>
                  </div>
                </div>
                
                {/* Quick Actions */}
                <div className="mt-6 sm:mt-8">
                  <Link href="/">
                    <button className="px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-slate-900 font-bold text-xs sm:text-sm rounded-lg hover:from-yellow-500 hover:to-orange-600 transition-all">
                      <i className="fa-solid fa-bridge mr-2"></i>
                      Make a Bridge Transfer
                    </button>
                  </Link>
                </div>
              </div>
            )}

            {/* Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-6">
              <div className="bg-slate-700/30 rounded-lg p-3 sm:p-4 border border-slate-600/30">
                <div className="flex items-center space-x-2 mb-2">
                  <i className="fa-solid fa-bolt text-yellow-400 text-sm sm:text-base"></i>
                  <h4 className="font-semibold text-xs sm:text-sm text-white">Fast Transfers</h4>
                </div>
                <p className="text-xs text-slate-400">Bridge transactions complete in 2-5 minutes</p>
              </div>
              
              <div className="bg-slate-700/30 rounded-lg p-3 sm:p-4 border border-slate-600/30">
                <div className="flex items-center space-x-2 mb-2">
                  <i className="fa-solid fa-shield-halved text-green-400 text-sm sm:text-base"></i>
                  <h4 className="font-semibold text-xs sm:text-sm text-white">Secure & Audited</h4>
                </div>
                <p className="text-xs text-slate-400">Your assets are protected by smart contracts</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
