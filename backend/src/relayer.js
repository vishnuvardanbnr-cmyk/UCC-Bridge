import { ethers } from 'ethers';
import { config } from './config.js';
import { BSC_BRIDGE_ABI, UC_BRIDGE_ABI } from './abis.js';
import logger, { transactionLogger } from './logger.js';
import { StateManager } from './state.js';

class BridgeRelayer {
  constructor() {
    this.processedDeposits = new Set();
    this.processedBurns = new Set();
    this.isRunning = false;
    this.stateManager = new StateManager();
    
    // RPC rotation for rate limit avoidance
    this.bscRpcEndpoints = [
      'https://bsc-dataseed1.binance.org',
      'https://bsc-dataseed2.binance.org',
      'https://bsc-dataseed3.binance.org',
      'https://bsc-dataseed4.binance.org',
      'https://bsc.publicnode.com',
      'https://bsc-rpc.publicnode.com'
    ];
    this.currentBscRpcIndex = 0;
    this.rpcFailCount = new Map();
  }

  getNextBscRpc() {
    // Rotate to next RPC endpoint
    this.currentBscRpcIndex = (this.currentBscRpcIndex + 1) % this.bscRpcEndpoints.length;
    const rpc = this.bscRpcEndpoints[this.currentBscRpcIndex];
    logger.info('Switching to BSC RPC', { rpc, index: this.currentBscRpcIndex });
    return rpc;
  }

  async createBscProvider() {
    const rpc = this.bscRpcEndpoints[this.currentBscRpcIndex];
    return new ethers.JsonRpcProvider(rpc, undefined, {
      staticNetwork: true,
      batchMaxCount: 1 // Disable batching to avoid rate limits
    });
  }

  async initialize() {
    try {
      // Setup BSC provider with rotation
      this.bscProvider = await this.createBscProvider();
      this.bscWallet = new ethers.Wallet(config.relayerPrivateKey, this.bscProvider);
      this.bscBridge = new ethers.Contract(config.bscBridgeAddress, BSC_BRIDGE_ABI, this.bscWallet);

      // Setup UC provider and contracts
      this.ucProvider = new ethers.JsonRpcProvider(config.ucRpcUrl);
      this.ucWallet = new ethers.Wallet(config.relayerPrivateKey, this.ucProvider);
      this.ucBridge = new ethers.Contract(config.ucBridgeAddress, UC_BRIDGE_ABI, this.ucWallet);

      // Get relayer address
      this.relayerAddress = await this.bscWallet.getAddress();

      logger.info('Relayer initialized', {
        relayerAddress: this.relayerAddress,
        bscBridge: config.bscBridgeAddress,
        ucBridge: config.ucBridgeAddress,
        bscRpcCount: this.bscRpcEndpoints.length
      });

      // Load state from disk
      const lastBscBlock = this.stateManager.getLastBscBlock();
      const lastUcBlock = this.stateManager.getLastUcBlock();
      
      // Get starting blocks
      this.bscLastBlock = lastBscBlock || (config.startBlockBsc === 'latest' 
        ? await this.bscProvider.getBlockNumber() 
        : parseInt(config.startBlockBsc));
      
      this.ucLastBlock = lastUcBlock || (config.startBlockUc === 'latest'
        ? await this.ucProvider.getBlockNumber()
        : parseInt(config.startBlockUc));

      // Load processed deposits from state
      const processedDeposits = this.stateManager.state.processedDeposits || [];
      processedDeposits.forEach(id => this.processedDeposits.add(id));
      
      const processedBurns = this.stateManager.state.processedBurns || [];
      processedBurns.forEach(id => this.processedBurns.add(id));

      logger.info('Starting from blocks', {
        bsc: this.bscLastBlock,
        uc: this.ucLastBlock,
        processedDeposits: this.processedDeposits.size,
        processedBurns: this.processedBurns.size
      });

      return true;
    } catch (error) {
      logger.error('Failed to initialize relayer', { error: error.message });
      throw error;
    }
  }

