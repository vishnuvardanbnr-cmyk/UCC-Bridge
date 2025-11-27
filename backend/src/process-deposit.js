#!/usr/bin/env node

/**
 * Process BSC Deposit by Transaction Hash
 * Called by frontend after user deposits USDT
 */

import { ethers } from 'ethers';
import { config } from './config.js';
import { BSC_BRIDGE_ABI, UC_BRIDGE_ABI } from './abis.js';
import logger, { transactionLogger } from './logger.js';
import { StateManager } from './state.js';

const stateManager = new StateManager();

export async function processDepositByTxHash(bscTxHash) {
  const startTime = Date.now();

  try {
    logger.info('🎯 Processing BSC deposit by transaction hash', { bscTxHash });

    // Setup providers
    const bscProvider = new ethers.JsonRpcProvider(config.bscRpcUrl);
    const ucProvider = new ethers.JsonRpcProvider(config.ucRpcUrl);
    const relayerWallet = new ethers.Wallet(config.relayerPrivateKey);
    const ucWallet = relayerWallet.connect(ucProvider);

    // Setup contracts
    const bscBridge = new ethers.Contract(config.bscBridgeAddress, BSC_BRIDGE_ABI, bscProvider);
    const ucBridge = new ethers.Contract(config.ucBridgeAddress, UC_BRIDGE_ABI, ucWallet);

    // STEP 1: Get transaction receipt
    logger.info('🔍 Fetching transaction receipt...', { bscTxHash });
    const receipt = await bscProvider.getTransactionReceipt(bscTxHash);

    if (!receipt) {
      throw new Error('Transaction receipt not found');
    }

    if (receipt.status !== 1) {
      throw new Error('Transaction failed on BSC');
    }

    // STEP 2: Parse Deposit event from logs
    logger.info('📋 Parsing deposit event from transaction logs...');
    const depositEvent = receipt.logs
      .map(log => {
        try {
          return bscBridge.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find(e => e && e.name === 'Deposit');

    if (!depositEvent) {
      throw new Error('Deposit event not found in transaction');
    }

    const { user, amount, depositId, destinationAddress } = depositEvent.args;
    const depositIdStr = depositId.toString();

    logger.info('✅ Deposit event parsed', {
      user,
      amount: ethers.formatUnits(amount, 18),
      depositId: depositIdStr,
      destinationAddress,
      blockNumber: receipt.blockNumber
    });

    // STEP 3: Check if already processed
    if (stateManager.isDepositProcessed(depositIdStr)) {
      logger.warn('Deposit already processed', { depositId: depositIdStr });
      return { success: false, message: 'Deposit already processed' };
    }

    // STEP 4: Wait for confirmations
    const requiredConfirmations = 6;
    let currentBlock = await bscProvider.getBlockNumber();
    let confirmations = currentBlock - receipt.blockNumber;

    if (confirmations < requiredConfirmations) {
      const blocksToWait = requiredConfirmations - confirmations;
      const waitTime = blocksToWait * 3000; // 3 seconds per BSC block

      logger.info(`⏳ Waiting for ${blocksToWait} more confirmations (~${waitTime/1000}s)`);
      await new Promise(resolve => setTimeout(resolve, waitTime));

      currentBlock = await bscProvider.getBlockNumber();
      confirmations = currentBlock - receipt.blockNumber;
    }

    logger.info('✅ Transaction confirmed on BSC', {
      confirmations,
      blockNumber: receipt.blockNumber
    });

    // STEP 5: Log verified transaction
    transactionLogger.info('BSC Deposit Verified (by hash)', {
      direction: 'BSC -> UC',
      sourceChain: 'BSC',
      destinationChain: 'UC',
      user,
      destinationAddress,
      amount: ethers.formatUnits(amount, 18),
      amountRaw: amount.toString(),
      depositId: depositIdStr,
      bscTxHash,
      blockNumber: receipt.blockNumber,
      confirmations,
      status: 'verified'
    });

    // STEP 6: Calculate 1% fee and net amount
    const originalAmount = amount;
    const feeAmount = originalAmount / 100n; // 1% fee
    const netAmount = originalAmount - feeAmount; // 99% to user

    logger.info('💰 Applying 1% bridge fee...', {
      depositId: depositIdStr,
      originalAmount: ethers.formatUnits(originalAmount, 18),
      feeAmount: ethers.formatUnits(feeAmount, 18),
      netAmount: ethers.formatUnits(netAmount, 18)
    });

    // STEP 7: Mint on UC with net amount (after 1% fee)
    logger.info('🔐 Minting USDT on UC chain...', {
      recipient: destinationAddress,
      netAmount: ethers.formatUnits(netAmount, 18),
      originalAmount: ethers.formatUnits(originalAmount, 18),
      feeAmount: ethers.formatUnits(feeAmount, 18),
      bscAmountRaw: amount.toString(),
      ucAmountRaw: netAmount.toString()
    });

    const mintTx = await ucBridge.mint(
      destinationAddress,  // user address
      netAmount,           // net amount (after 1% fee)
      depositId            // depositId
    );

    logger.info('✅ Mint transaction submitted', { ucTxHash: mintTx.hash });

    // STEP 7: Wait for UC confirmation
    const ucReceipt = await mintTx.wait();

    logger.info('✅ Mint transaction confirmed', {
      ucTxHash: ucReceipt.hash,
      blockNumber: ucReceipt.blockNumber,
      gasUsed: ucReceipt.gasUsed.toString()
    });

    // STEP 8: Mark as processed and save state
    stateManager.addProcessedDeposit(depositIdStr);
    stateManager.addDepositTxHashes(depositIdStr, bscTxHash, ucReceipt.hash);

    const totalTime = Date.now() - startTime;

    // STEP 9: Log completion
    transactionLogger.info('BSC -> UC Transfer Completed (by hash)', {
      direction: 'BSC -> UC',
      sourceChain: 'BSC',
      destinationChain: 'UC',
      user,
      destinationAddress,
      originalAmount: ethers.formatUnits(originalAmount, 18),
      feeAmount: ethers.formatUnits(feeAmount, 18),
      netAmount: ethers.formatUnits(netAmount, 18),
      amountRaw: amount.toString(),
      depositId: depositIdStr,
      bscTxHash,
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
      bscTx: bscTxHash,
      ucTx: ucReceipt.hash,
      originalAmount: ethers.formatUnits(originalAmount, 18),
      feeAmount: ethers.formatUnits(feeAmount, 18),
      netAmount: ethers.formatUnits(netAmount, 18)
    });

    return {
      success: true,
      depositId: depositIdStr,
      bscTxHash,
      ucTxHash: ucReceipt.hash,
      amount: ethers.formatUnits(netAmount, 18), // Return net amount received
      originalAmount: ethers.formatUnits(originalAmount, 18),
      feeAmount: ethers.formatUnits(feeAmount, 18),
      recipient: destinationAddress,
      totalTime: `${(totalTime/1000).toFixed(1)}s`
    };

  } catch (error) {
    logger.error('❌ Error processing deposit by hash', {
      error: error.message,
      stack: error.stack,
      bscTxHash,
      timeElapsed: `${(Date.now() - startTime)/1000}s`
    });

    transactionLogger.error('BSC -> UC Transfer Failed (by hash)', {
      direction: 'BSC -> UC',
      sourceChain: 'BSC',
      destinationChain: 'UC',
      user: event?.args?.user || 'unknown',
      destinationAddress: event?.args?.destinationAddress || 'unknown',
      amount: event?.args ? ethers.formatUnits(event.args.amount, 18) : 'unknown',
      depositId: event?.args?.depositId.toString() || 'unknown',
      bscTxHash,
      error: error.message,
      status: 'failed',
      failedAt: new Date().toISOString()
    });

    return {
      success: false,
      error: error.message,
      bscTxHash
    };
  }
}

// CLI usage for testing
if (import.meta.url === `file://${process.argv[1]}`) {
  const txHash = process.argv[2];
  if (!txHash) {
    console.error('Usage: node process-deposit.js <bsc_tx_hash>');
    process.exit(1);
  }

  processDepositByTxHash(txHash).then(result => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  });
}