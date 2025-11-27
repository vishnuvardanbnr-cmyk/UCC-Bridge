#!/usr/bin/env node

/**
 * Debug script to check BSC deposit events
 */

import { ethers } from 'ethers';
import { BSC_BRIDGE_ABI } from './src/abis.js';

// Hardcoded for debugging
const BSC_RPC_URL = 'https://bsc-dataseed.binance.org';
const BSC_BRIDGE_ADDRESS = '0xE4363F8FbD39FB0930772644Ebd14597e5756986';

async function checkRecentDeposits() {
  console.log('🔍 Checking recent BSC deposit events...\n');

  const provider = new ethers.JsonRpcProvider(BSC_RPC_URL);
  const bridge = new ethers.Contract(BSC_BRIDGE_ADDRESS, BSC_BRIDGE_ABI, provider);

  try {
    const currentBlock = await provider.getBlockNumber();
    console.log(`📊 Current BSC block: ${currentBlock}`);

    // Check last 1 block for deposits (to avoid rate limits)
    const fromBlock = currentBlock - 1;
    console.log(`🔎 Scanning blocks ${fromBlock} to ${currentBlock}...\n`);

    const filter = bridge.filters.Deposit();
    const events = await bridge.queryFilter(filter, fromBlock, currentBlock);

    if (events.length === 0) {
      console.log('❌ No deposit events found in the last 100 blocks');
      console.log('\n💡 This could mean:');
      console.log('   - No deposits have been made recently');
      console.log('   - Wrong contract address');
      console.log('   - RPC issues');
      return;
    }

    console.log(`✅ Found ${events.length} deposit event(s):\n`);

    for (const event of events) {
      const { user, amount, depositId, destinationAddress } = event.args;
      const block = await provider.getBlock(event.blockNumber);

      console.log(`🔔 Deposit #${depositId.toString()}`);
      console.log(`   User: ${user}`);
      console.log(`   Amount: ${ethers.formatUnits(amount, 18)} USDT`);
      console.log(`   Destination: ${destinationAddress}`);
      console.log(`   Block: ${event.blockNumber} (${new Date(block.timestamp * 1000).toLocaleString()})`);
      console.log(`   TxHash: ${event.transactionHash}`);
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error checking events:', error.message);
  }
}

async function checkContractState() {
  console.log('🔍 Checking contract state...\n');

  const provider = new ethers.JsonRpcProvider(BSC_RPC_URL);
  const bridge = new ethers.Contract(BSC_BRIDGE_ADDRESS, BSC_BRIDGE_ABI, provider);

  try {
    const totalTx = await bridge.getTotalTransactions();
    console.log(`📊 Total transactions: ${totalTx}`);

    // Get recent transactions
    const timeRange = 86400 * 7; // 7 days
    const txs = await bridge.getUserTransactionsByTimeRange(
      '0x0000000000000000000000000000000000000000', // zero address to get all
      timeRange
    );

    console.log(`📋 Recent transactions (${txs.length}):`);
    for (const tx of txs.slice(-5)) { // Show last 5
      console.log(`   ${tx.transactionType}: ${ethers.formatUnits(tx.amount, 18)} USDT`);
    }

  } catch (error) {
    console.error('❌ Error checking contract state:', error.message);
  }
}

async function main() {
  console.log('🚀 BSC Bridge Event Debugger\n');

  await checkContractState();
  console.log('');
  await checkRecentDeposits();
}

main().catch(console.error);