  async start() {
    if (this.isRunning) {
      logger.warn('Relayer is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting relayer service (On-demand processing only)...');
    logger.info('No continuous monitoring - processes transactions via API calls only');
    logger.info('Rate limit friendly: only processes when users deposit');

    // No continuous monitoring - only API-based processing
    // This avoids BSC RPC rate limits while maintaining functionality
  }

  async startWebSocketListeners() {
    // BSC WebSocket for deposits
    try {
      const wsProvider = new ethers.WebSocketProvider('wss://bsc-ws-node.nariox.org:443');
      const wsBridge = new ethers.Contract(config.bscBridgeAddress, BSC_BRIDGE_ABI, wsProvider);
      
      wsBridge.on('Deposit', async (user, amount, depositId, destinationAddress, event) => {
        logger.info('🔔 Real-time BSC deposit detected via WebSocket!', {
          user,
          amount: ethers.formatUnits(amount, 18),
          depositId: depositId.toString(),
          destinationAddress,
          txHash: event.log.transactionHash
        });
        
        await this.handleBscDeposit(event);
      });
      
      logger.info('✅ BSC WebSocket listener started for real-time deposits');
    } catch (error) {
      logger.warn('BSC WebSocket not available, using polling only', { error: error.message });
    }
    
    // UC WebSocket for burns
    try {
      const ucWsProvider = new ethers.WebSocketProvider('wss://ws.mainnet.ucchain.org');
      const ucWsBridge = new ethers.Contract(config.ucBridgeAddress, UC_BRIDGE_ABI, ucWsProvider);
      
      ucWsBridge.on('Burn', async (user, amount, burnId, destinationAddress, event) => {
        logger.info('🔔 Real-time UC burn detected via WebSocket!', {
          user,
          amount: ethers.formatUnits(amount, 18),
          burnId: burnId.toString(),
          destinationAddress,
          txHash: event.log.transactionHash
        });
        
        await this.handleUcBurn(event);
      });
      
      logger.info('✅ UC WebSocket listener started for real-time burns');
    } catch (error) {
      logger.warn('UC WebSocket not available, using polling only', { error: error.message });
    }
  }

  // WebSocket listeners disabled - public RPCs have filter expiration issues
  // Using optimized polling instead: 5s interval with 500 blocks per query
  // This provides near real-time detection without WebSocket reliability issues

  async monitorBscDeposits() {
    let consecutiveErrors = 0;

    while (this.isRunning) {
      try {
        const currentBlock = await this.bscProvider.getBlockNumber();

        if (currentBlock > this.bscLastBlock) {
          const blocksBehind = currentBlock - this.bscLastBlock;

          // Scan only 1 block at a time for instant processing
          const toBlock = this.bscLastBlock + 1;

          if (blocksBehind > 10) {
            logger.info(`Checking BSC block ${toBlock} (${blocksBehind} blocks behind)`);
          }

          // Query Deposit events for single block
          const filter = this.bscBridge.filters.Deposit();
          const events = await this.bscBridge.queryFilter(filter, toBlock, toBlock);

          if (events.length > 0) {
            logger.info(`🎯 Found ${events.length} deposit(s) in block ${toBlock}`);

            for (const event of events) {
              await this.handleBscDeposit(event);
            }
          }

          this.bscLastBlock = toBlock;
          this.stateManager.setLastBscBlock(toBlock);
          consecutiveErrors = 0;

          // No delay when catching up, longer delay when caught up to reduce RPC calls
          if (blocksBehind <= 1) {
            await this.sleep(5000); // 5 seconds instead of 1 to reduce rate limiting
          }
        } else {
          // Caught up, wait 5 seconds
          await this.sleep(5000);
        }
      } catch (error) {
        consecutiveErrors++;

        if (error.message.includes('rate limit') || error.message.includes('429') || error.message.includes('missing response')) {
          logger.warn('BSC RPC rate limit detected, switching endpoint...', {
            consecutiveErrors,
            currentRpc: this.bscRpcEndpoints[this.currentBscRpcIndex],
            error: error.message
          });

          // Switch to next RPC immediately
          const newRpc = this.getNextBscRpc();
          this.bscProvider = await this.createBscProvider();
          this.bscWallet = new ethers.Wallet(config.relayerPrivateKey, this.bscProvider);
          this.bscBridge = new ethers.Contract(config.bscBridgeAddress, BSC_BRIDGE_ABI, this.bscWallet);

          // Longer wait for rate limits
          const waitTime = Math.min(5000 * Math.pow(2, consecutiveErrors - 1), 60000); // Up to 1 minute
          logger.info(`Rate limited, waiting ${waitTime}ms before retry`);
          await this.sleep(waitTime);
        } else if (error.message.includes('timeout') || error.message.includes('network')) {
          logger.warn('BSC network timeout, retrying...', { error: error.message });
          await this.sleep(10000); // 10 seconds for network issues
        } else {
          logger.error('Error monitoring BSC deposits', { error: error.message, stack: error.stack });
          await this.sleep(15000); // 15 seconds for other errors
        }
      }
    }
  }

  async monitorUcBurns() {
    while (this.isRunning) {
      try {
        const currentBlock = await this.ucProvider.getBlockNumber();
        
        if (currentBlock > this.ucLastBlock) {
          const blocksBehind = currentBlock - this.ucLastBlock;
          
          // Scan 1 block at a time for instant processing
          const toBlock = this.ucLastBlock + 1;
          
          if (blocksBehind > 10) {
            logger.info(`Checking UC block ${toBlock} (${blocksBehind} blocks behind)`);
          }

          // Query Burn events
          const filter = this.ucBridge.filters.Burn();
          const events = await this.ucBridge.queryFilter(filter, toBlock, toBlock);

          if (events.length > 0) {
            logger.info(`🎯 Found ${events.length} burn(s) in block ${toBlock}`);
            
            for (const event of events) {
              await this.handleUcBurn(event);
            }
          }

          this.ucLastBlock = toBlock;
          this.stateManager.setLastUcBlock(toBlock);
          
          // No delay when catching up, 1 second when caught up
          if (blocksBehind <= 1) {
            await this.sleep(1000);
          }
        } else {
          await this.sleep(1000);
        }
      } catch (error) {
        if (error.message.includes('rate limit') || error.message.includes('429')) {
          logger.warn('UC RPC rate limit hit, waiting 10 seconds...');
          await this.sleep(10000);
        } else if (error.message.includes('timeout') || error.message.includes('network')) {
          logger.warn('UC network timeout, retrying...', { error: error.message });
          await this.sleep(2000);
        } else {
          logger.error('Error monitoring UC burns', { error: error.message });
          await this.sleep(5000);
        }
      }
    }
  }

  async handleBscDeposit(event) {
    const startTime = Date.now();
    try {
      const { user, amount, depositId, destinationAddress } = event.args;
      const depositIdStr = depositId.toString();
      const txHash = event.transactionHash;

      // Check if already processed
      if (this.processedDeposits.has(depositIdStr)) {
        logger.debug('Deposit already processed', { depositId: depositIdStr });
        return;
      }

      logger.info('🔔 BSC Deposit detected, waiting for confirmations...', {
        txHash,
        depositId: depositIdStr,
        amount: ethers.formatUnits(amount, 18),
        user,
        destinationAddress
      });

      // STEP 1: Wait for BSC confirmations (~20 seconds for 6 confirmations)
      const requiredConfirmations = 6;
      let currentBlock = await this.bscProvider.getBlockNumber();
      let confirmations = currentBlock - event.blockNumber;

      if (confirmations < requiredConfirmations) {
        const blocksToWait = requiredConfirmations - confirmations;
        const waitTime = blocksToWait * 3000; // 3 seconds per BSC block
        
        logger.info(`⏳ Waiting for ${blocksToWait} more confirmations (~${waitTime/1000}s)`, {
          depositId: depositIdStr,
          currentConfirmations: confirmations,
          requiredConfirmations
        });
        
        await this.sleep(waitTime);
        currentBlock = await this.bscProvider.getBlockNumber();
        confirmations = currentBlock - event.blockNumber;
      }

      // STEP 2: Verify transaction using TX ID
      logger.info('🔍 Verifying transaction on BSC using TX ID...', { txHash });
      const receipt = await this.bscProvider.getTransactionReceipt(txHash);
      
      if (!receipt) {
        logger.error('❌ Transaction receipt not found', { txHash });
        return;
      }

      if (receipt.status !== 1) {
        logger.error('❌ Transaction failed on BSC', { txHash, status: receipt.status });
        return;
      }

      // STEP 3: Re-extract and validate data from verified transaction
      const verifiedEvent = receipt.logs
        .map(log => {
          try {
            return this.bscBridge.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find(e => e && e.name === 'Deposit');

      if (!verifiedEvent) {
        logger.error('❌ Deposit event not found in verified transaction', { txHash });
        return;
      }

      // Validate data matches
      const verifiedData = verifiedEvent.args;
      if (verifiedData.depositId.toString() !== depositIdStr) {
        logger.error('❌ DepositId mismatch in verification', {
          expected: depositIdStr,
          got: verifiedData.depositId.toString()
        });
        return;
      }

      logger.info('✅ Transaction verified on BSC', {
        txHash,
        confirmations,
        depositId: depositIdStr,
        verificationTime: `${Date.now() - startTime}ms`
      });

      // Log verified transaction
      transactionLogger.info('BSC Deposit Verified', {
        direction: 'BSC -> UC',
        sourceChain: 'BSC',
        destinationChain: 'UC',
        user: verifiedData.user,
        destinationAddress: verifiedData.destinationAddress,
        amount: ethers.formatUnits(verifiedData.amount, 18),
        amountRaw: verifiedData.amount.toString(),
        depositId: depositIdStr,
        bscTxHash: txHash,
        blockNumber: receipt.blockNumber,
        confirmations,
        status: 'verified'
      });

      // STEP 4: Calculate 1% fee and net amount
      const originalAmount = verifiedData.amount;
      const feeAmount = originalAmount / 100n; // 1% fee
      const netAmount = originalAmount - feeAmount; // 99% to user

      logger.info('💰 Applying 1% bridge fee...', {
        depositId: depositIdStr,
        originalAmount: ethers.formatUnits(originalAmount, 6),
        feeAmount: ethers.formatUnits(feeAmount, 6),
        netAmount: ethers.formatUnits(netAmount, 6)
      });

      // STEP 5: Sign and submit to UCC with owner wallet (relayer key)
      logger.info('🔐 Signing transaction with owner wallet for UCC...', {
        depositId: depositIdStr,
        recipient: verifiedData.destinationAddress,
        netAmount: ethers.formatUnits(netAmount, 6)
      });

      const tx = await this.ucBridge.mint(
        verifiedData.destinationAddress,  // user address
        netAmount,                        // net amount (after 1% fee)
        verifiedData.depositId             // depositId
      );

      logger.info('✅ Transaction signed and submitted to UCC', { 
        ucTxHash: tx.hash,
        depositId: depositIdStr
      });

      // STEP 5: Wait for UCC confirmation
      const ucReceipt = await tx.wait();
      
      logger.info('✅ UCC transaction confirmed', {
        ucTxHash: ucReceipt.hash,
        blockNumber: ucReceipt.blockNumber,
        gasUsed: ucReceipt.gasUsed.toString(),
        status: ucReceipt.status === 1 ? 'Success' : 'Failed'
      });

      // Mark as processed and save to state
      this.processedDeposits.add(depositIdStr);
      this.stateManager.addProcessedDeposit(depositIdStr);
      this.stateManager.addDepositTxHashes(depositIdStr, txHash, ucReceipt.hash);

      const totalTime = Date.now() - startTime;

      // Log completion
      transactionLogger.info('BSC -> UC Transfer Completed', {
        direction: 'BSC -> UC',
        sourceChain: 'BSC',
        destinationChain: 'UC',
        user: verifiedData.user,
        destinationAddress: verifiedData.destinationAddress,
        originalAmount: ethers.formatUnits(originalAmount, 6),
        feeAmount: ethers.formatUnits(feeAmount, 6),
        netAmount: ethers.formatUnits(netAmount, 6),
        amountRaw: verifiedData.amount.toString(),
        depositId: depositIdStr,
        bscTxHash: txHash,
        ucTxHash: ucReceipt.hash,
        ucBlockNumber: ucReceipt.blockNumber,
        gasUsed: ucReceipt.gasUsed.toString(),
        confirmations,
        status: 'completed',
        completedAt: new Date().toISOString(),
        totalTimeMs: totalTime,
        totalTimeSec: `${(totalTime/1000).toFixed(1)}s`
      });

      logger.info(`🎉 Bridge transfer completed in ${(totalTime/1000).toFixed(1)}s`, {
        depositId: depositIdStr,
        bscTx: txHash,
        ucTx: ucReceipt.hash,
        originalAmount: ethers.formatUnits(originalAmount, 6),
        feeAmount: ethers.formatUnits(feeAmount, 6),
        netAmount: ethers.formatUnits(netAmount, 6)
      });

    } catch (error) {
      logger.error('❌ Error handling BSC deposit', {
        error: error.message,
        stack: error.stack,
        depositId: event.args.depositId.toString(),
        bscTxHash: event.transactionHash,
        timeElapsed: `${(Date.now() - startTime)/1000}s`
      });

      transactionLogger.error('BSC -> UC Transfer Failed', {
        direction: 'BSC -> UC',
        sourceChain: 'BSC',
        destinationChain: 'UC',
        user: event.args.user,
        destinationAddress: event.args.destinationAddress,
        amount: ethers.formatUnits(event.args.amount, 18),
        depositId: event.args.depositId.toString(),
        bscTxHash: event.transactionHash,
        error: error.message,
        status: 'failed',
        failedAt: new Date().toISOString()
      });
    }
  }

  async handleUcBurn(event) {
    const startTime = Date.now();
    try {
      const { user, amount, burnId, destinationAddress } = event.args;
      const burnIdStr = burnId.toString();

      // Check if already processed
      if (this.processedBurns.has(burnIdStr)) {
        logger.debug('Burn already processed', { burnId: burnIdStr });
        return;
      }

      logger.info('🔔 UC Burn detected, waiting for confirmations...', {
        txHash: event.transactionHash,
        burnId: burnIdStr,
        amount: ethers.formatUnits(amount, 18),
        user,
        destinationAddress
      });

      // STEP 1: Wait for UC confirmations (~30 seconds for 6 confirmations)
      const requiredConfirmations = 6;
      let currentBlock = await this.ucProvider.getBlockNumber();
      let confirmations = currentBlock - event.blockNumber;

      if (confirmations < requiredConfirmations) {
        const blocksToWait = requiredConfirmations - confirmations;
        const waitTime = blocksToWait * 5000; // 5 seconds per UC block
        
        logger.info(`⏳ Waiting for ${blocksToWait} more confirmations (~${waitTime/1000}s)`, {
          burnId: burnIdStr,
          currentConfirmations: confirmations,
          requiredConfirmations
        });
        
        await this.sleep(waitTime);
        currentBlock = await this.ucProvider.getBlockNumber();
        confirmations = currentBlock - event.blockNumber;
      }

      // STEP 2: Verify transaction using TX ID
      logger.info('🔍 Verifying transaction on UC Chain using TX ID...', { txHash: event.transactionHash });
      const receipt = await this.ucProvider.getTransactionReceipt(event.transactionHash);
      
      if (!receipt) {
        logger.error('❌ Transaction receipt not found', { txHash: event.transactionHash });
        return;
      }

      if (receipt.status !== 1) {
        logger.error('❌ Transaction failed on UC Chain', { txHash: event.transactionHash, status: receipt.status });
        return;
      }

      logger.info('✅ Transaction verified on UC Chain', {
        txHash: event.transactionHash,
        confirmations,
        burnId: burnIdStr,
        verificationTime: `${Date.now() - startTime}ms`
      });

      // Log verified transaction
      transactionLogger.info('UC Burn Verified', {
        direction: 'UC -> BSC',
        sourceChain: 'UC',
        destinationChain: 'BSC',
        user,
        destinationAddress,
        amount: ethers.formatUnits(amount, 18),
        amountRaw: amount.toString(),
        burnId: burnIdStr,
        ucTxHash: event.transactionHash,
        blockNumber: receipt.blockNumber,
        confirmations,
        status: 'verified'
      });

      // STEP 3: Calculate 1% fee and net amount
      const originalAmount = amount;
      const feeAmount = originalAmount / 100n; // 1% fee
      const netAmount = originalAmount - feeAmount; // 99% to user

      logger.info('💰 Applying 1% bridge fee...', {
        burnId: burnIdStr,
        originalAmount: ethers.formatUnits(originalAmount, 18),
        feeAmount: ethers.formatUnits(feeAmount, 18),
        netAmount: ethers.formatUnits(netAmount, 18)
      });

      // STEP 4: Unlock on BSC with owner wallet (relayer key)
      logger.info('🔐 Signing transaction with owner wallet for BSC...', {
        burnId: burnIdStr,
        recipient: destinationAddress,
        netAmount: ethers.formatUnits(netAmount, 18)
      });

      const tx = await this.bscBridge.unlock(
        destinationAddress,  // recipient address
        netAmount,           // net amount (after 1% fee)
        burnId               // burnId
      );

      logger.info('✅ Transaction signed and submitted to BSC', { 
        bscTxHash: tx.hash,
        burnId: burnIdStr
      });

      // STEP 4: Wait for BSC confirmation
      const bscReceipt = await tx.wait();
      
      logger.info('✅ BSC transaction confirmed', {
        bscTxHash: bscReceipt.hash,
        blockNumber: bscReceipt.blockNumber,
        gasUsed: bscReceipt.gasUsed.toString(),
        status: bscReceipt.status === 1 ? 'Success' : 'Failed'
      });

      // Mark as processed and save to state
      this.processedBurns.add(burnIdStr);
      this.stateManager.addProcessedBurn(burnIdStr);
      this.stateManager.addBurnTxHashes(burnIdStr, event.transactionHash, bscReceipt.hash);

      const totalTime = Date.now() - startTime;

      // Log completion
      transactionLogger.info('UC -> BSC Transfer Completed', {
        direction: 'UC -> BSC',
        sourceChain: 'UC',
        destinationChain: 'BSC',
        user,
        destinationAddress,
        originalAmount: ethers.formatUnits(originalAmount, 18),
        feeAmount: ethers.formatUnits(feeAmount, 18),
        netAmount: ethers.formatUnits(netAmount, 18),
        amountRaw: amount.toString(),
        burnId: burnIdStr,
        ucTxHash: event.transactionHash,
        bscTxHash: bscReceipt.hash,
        bscBlockNumber: bscReceipt.blockNumber,
        gasUsed: bscReceipt.gasUsed.toString(),
        confirmations,
        status: 'completed',
        completedAt: new Date().toISOString(),
        totalTimeMs: totalTime,
        totalTimeSec: `${(totalTime/1000).toFixed(1)}s`
      });

      logger.info(`🎉 Bridge transfer completed in ${(totalTime/1000).toFixed(1)}s`, {
        burnId: burnIdStr,
        ucTx: event.transactionHash,
        bscTx: bscReceipt.hash,
        originalAmount: ethers.formatUnits(originalAmount, 18),
        feeAmount: ethers.formatUnits(feeAmount, 18),
        netAmount: ethers.formatUnits(netAmount, 18)
      });

    } catch (error) {
      logger.error('❌ Error handling UC burn', {
        error: error.message,
        stack: error.stack,
        burnId: event.args.burnId.toString(),
        ucTxHash: event.transactionHash,
        timeElapsed: `${(Date.now() - startTime)/1000}s`
      });

      transactionLogger.error('UC -> BSC Transfer Failed', {
        direction: 'UC -> BSC',
        sourceChain: 'UC',
        destinationChain: 'BSC',
        user: event.args.user,
        destinationAddress: event.args.destinationAddress,
        amount: ethers.formatUnits(event.args.amount, 18),
        burnId: event.args.burnId.toString(),
        ucTxHash: event.transactionHash,
        error: error.message,
        status: 'failed',
        failedAt: new Date().toISOString()
      });
    }
  }

  stop() {
    logger.info('Stopping relayer service...');
    this.isRunning = false;
    
    // Remove WebSocket listeners
    if (this.bscBridge) {
      this.bscBridge.removeAllListeners();
    }
    if (this.ucBridge) {
      this.ucBridge.removeAllListeners();
    }
  }

  // WebSocket reconnection disabled - using polling only for reliability

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default BridgeRelayer;
