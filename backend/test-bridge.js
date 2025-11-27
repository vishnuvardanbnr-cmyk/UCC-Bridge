#!/usr/bin/env node

/**
 * Test Bridge System with Real Deposits
 * Makes BSC deposits and verifies UC minting
 */

import { ethers } from 'ethers';
import { config } from './src/config.js';
import { BSC_BRIDGE_ABI, USDT_ABI } from './src/abis.js';
import { processDepositByTxHash } from './src/process-deposit.js';

async function makeDeposit(privateKey, amount) {
  console.log(`\n🪙 Making ${amount} USDT deposit from BSC to UC...`);

  // Setup wallet and providers
  const bscProvider = new ethers.JsonRpcProvider(config.bscRpcUrl);
  const wallet = new ethers.Wallet(privateKey, bscProvider);

  console.log(`📍 Wallet: ${wallet.address}`);

  // Setup contracts
  const usdtContract = new ethers.Contract(config.bscUsdtAddress, USDT_ABI, wallet);
  const bridgeContract = new ethers.Contract(config.bscBridgeAddress, BSC_BRIDGE_ABI, wallet);

  // Check balances
  const usdtBalance = await usdtContract.balanceOf(wallet.address);
  const bnbBalance = await bscProvider.getBalance(wallet.address);

  console.log(`💰 USDT Balance: ${ethers.formatUnits(usdtBalance, 18)}`);
  console.log(`⛽ BNB Balance: ${ethers.formatEther(bnbBalance)}`);

  // Check allowance
  const allowance = await usdtContract.allowance(wallet.address, config.bscBridgeAddress);
  console.log(`✅ Allowance: ${ethers.formatUnits(allowance, 18)}`);

  // Approve if needed
  const amountWei = ethers.parseUnits(amount.toString(), 18);
  if (allowance < amountWei) {
    console.log('🔓 Approving USDT...');
    const approveTx = await usdtContract.approve(config.bscBridgeAddress, amountWei);
    await approveTx.wait();
    console.log('✅ Approval confirmed');
  }

  // Make deposit
  console.log('🚀 Making deposit...');
  const depositTx = await bridgeContract.deposit(amountWei, wallet.address);
  console.log(`📤 Deposit TX: ${depositTx.hash}`);

  // Wait for confirmation
  const receipt = await depositTx.wait();
  console.log(`✅ Deposit confirmed in block ${receipt.blockNumber}`);

  return depositTx.hash;
}

async function testBridgeSystem(testPrivateKey) {
  console.log('🧪 Testing USDT Bridge System');
  console.log('==============================');

  const results = [];
  let passedTests = 0;
  let failedTests = 0;

  try {
    // Test 1: 10 USDT deposit
    console.log('\n📋 TEST 1: 10 USDT Deposit from BSC to UC');
    const txHash1 = await makeDeposit(testPrivateKey, 10);

    console.log('\n🔄 Processing with backend...');
    const result1 = await processDepositByTxHash(txHash1);

    if (result1.success) {
      console.log('✅ Backend processing successful!');
      console.log(`   UC TX: ${result1.ucTxHash}`);
      console.log(`   Amount: ${result1.amount} USDT`);
      console.log(`   Time: ${result1.totalTime}`);
      passedTests++;
    } else {
      console.log('❌ Backend processing failed:', result1.error);
      failedTests++;
    }

    results.push({ test: 1, success: result1.success });

    // Wait before next test
    console.log('\n⏳ Waiting 30 seconds before next test...');
    await new Promise(resolve => setTimeout(resolve, 30000));

    // Test 2: Another 10 USDT deposit
    console.log('\n📋 TEST 2: 10 USDT Deposit from BSC to UC');
    const txHash2 = await makeDeposit(testPrivateKey, 10);

    console.log('\n🔄 Processing with backend...');
    const result2 = await processDepositByTxHash(txHash2);

    if (result2.success) {
      console.log('✅ Backend processing successful!');
      console.log(`   UC TX: ${result2.ucTxHash}`);
      console.log(`   Amount: ${result2.amount} USDT`);
      console.log(`   Time: ${result2.totalTime}`);
      passedTests++;
    } else {
      console.log('❌ Backend processing failed:', result2.error);
      failedTests++;
    }

    results.push({ test: 2, success: result2.success });

    // Wait before next test
    console.log('\n⏳ Waiting 30 seconds before next test...');
    await new Promise(resolve => setTimeout(resolve, 30000));

    // Test 3: Another 10 USDT deposit
    console.log('\n📋 TEST 3: 10 USDT Deposit from BSC to UC');
    const txHash3 = await makeDeposit(testPrivateKey, 10);

    console.log('\n🔄 Processing with backend...');
    const result3 = await processDepositByTxHash(txHash3);

    if (result3.success) {
      console.log('✅ Backend processing successful!');
      console.log(`   UC TX: ${result3.ucTxHash}`);
      console.log(`   Amount: ${result3.amount} USDT`);
      console.log(`   Time: ${result3.totalTime}`);
      passedTests++;
    } else {
      console.log('❌ Backend processing failed:', result3.error);
      failedTests++;
    }

    results.push({ test: 3, success: result3.success });

    // Summary
    console.log('\n📊 TEST SUMMARY');
    console.log('===============');
    results.forEach(r => {
      console.log(`Test ${r.test}: ${r.success ? '✅ PASSED' : '❌ FAILED'}`);
    });
    console.log(`\nTotal: ${passedTests} passed, ${failedTests} failed`);

    if (failedTests === 0) {
      console.log('\n🎉 ALL TESTS PASSED! Bridge system working correctly with 10 USDT × 3 tests.');
    } else {
      console.log(`\n⚠️ ${failedTests} test(s) failed. Check the issues above.`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// CLI usage - check if we have a private key argument
const privateKey = process.argv[2];
if (privateKey) {
  console.log('⚠️ WARNING: This script will make real blockchain transactions!');
  console.log('Make sure you have sufficient USDT and BNB in the wallet.');
  console.log('Starting test in 3 seconds...');

  // Give user time to cancel
  await new Promise(resolve => setTimeout(resolve, 3000));
  await testBridgeSystem(privateKey);
} else {
  console.log('Usage: node test-bridge.js <private_key>');
  console.log('WARNING: This will spend real USDT and BNB!');
  process.exit(1);
}