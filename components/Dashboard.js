import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import Link from 'next/link';
import { useWeb3 } from '../contexts/Web3Context';
import { 
  CONTRACT_ADDRESSES, 
  BRIDGE_ABI, 
  USDT_ABI,
  getBridgeAddress,
  getUSDTAddress,
  getExplorerUrl
} from '../lib/contracts';

const CHAIN_CONFIG = {
  56: { 
    name: 'BSC Mainnet', 
    symbol: 'BNB', 
    icon: 'fa-solid fa-coins',
    color: 'bg-yellow-500'
  },
  1137: { 
    name: 'Universe Chain', 
    symbol: 'UC', 
    icon: 'fa-solid fa-infinity',
    color: 'bg-purple-500'
  }
};

export default function Dashboard() {
  // Use shared Web3 context
  const { provider, signer, account, chainId, isConnected, connectWallet: connectWeb3, switchNetwork: switchWeb3Network } = useWeb3();
  
  // Bridge State
  const [sourceChain, setSourceChain] = useState('56');
  const [destChain, setDestChain] = useState('1137');
  const [amount, setAmount] = useState('');
  const [balance, setBalance] = useState('0.00');
  const [rawBalance, setRawBalance] = useState(0); // Store raw numeric balance for tooltip
  const [allowance, setAllowance] = useState('0');
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  
  // UI State
  const [isApproving, setIsApproving] = useState(false);
  const [isBridging, setIsBridging] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [bridgeStep, setBridgeStep] = useState(0);
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');

  // Web3 is now managed by context - no initialization needed here

  // Auto-set chains based on connected network and load balance
  useEffect(() => {
    if (isConnected && chainId) {
      console.log(`🌐 Network detected: chainId = ${chainId}`);

      // Auto-set source and destination chains based on connected network
      if (chainId === 56) {
        // Connected to BSC - bridge from BSC to UC
        setSourceChain('56');
        setDestChain('1137');
        console.log('🎯 Set chains: BSC (56) → Universe Chain (1137)');
      } else if (chainId === 1137) {
        // Connected to UC - bridge from UC to BSC
        setSourceChain('1137');
        setDestChain('56');
        console.log('🎯 Set chains: Universe Chain (1137) → BSC (56)');
      } else {
        console.log(`⚠️ Unknown chainId: ${chainId}`);
      }

      // Load balance and allowance when connected and chains are set
      // Add delay to ensure network switch has completed (longer for UC)
      if (account) {
        const delay = chainId === 1137 ? 2000 : 500; // 2 seconds for UC, 0.5 for BSC
        console.log(`⏳ Scheduling balance load in ${delay}ms for chain ${chainId}`);
        setTimeout(() => {
          console.log(`🚀 Starting balance load for chain ${chainId}`);
          loadBalance(chainId); // Pass chainId directly to avoid stale closure
          loadAllowance(chainId); // Pass chainId directly to avoid stale closure
        }, delay);
      }
    }
  }, [isConnected, chainId, account]);

  const connectWallet = async () => {
    try {
      await connectWeb3();
      setError('');
    } catch (error) {
      console.error('Error connecting wallet:', error);
      setError(error.message || 'Failed to connect wallet');
    }
  };

  const switchNetwork = async (targetChainId) => {
    return await switchWeb3Network(targetChainId);
  };

  // Helper function to format large numbers with abbreviations
  const formatLargeNumber = (num) => {
    // Handle invalid numbers
    if (isNaN(num) || num === null || num === undefined) {
      return '0.00';
    }
    
    if (num >= 1000000000) {
      // Billions - show as X.XXB
      return (num / 1000000000).toFixed(2) + 'B';
    } else if (num >= 1000000) {
      // Millions - show as X.XXM
      return (num / 1000000).toFixed(2) + 'M';
    } else if (num >= 1000) {
      // Thousands - show as X.XXK
      return (num / 1000).toFixed(2) + 'K';
    } else {
      // Regular numbers - show as X.XX
      return num.toFixed(2);
    }
  };

  const loadBalance = async (chainIdParam, retryCount = 0) => {
    const targetChain = chainIdParam || Number(sourceChain);
    if (!signer || !account) {
      console.log('Cannot load balance: signer or account missing');
      setBalance('0.00');
      return;
    }

    // Verify signer is connected to correct network
    try {
      const signerNetwork = await signer.provider.getNetwork();
      const expectedChainId = targetChain;
      if (Number(signerNetwork.chainId) !== expectedChainId) {
        console.log(`⏳ Signer not ready for chain ${targetChain}, current: ${signerNetwork.chainId}, expected: ${expectedChainId}`);
        if (retryCount < 5) {
          setTimeout(() => loadBalance(chainIdParam, retryCount + 1), 1000);
          return;
        }
      }
    } catch (error) {
      console.log('Could not verify signer network:', error.message);
    }

    setIsLoadingBalance(true);
    try {
      const usdtAddress = getUSDTAddress(targetChain);
      console.log(`🔍 Loading balance for chain ${targetChain}:`, usdtAddress);

      if (!usdtAddress) {
        console.warn('No USDT address found for chain:', targetChain);
        setBalance('0.00');
        setIsLoadingBalance(false);
        return;
      }

      const usdtContract = new ethers.Contract(usdtAddress, USDT_ABI, signer);

      // Get decimals from contract to ensure correct formatting
      let decimals = 18; // Default to 18 (standard ERC20)
      try {
        decimals = await usdtContract.decimals();
        console.log(`✅ USDT decimals for chain ${sourceChain}:`, decimals);
      } catch (e) {
        console.warn(`⚠️ Could not get decimals for chain ${sourceChain}, using 18 as default`);
      }

      console.log(`🔄 Calling balanceOf for chain ${sourceChain}...`);
      const bal = await usdtContract.balanceOf(account);
      console.log(`✅ Raw balance for chain ${sourceChain}:`, bal.toString());

      // Format with correct decimals
      const formattedBalance = ethers.formatUnits(bal, decimals);
      const numericBalance = parseFloat(formattedBalance);

      console.log(`💰 Formatted balance for chain ${sourceChain}:`, formattedBalance, 'Numeric:', numericBalance);

      // Store raw balance for tooltip and calculations
      setRawBalance(numericBalance);

      // Format balance - use abbreviated format for large numbers
      const displayBalance = formatLargeNumber(numericBalance);
      console.log(`🎯 Setting balance display for chain ${sourceChain} to:`, displayBalance);
      setBalance(displayBalance);
    } catch (error) {
      console.error(`❌ Error loading balance for chain ${sourceChain}:`, error.message);
      console.error('Error details:', error.code, error.stack);

      // Retry logic for network switches (up to 3 retries with delay)
      if (retryCount < 3 && (error.message.includes('network') || error.message.includes('timeout') || error.message.includes('call revert'))) {
        console.log(`🔄 Retrying balance load for chain ${sourceChain} (attempt ${retryCount + 1}/3)...`);
        setTimeout(() => loadBalance(retryCount + 1), 2000 * (retryCount + 1));
        return;
      }

      console.log(`💥 Final failure for chain ${sourceChain}, setting balance to 0.00`);
      setBalance('0.00');
    } finally {
      setIsLoadingBalance(false);
    }
  };

  const loadAllowance = async (chainIdParam) => {
    const targetChain = chainIdParam || Number(sourceChain);
    if (!signer || !account) return;

    try {
      const usdtAddress = getUSDTAddress(targetChain);
      const bridgeAddress = getBridgeAddress(targetChain);

      if (!usdtAddress || !bridgeAddress) return;

      const usdtContract = new ethers.Contract(usdtAddress, USDT_ABI, signer);
      
      // Get decimals from contract
      let decimals = 18;
      try {
        decimals = await usdtContract.decimals();
      } catch (e) {
        console.warn('Could not get decimals for allowance, using 18');
      }
      
      const allow = await usdtContract.allowance(account, bridgeAddress);
      setAllowance(ethers.formatUnits(allow, decimals));
    } catch (error) {
      console.error('Error loading allowance:', error);
      setAllowance('0');
    }
  };

  const approveUSDT = async () => {
    if (!signer || !amount) return;

    setIsApproving(true);
    setError('');

    try {
      const usdtAddress = getUSDTAddress(Number(sourceChain));
      const bridgeAddress = getBridgeAddress(Number(sourceChain));
      const usdtContract = new ethers.Contract(usdtAddress, USDT_ABI, signer);

      // Get decimals from contract
      let decimals = 18;
      try {
        decimals = await usdtContract.decimals();
      } catch (e) {
        console.warn('Could not get decimals for approval, using 18');
      }

      const amountWei = ethers.parseUnits(amount, decimals);

      const tx = await usdtContract.approve(bridgeAddress, amountWei);
      await tx.wait();

      await loadAllowance();
      setError('');
    } catch (error) {
      console.error('Error approving USDT:', error);
      setError('Approval failed: ' + (error.reason || error.message));
    } finally {
      setIsApproving(false);
    }
  };


  const handleBridge = async () => {
    if (!isConnected) {
      setError('Please connect your wallet');
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (parseFloat(amount) > parseFloat(balance)) {
      setError('Insufficient balance');
      return;
    }

    if (Number(chainId) !== Number(sourceChain)) {
      const switched = await switchNetwork(sourceChain);
      if (!switched) {
        setError('Please switch to the source network');
        return;
      }
    }

    setShowConfirmModal(true);
  };

  const confirmBridge = async () => {
    setShowConfirmModal(false);
    setShowProgressModal(true);
    setBridgeStep(1);
    setError('');

    try {
      const usdtAddress = getUSDTAddress(Number(sourceChain));
      const usdtContract = new ethers.Contract(usdtAddress, USDT_ABI, signer);
      
      // Get decimals from contract
      let decimals = 18;
      try {
        decimals = await usdtContract.decimals();
      } catch (e) {
        console.warn('Could not get decimals for bridge, using 18');
      }
      
      const bridgeAddress = getBridgeAddress(Number(sourceChain));
      const bridgeContract = new ethers.Contract(bridgeAddress, BRIDGE_ABI, signer);
      const amountWei = ethers.parseUnits(amount, decimals);

      // Check allowance
      if (parseFloat(allowance) < parseFloat(amount)) {
        setError('Please approve USDT first');
        setShowProgressModal(false);
        setBridgeStep(0);
        return;
      }

      setBridgeStep(2);

      let tx;
      let backendEndpoint;
      let backendMethodName;

      if (Number(sourceChain) === 56) {
        // BSC to UC: deposit full amount (backend deducts 1% fee)
        tx = await bridgeContract.deposit(amountWei, account.toString());
        backendEndpoint = 'http://localhost:3002/api/process-deposit';
        backendMethodName = 'deposit';
        console.log('✅ BSC Deposit transaction sent:', tx.hash);
      } else if (Number(sourceChain) === 1137) {
        // UC to BSC: withdraw full amount (backend deducts 1% fee)
        tx = await bridgeContract.withdraw(amountWei, account.toString());
        backendEndpoint = 'http://localhost:3002/api/process-withdrawal';
        backendMethodName = 'withdrawal';
        console.log('✅ UC Withdrawal transaction sent:', tx.hash);
      } else {
        throw new Error('Unsupported source chain');
      }

      setTxHash(tx.hash);
      console.log('   Amount:', ethers.formatUnits(amountWei, decimals), 'USDT');
      console.log('   Destination:', account);

      setBridgeStep(3);
      console.log(`⏳ Waiting for ${CHAIN_CONFIG[sourceChain]?.name} confirmation...`);
      const receipt = await tx.wait();

      console.log(`✅ ${CHAIN_CONFIG[sourceChain]?.name} transaction confirmed!`);
      console.log('   Block:', receipt.blockNumber);
      console.log('   Status:', receipt.status === 1 ? 'Success' : 'Failed');
      console.log('   Gas Used:', receipt.gasUsed.toString());

      if (receipt.status !== 1) {
        throw new Error(`Transaction failed on ${CHAIN_CONFIG[sourceChain]?.name}`);
      }

      setBridgeStep(4);

      // Call backend to process the transaction
      try {
        console.log(`📡 Calling backend to process ${backendMethodName}...`, { txHash: tx.hash });

        const response = await fetch(backendEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ txHash: tx.hash }),
        });

        const result = await response.json();

        if (result.success) {
          console.log(`✅ Backend processed ${backendMethodName} successfully`, result);
          setBridgeStep(5); // Add final step for backend processing

          setTimeout(() => {
            setShowProgressModal(false);
            setBridgeStep(0);
            setAmount('');
            loadBalance();
            loadAllowance(); // Refresh allowance after transaction

            // Show success message
            const direction = Number(sourceChain) === 56 ? 'Deposit' : 'Withdrawal';
            const destChain = Number(sourceChain) === 56 ? 'UC' : 'BSC';
            alert(`🎉 Bridge successful!\n\n${direction}: ${parseFloat(amount).toFixed(2)} USDT\nRecipient: ${result.recipient}\n${destChain} Tx: ${result.ucTxHash || result.bscTxHash}\n\nProcessing time: ${result.totalTime}`);
          }, 3000);
        } else {
          console.error(`❌ Backend processing failed:`, result);
          setError(`${backendMethodName} submitted but backend processing failed: ${result.error || 'Unknown error'}`);
          setShowProgressModal(false);
          setBridgeStep(0);
        }
      } catch (backendError) {
        console.error('❌ Error calling backend:', backendError);
        setError(`${backendMethodName} submitted but backend communication failed: ${backendError.message}`);
        setShowProgressModal(false);
        setBridgeStep(0);
      }
    } catch (error) {
      console.error('❌ Bridge error:', error);
      
      let errorMessage = 'Bridge failed: ';
      if (error.code === 'ACTION_REJECTED') {
        errorMessage = 'Transaction rejected in MetaMask';
      } else if (error.message.includes('insufficient funds')) {
        errorMessage = 'Insufficient BNB for gas fees';
      } else if (error.message.includes('user rejected')) {
        errorMessage = 'You rejected the transaction';
      } else {
        errorMessage += (error.reason || error.message);
      }
      
      setError(errorMessage);
      setShowProgressModal(false);
      setBridgeStep(0);
    }
  };

  const cancelBridge = () => {
    setShowConfirmModal(false);
  };

  const bridgeFee = parseFloat(amount || 0) * 0.01; // 1% fee (0.01$ per 1$)
  const receivedAmount = parseFloat(amount || 0) - bridgeFee;
  const needsApproval = parseFloat(allowance) < parseFloat(amount || 0);

  return (
    <>
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .floating { animation: float 6s ease-in-out infinite; }
        .pulse-glow { animation: pulse 2s ease-in-out infinite; }
        .slide-up { animation: slideUp 0.3s ease-out; }
        .glassmorphism {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .gradient-text {
          background: linear-gradient(135deg, #FFC94D, #FFE066);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .glow-yellow {
          box-shadow: 0 0 20px rgba(255, 201, 77, 0.3);
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 text-white relative overflow-hidden">
        {/* Animated Background Particles */}
        <div className="fixed inset-0 z-0">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-yellow-400 rounded-full opacity-40"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animation: `float ${5 + Math.random() * 10}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 5}s`
              }}
            />
          ))}
        </div>

        <div className="relative z-10 max-w-2xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8">
          {/* Error Display */}
          {error && (
            <div className="glassmorphism bg-red-500/20 border-red-500 rounded-xl p-3 sm:p-4 mb-4 sm:mb-6 slide-up">
              <div className="flex items-center space-x-2">
                <i className="fa-solid fa-exclamation-triangle text-red-400 text-sm sm:text-base"></i>
                <span className="text-red-400 flex-1 text-xs sm:text-sm">{error}</span>
                <button onClick={() => setError('')} className="text-red-400 hover:text-red-300">
                  <i className="fa-solid fa-times text-sm sm:text-base"></i>
                </button>
              </div>
            </div>
          )}

          {/* Wallet Connection Card */}
          <div className="glassmorphism p-3 sm:p-4 md:p-6 rounded-xl sm:rounded-2xl mb-4 sm:mb-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center space-x-2 sm:space-x-3 md:space-x-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                  <i className="fa-brands fa-firefox text-white text-lg sm:text-xl md:text-2xl"></i>
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-sm sm:text-base md:text-lg truncate">
                    {isConnected ? 'Wallet Connected' : 'Connect Wallet'}
                  </div>
                  <div className="text-xs sm:text-sm text-slate-400 truncate">
                    {isConnected ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Click to connect'}
                  </div>
                  {isConnected && chainId && (
                    <div className="flex items-center space-x-2 mt-0.5 sm:mt-1">
                      <span className="text-xs text-yellow-400 truncate">
                        {CHAIN_CONFIG[chainId]?.name || `Chain ID: ${chainId}`}
                      </span>
                      <button
                        onClick={async () => {
                          const targetChain = chainId === 56 ? 1137 : 56;
                          const switched = await switchNetwork(targetChain);
                          if (switched) {
                            // Wait longer for network switch to complete, then refresh
                            setTimeout(() => {
                              loadBalance(targetChain);
                              loadAllowance(targetChain);
                            }, 3000);
                          }
                        }}
                        className="text-xs px-2 py-0.5 bg-yellow-400/20 text-yellow-400 rounded hover:bg-yellow-400/30 transition-colors"
                        title={`Switch to ${chainId === 56 ? 'Universe Chain' : 'BSC Mainnet'}`}
                      >
                        Switch
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'} pulse-glow`}></div>
                {!isConnected && (
                  <button
                    onClick={connectWallet}
                    className="px-3 py-2 sm:px-4 sm:py-2.5 md:px-6 md:py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-slate-900 font-bold text-xs sm:text-sm md:text-base rounded-lg sm:rounded-xl hover:from-yellow-500 hover:to-orange-600 transition-all glow-yellow"
                  >
                    Connect
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Bridge Title */}
          <div className="text-center mb-4 sm:mb-6">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold gradient-text mb-1 sm:mb-2 px-2">Bridge Dashboard</h1>
            <p className="text-xs sm:text-sm md:text-base text-slate-400 px-2">Transfer USDT between BSC and Universe Chain</p>
          </div>

          {/* Bridge Interface */}
          <div className="glassmorphism rounded-xl sm:rounded-2xl overflow-hidden mb-4 sm:mb-6">
            {/* Source Chain */}
            <div className="p-3 sm:p-4 md:p-6 border-b border-slate-600/30">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h3 className="font-semibold text-yellow-400 text-base sm:text-lg">From</h3>
                <span className="text-xs text-slate-400">Source Chain</span>
              </div>
              
              <select
                value={sourceChain}
                disabled
                className="w-full bg-slate-800/30 border border-slate-600 rounded-lg sm:rounded-xl p-3 sm:p-4 text-slate-400 text-sm sm:text-base appearance-none cursor-not-allowed mb-3 sm:mb-4"
              >
                <option value="56">BSC Mainnet</option>
                <option value="1137">Universe Chain</option>
              </select>

              <div className="flex items-center space-x-2 sm:space-x-3 mb-3">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 min-w-0 bg-slate-800/50 border border-slate-600 rounded-lg sm:rounded-xl p-3 sm:p-4 text-white text-lg sm:text-xl md:text-2xl font-bold focus:border-yellow-400 focus:outline-none"
                />
                <div className="bg-slate-800/50 px-2 sm:px-3 md:px-4 py-3 sm:py-4 rounded-lg sm:rounded-xl flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs sm:text-sm font-bold">$</span>
                  </div>
                  <span className="font-bold text-xs sm:text-sm md:text-base whitespace-nowrap">USDT</span>
                </div>
              </div>

              <div className="flex justify-between text-xs sm:text-sm flex-wrap gap-1">
                <span className="text-slate-400">Balance:</span>
                <div className="flex items-center space-x-1">
                  <span
                    className="text-green-400 font-medium break-all cursor-help"
                    title={rawBalance >= 1000 ? `Exact: ${rawBalance.toFixed(2)} USDT` : ''}
                  >
                    {isLoadingBalance ? (
                      <span className="flex items-center space-x-1">
                        <i className="fa-solid fa-spinner fa-spin"></i>
                        <span>Loading...</span>
                      </span>
                    ) : (
                      `${balance} USDT`
                    )}
                  </span>
                  <button
                    onClick={() => {
                      loadBalance(Number(sourceChain));
                      loadAllowance(Number(sourceChain));
                    }}
                    className="text-slate-400 hover:text-yellow-400 transition-colors ml-1"
                    title="Refresh balance and allowance"
                  >
                    <i className="fa-solid fa-refresh text-xs"></i>
                  </button>
                </div>
              </div>
            </div>


            {/* Destination Chain */}
            <div className="p-3 sm:p-4 md:p-6 border-t border-slate-600/30">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h3 className="font-semibold text-yellow-400 text-base sm:text-lg">To</h3>
                <span className="text-xs text-slate-400">Destination Chain</span>
              </div>
              
              <select
                value={destChain}
                disabled
                className="w-full bg-slate-800/30 border border-slate-600 rounded-lg sm:rounded-xl p-3 sm:p-4 text-slate-400 text-sm sm:text-base appearance-none cursor-not-allowed mb-3 sm:mb-4"
              >
                <option value="1137">Universe Chain</option>
                <option value="56">BSC Mainnet</option>
              </select>

              <div className="flex items-center space-x-2 sm:space-x-3 mb-3">
                <div className="flex-1 min-w-0 bg-slate-800/30 border border-slate-600 rounded-lg sm:rounded-xl p-3 sm:p-4 text-slate-400 text-lg sm:text-xl md:text-2xl font-bold break-all">
                  {receivedAmount > 0 ? receivedAmount.toFixed(2) : '0.00'}
                </div>
                <div className="bg-slate-800/50 px-2 sm:px-3 md:px-4 py-3 sm:py-4 rounded-lg sm:rounded-xl flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs sm:text-sm font-bold">$</span>
                  </div>
                  <span className="font-bold text-xs sm:text-sm md:text-base whitespace-nowrap">USDT</span>
                </div>
              </div>

              <div className="flex justify-between text-xs sm:text-sm flex-wrap gap-1">
                <span className="text-slate-400">You will receive:</span>
                <span className="text-yellow-400 font-medium break-all">≈ {receivedAmount > 0 ? receivedAmount.toFixed(2) : '0.00'} USDT</span>
              </div>
            </div>
          </div>

          {/* Transaction Details */}
          <div className="glassmorphism p-3 sm:p-4 md:p-6 rounded-xl sm:rounded-2xl mb-4 sm:mb-6">
            <h3 className="text-yellow-400 font-bold text-base sm:text-lg mb-3 sm:mb-4">Transaction Details</h3>
            <div className="space-y-2 sm:space-y-3">
              <div className="flex justify-between text-xs sm:text-sm flex-wrap gap-1">
                <span className="text-slate-400">Bridge Fee (1%)</span>
                <span className="font-medium break-all">{bridgeFee.toFixed(2)} USDT</span>
              </div>
              <div className="flex justify-between text-xs sm:text-sm flex-wrap gap-1">
                <span className="text-slate-400">Estimated Time</span>
                <div className="flex items-center space-x-1 sm:space-x-2">
                  <i className="fa-solid fa-clock text-green-400 text-xs sm:text-sm"></i>
                  <span className="text-green-400 font-medium">2-5 min</span>
                </div>
              </div>
              <div className="border-t border-slate-600 pt-2 sm:pt-3 flex justify-between flex-wrap gap-1">
                <span className="text-yellow-400 font-bold text-sm sm:text-base">You'll Receive</span>
                <span className="text-yellow-400 font-bold text-base sm:text-lg break-all">{receivedAmount.toFixed(2)} USDT</span>
              </div>
            </div>
          </div>

          {/* Transfer Route Visualization */}
          <div className="glassmorphism p-3 sm:p-4 md:p-6 rounded-xl sm:rounded-2xl mb-4 sm:mb-6">
            <h3 className="text-yellow-400 font-bold text-base sm:text-lg mb-3 sm:mb-4">Transfer Route</h3>
            <p className="text-xs text-slate-400 mb-3">Route automatically determined by your connected network</p>
            <div className="flex items-center justify-between">
              <div className="flex flex-col items-center flex-shrink-0">
                <div className={`w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 ${CHAIN_CONFIG[Number(sourceChain)]?.color} rounded-full flex items-center justify-center mb-1 sm:mb-2`}>
                  <i className={`${CHAIN_CONFIG[Number(sourceChain)]?.icon} text-white text-base sm:text-lg md:text-xl`}></i>
                </div>
                <span className="text-xs text-slate-400 text-center max-w-[60px] sm:max-w-none">{CHAIN_CONFIG[Number(sourceChain)]?.name.split(' ')[0]}</span>
              </div>
              <div className="flex-1 mx-2 sm:mx-3 md:mx-4 relative">
                <div className="h-1 bg-slate-600 rounded-full">
                  <div className="h-1 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full w-0 animate-pulse"></div>
                </div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 bg-yellow-400 rounded-full flex items-center justify-center floating">
                    <i className="fa-solid fa-arrow-right text-slate-900 text-xs sm:text-sm"></i>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-center flex-shrink-0">
                <div className={`w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 ${CHAIN_CONFIG[Number(destChain)]?.color} rounded-full flex items-center justify-center mb-1 sm:mb-2`}>
                  <i className={`${CHAIN_CONFIG[Number(destChain)]?.icon} text-white text-base sm:text-lg md:text-xl`}></i>
                </div>
                <span className="text-xs text-slate-400 text-center max-w-[60px] sm:max-w-none">{CHAIN_CONFIG[Number(destChain)]?.name.split(' ')[0]}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
            {needsApproval && isConnected && amount && (
              <button
                onClick={approveUSDT}
                disabled={isApproving}
                className="w-full py-3 sm:py-3.5 md:py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold text-sm sm:text-base rounded-lg sm:rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <i className="fa-solid fa-check-circle text-sm sm:text-base"></i>
                <span>{isApproving ? 'Approving...' : 'Approve USDT'}</span>
              </button>
            )}
            
            <button
              onClick={handleBridge}
              disabled={!isConnected || isBridging || needsApproval}
              className="w-full py-3 sm:py-3.5 md:py-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-slate-900 font-bold text-sm sm:text-base rounded-lg sm:rounded-xl hover:from-yellow-500 hover:to-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 glow-yellow"
            >
              <i className="fa-solid fa-rocket text-sm sm:text-base"></i>
              <span>{isBridging ? 'Bridging...' : 'Bridge Now'}</span>
            </button>

            <Link href="/transactions">
              <button className="w-full py-2.5 sm:py-3 glassmorphism text-yellow-400 font-semibold text-sm sm:text-base rounded-lg sm:rounded-xl border border-yellow-400/30 hover:bg-yellow-400/10 transition-all">
                <i className="fa-solid fa-history mr-2 text-sm sm:text-base"></i>
                View Transaction History
              </button>
            </Link>
          </div>

          {/* Security Badge */}
          <div className="glassmorphism p-4 sm:p-5 md:p-6 rounded-xl sm:rounded-2xl text-center">
            <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 glow-yellow">
              <i className="fa-solid fa-shield-halved text-white text-xl sm:text-2xl"></i>
            </div>
            <h3 className="font-bold text-base sm:text-lg gradient-text mb-1 sm:mb-2">Secured by Universe</h3>
            <p className="text-xs sm:text-sm text-slate-400 mb-3 sm:mb-4 px-2">Multi-sig wallets, audited contracts, and 24/7 monitoring protect your assets.</p>
            <div className="flex items-center justify-center flex-wrap gap-2 sm:gap-3 md:gap-4 text-xs">
              <div className="flex items-center space-x-1">
                <i className="fa-solid fa-check text-green-400"></i>
                <span className="text-slate-400">Audited</span>
              </div>
              <div className="flex items-center space-x-1">
                <i className="fa-solid fa-check text-green-400"></i>
                <span className="text-slate-400">Insured</span>
              </div>
              <div className="flex items-center space-x-1">
                <i className="fa-solid fa-check text-green-400"></i>
                <span className="text-slate-400">24/7 Support</span>
              </div>
            </div>
          </div>
        </div>

        {/* Confirmation Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glassmorphism rounded-2xl max-w-md w-full p-6 slide-up">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 glow-yellow">
                  <i className="fa-solid fa-rocket text-white text-2xl"></i>
                </div>
                <h3 className="text-2xl font-bold gradient-text mb-2">Confirm Bridge</h3>
                <p className="text-sm text-slate-400">Review your transaction details</p>
              </div>
              
              <div className="space-y-4 mb-6">
                <div className="glassmorphism p-4 rounded-xl">
                  <div className="flex justify-between mb-2">
                    <span className="text-slate-400">From</span>
                    <div className="flex items-center space-x-2">
                      <div className={`w-6 h-6 ${CHAIN_CONFIG[Number(sourceChain)]?.color} rounded-full flex items-center justify-center`}>
                        <i className={`${CHAIN_CONFIG[Number(sourceChain)]?.icon} text-white text-xs`}></i>
                      </div>
                      <span className="font-medium">{CHAIN_CONFIG[Number(sourceChain)]?.name}</span>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">To</span>
                    <div className="flex items-center space-x-2">
                      <div className={`w-6 h-6 ${CHAIN_CONFIG[Number(destChain)]?.color} rounded-full flex items-center justify-center`}>
                        <i className={`${CHAIN_CONFIG[Number(destChain)]?.icon} text-white text-xs`}></i>
                      </div>
                      <span className="font-medium">{CHAIN_CONFIG[Number(destChain)]?.name}</span>
                    </div>
                  </div>
                </div>
                
                <div className="glassmorphism p-4 rounded-xl">
                  <div className="flex justify-between mb-2">
                    <span className="text-slate-400">Amount</span>
                    <span className="font-bold text-yellow-400">{parseFloat(amount || 0).toFixed(2)} USDT</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-slate-400">Bridge Fee</span>
                    <span>{bridgeFee.toFixed(2)} USDT</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">You'll Receive</span>
                    <span className="font-bold text-green-400">{receivedAmount.toFixed(2)} USDT</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={confirmBridge}
                  className="w-full py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-slate-900 font-bold rounded-xl hover:from-yellow-500 hover:to-orange-600 transition-all glow-yellow"
                >
                  Confirm & Bridge
                </button>
                <button
                  onClick={cancelBridge}
                  className="w-full py-3 glassmorphism text-slate-400 font-semibold rounded-xl border border-slate-600 hover:bg-slate-800/30 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Progress Modal */}
        {showProgressModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glassmorphism rounded-2xl max-w-md w-full p-6 slide-up">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 pulse-glow">
                  <i className="fa-solid fa-sync-alt text-white text-2xl fa-spin"></i>
                </div>
                <h3 className="text-2xl font-bold gradient-text mb-2">Bridging in Progress</h3>
                <p className="text-sm text-slate-400">Please wait while we process your transfer</p>
              </div>
              
              <div className="space-y-4 mb-6">
                {[
                  { step: 1, title: 'Transaction Initiated', desc: 'Confirmed on source chain' },
                  { step: 2, title: 'Confirming Transaction', desc: 'Waiting for confirmations' },
                  { step: 3, title: 'Processing Bridge', desc: 'Relayer processing' },
                  { step: 4, title: 'Backend Processing', desc: 'Minting on destination chain' },
                  { step: 5, title: 'Completed', desc: 'Tokens received' }
                ].map(({ step, title, desc }) => (
                  <div key={step} className="flex items-center space-x-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      bridgeStep >= step ? 'bg-green-500' : 'bg-slate-600'
                    }`}>
                      {bridgeStep >= step ? (
                        <i className="fa-solid fa-check text-white"></i>
                      ) : (
                        <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className={`text-sm font-medium ${bridgeStep >= step ? 'text-white' : 'text-slate-400'}`}>
                        {title}
                      </div>
                      <div className="text-xs text-slate-400">{desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {txHash && (
                <div className="glassmorphism p-4 rounded-xl mb-4">
                  <div className="text-xs text-slate-400 mb-1">Transaction Hash:</div>
                  <div className="text-xs text-yellow-400 break-all font-mono mb-2">{txHash}</div>
                  <a 
                    href={getExplorerUrl(Number(sourceChain), txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 inline-flex items-center space-x-1"
                  >
                    <span>View on Explorer</span>
                    <i className="fa-solid fa-external-link-alt"></i>
                  </a>
                </div>
              )}

              <div className="glassmorphism bg-yellow-500/20 border-yellow-500/50 rounded-xl p-3 text-sm text-yellow-400">
                <i className="fa-solid fa-clock mr-2"></i>
                The relayer will process your transaction on the destination chain within 2-5 minutes.
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
