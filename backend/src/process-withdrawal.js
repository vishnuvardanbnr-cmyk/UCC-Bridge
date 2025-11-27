#!/usr/bin/env node

/**
 * Process UC Withdrawal by Transaction Hash
 * Called by frontend after user withdraws USDT from UC
 */

import { ethers } from 'ethers';
import { config } from './config.js';
import { BSC_BRIDGE_ABI, UC_BRIDGE_ABI } from './abis.js';
import logger, { transactionLogger } from './logger.js';
import { StateManager } from './state.js';

const stateManager = new StateManager();

export async function processWithdrawalByTxHash(ucTxHash) {
  const startTime = Date.now();

  try {
    logger.info('🎯 Processing UC withdrawal by transaction hash', { ucTxHash });

    // Setup providers
    const bscProvider = new ethers.JsonRpcProvider(config.bscRpcUrl);
    const ucProvider = new ethers.JsonRpcProvider(config.ucRpcUrl);
    const relayerWallet = new ethers.Wallet(config.relayerPrivateKey);
    const bscWallet = relayerWallet.connect(bscProvider);

    // Setup contracts
    const bscBridge = new ethers.Contract(config.bscBridgeAddress, BSC_BRIDGE_ABI, bscWallet);
    const ucBridge = new ethers.Contract(config.ucBridgeAddress, UC_BRIDGE_ABI, ucProvider);

    // STEP 1: Get transaction receipt
    logger.info('🔍 Fetching transaction receipt...', { ucTxHash });
    const receipt = await ucProvider.getTransactionReceipt(ucTxHash);

    if (!receipt) {
      throw new Error('Transaction receipt not found');
    }

    if (receipt.status !== 1) {
      throw new Error('Transaction failed on UC');
    }

    // STEP 2: Parse Burn event from logs
    logger.info('📋 Parsing burn event from transaction logs...');
    const burnEvent = receipt.logs
      .map(log => {
        try {
          return ucBridge.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find(e => e && e.name === 'Burn');

    if (!burnEvent) {
      throw new Error('Burn event not found in transaction');
    }

    const { user, amount, burnId, destinationAddress } = burnEvent.args;
    const burnIdStr = burnId.toString();

    logger.info('✅ Burn event parsed', {
      user,
      amount: ethers.formatUnits(amount, 18),
      burnId: burnIdStr,
      destinationAddress,
      blockNumber: receipt.blockNumber
    });

    // STEP 3: Check if already processed
    if (stateManager.isBurnProcessed(burnIdStr)) {
      logger.warn('Burn already processed', { burnId: burnIdStr });
      return { success: false, message: 'Withdrawal already processed' };
    }

    // STEP 4: Wait for confirmations
    const requiredConfirmations = 6;
    let currentBlock = await ucProvider.getBlockNumber();
    let confirmations = currentBlock - receipt.blockNumber;

    if (confirmations < requiredConfirmations) {
      const blocksToWait = requiredConfirmations - confirmations;
      const waitTime = blocksToWait * 5000; // 5 seconds per UC block

      logger.info(`⏳ Waiting for ${blocksToWait} more confirmations (~${waitTime/1000}s)`);
      await new Promise(resolve => setTimeout(resolve, waitTime));

      currentBlock = await ucProvider.getBlockNumber();
      confirmations = currentBlock - receipt.blockNumber;
    }

    logger.info('✅ Transaction confirmed on UC', {
      confirmations,
      blockNumber: receipt.blockNumber
    });

    // STEP 5: Log verified transaction
    transactionLogger.info('UC Burn Verified (by hash)', {
      direction: 'UC -> BSC',
      sourceChain: 'UC',
      destinationChain: 'BSC',
      user,
      destinationAddress,
      amount: ethers.formatUnits(amount, 18),
      amountRaw: amount.toString(),
      burnId: burnIdStr,
      ucTxHash,
      blockNumber: receipt.blockNumber,
      confirmations,
      status: 'verified'
    });

    // STEP 6: Calculate 1% fee and net amount
    const originalAmount = amount;
    const feeAmount = originalAmount / 100n; // 1% fee
    const netAmount = originalAmount - feeAmount; // 99% to user

    logger.info('💰 Applying 1% bridge fee...', {
      burnId: burnIdStr,
      originalAmount: ethers.formatUnits(originalAmount, 18),
      feeAmount: ethers.formatUnits(feeAmount, 18),
      netAmount: ethers.formatUnits(netAmount, 18)
    });

    // STEP 7: Unlock on BSC with net amount (after 1% fee)
    logger.info('🔐 Unlocking USDT on BSC chain...', {
      recipient: destinationAddress,
      netAmount: ethers.formatUnits(netAmount, 18),
      originalAmount: ethers.formatUnits(originalAmount, 18),
      feeAmount: ethers.formatUnits(feeAmount, 18),
      ucAmountRaw: amount.toString(),
      bscAmountRaw: netAmount.toString()
    });

    const unlockTx = await bscBridge.unlock(
      destinationAddress,  // recipient address
      netAmount,           // net amount (after 1% fee)
      burnId               // burnId
    );

    logger.info('✅ Unlock transaction submitted', { bscTxHash: unlockTx.hash });

    // STEP 7: Wait for BSC confirmation
    const bscReceipt = await unlockTx.wait();

    logger.info('✅ Unlock transaction confirmed', {
      bscTxHash: bscReceipt.hash,
      blockNumber: bscReceipt.blockNumber,
      gasUsed: bscReceipt.gasUsed.toString()
    });

    // STEP 8: Mark as processed and save state
    stateManager.addProcessedBurn(burnIdStr);
    stateManager.addBurnTxHashes(burnIdStr, ucTxHash, bscReceipt.hash);

    const totalTime = Date.now() - startTime;

    // STEP 9: Log completion
    transactionLogger.info('UC -> BSC Transfer Completed (by hash)', {
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
      ucTxHash,
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
      ucTx: ucTxHash,
      bscTx: bscReceipt.hash,
      originalAmount: ethers.formatUnits(originalAmount, 18),
      feeAmount: ethers.formatUnits(feeAmount, 18),
      netAmount: ethers.formatUnits(netAmount, 18)
    });

    return {
      success: true,
      burnId: burnIdStr,
      ucTxHash,
      bscTxHash: bscReceipt.hash,
      amount: ethers.formatUnits(netAmount, 18), // Return net amount received
      originalAmount: ethers.formatUnits(originalAmount, 18),
      feeAmount: ethers.formatUnits(feeAmount, 18),
      recipient: destinationAddress,
      totalTime: `${(totalTime/1000).toFixed(1)}s`
    };

  } catch (error) {
    logger.error('❌ Error processing withdrawal by hash', {
      error: error.message,
      stack: error.stack,
      ucTxHash,
      timeElapsed: `${(Date.now() - startTime)/1000}s`
    });

    transactionLogger.error('UC -> BSC Transfer Failed (by hash)', {
      direction: 'UC -> BSC',
      sourceChain: 'UC',
      destinationChain: 'BSC',
      ucTxHash,
      error: error.message,
      status: 'failed',
      failedAt: new Date().toISOString()
    });

    return {
      success: false,
      error: error.message,
      ucTxHash
    };
  }
}

// CLI usage for testing
if (import.meta.url === `file://${process.argv[1]}`) {
  const txHash = process.argv[2];
  if (!txHash) {
    console.error('Usage: node process-withdrawal.js <uc_tx_hash>');
    process.exit(1);
  }

  processWithdrawalByTxHash(txHash).then(result => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  });
}