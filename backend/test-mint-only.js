#!/usr/bin/env node

/**
 * Test Minting Only - Safety Test
 * Tests minting using existing deposit IDs without making new deposits
 */

import { ethers } from 'ethers';
import { config } from './src/config.js';
import { UC_BRIDGE_ABI } from './src/abis.js';

async function testMintWithDepositId(depositId, testName) {
  console.log(`\n🧪 ${testName}`);
  console.log(`Deposit ID: ${depositId}`);

  try {
    // Setup UC provider and wallet
    const ucProvider = new ethers.JsonRpcProvider(config.ucRpcUrl);
    const wallet = new ethers.Wallet(config.relayerPrivateKey, ucProvider);
    const ucBridge = new ethers.Contract(config.ucBridgeAddress, UC_BRIDGE_ABI, wallet);

    console.log(`📍 Wallet: ${wallet.address}`);
    console.log('🔍 Attempting to mint with same parameters as original transaction...');

    // Try to mint with EXACT same parameters as the original successful transaction
    // This should be rejected by the contract's duplicate prevention
    try {
      const tx = await ucBridge.mint(
        wallet.address,  // Same recipient as original
        ethers.parseUnits('10', 18), // Same amount (10 USDT)
        depositId // Same depositId
      );

      console.log('📤 Mint transaction submitted to UC chain');
      console.log(`   TX: ${tx.hash}`);

      // Wait for confirmation
      const receipt = await tx.wait();
      console.log('✅ Mint transaction confirmed');
      console.log(`   Block: ${receipt.blockNumber}`);
      console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);

      // Check if USDT balance increased
      const usdtAddress = await ucBridge.getUSDTAddress();
      const usdtContract = new ethers.Contract(usdtAddress, [
        "function balanceOf(address) view returns (uint256)"
      ], ucProvider);

      const balance = await usdtContract.balanceOf(wallet.address);
      console.log(`   USDT Balance: ${ethers.formatUnits(balance, 18)}`);

      return {
        success: false,
        error: 'SECURITY BREACH: Duplicate minting allowed!',
        txHash: tx.hash,
        blockNumber: receipt.blockNumber
      };

    } catch (error) {
      if (error.message.includes('already processed') ||
          error.message.includes('Mint already processed') ||
          error.message.includes('revert')) {
        console.log('🛡️ SECURITY OK: Duplicate mint correctly rejected');
        console.log('   Contract properly prevents double-spending');
        return { success: true, error: null };
      } else {
        console.log('❌ UNEXPECTED ERROR:', error.message);
        return { success: false, error: error.message };
      }
    }

  } catch (error) {
    console.log('❌ Test failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function runMintSafetyTests() {
  console.log('🛡️ USDT Bridge - Mint Safety Test');
  console.log('====================================');
  console.log('Testing minting with existing deposit IDs (should fail safely)');

  // Deposit IDs from previous successful tests
  const depositIds = [
    '0x4c5bf3ed88f2ca97c3e21291c64981529d737b669620e1badf815a20591bdb79', // Test 1
    '0xf0650cae506d75e0864432b2e6ddd8acdc0c89501b8adda4f1ae13582c026ec8', // Test 2
    '0xbcfca4fb69c68a297d8e6a68e911f8e87237098a8420ce78c853c631ab26af40'  // Test 3
  ];

  const results = [];
  let passedTests = 0;
  let failedTests = 0;

  for (let i = 0; i < depositIds.length; i++) {
    const result = await testMintWithDepositId(depositIds[i], `Test ${i + 1}`);
    results.push(result);

    if (result.success) {
      passedTests++;
    } else {
      failedTests++;
    }
  }

  // Summary
  console.log('\n📊 SAFETY TEST SUMMARY');
  console.log('=======================');
  results.forEach((result, index) => {
    console.log(`Test ${index + 1}: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
  });
  console.log(`\nTotal: ${passedTests} passed, ${failedTests} failed`);

  if (failedTests === 0) {
    console.log('\n🛡️ SAFETY TEST PASSED: All deposit IDs correctly rejected duplicate minting');
    console.log('   This confirms the bridge prevents double-spending and replay attacks.');
  } else {
    console.log('\n⚠️ SAFETY TEST FAILED: Some tests did not behave as expected');
  }

  return { passedTests, failedTests };
}

// CLI usage
if (process.argv[1].endsWith('test-mint-only.js')) {
  console.log('⚠️ WARNING: This is a safety test for minting logic.');
  console.log('It will attempt to mint using existing deposit IDs (should fail safely).');
  console.log('Starting test in 3 seconds...');

  // Give user time to cancel
  await new Promise(resolve => setTimeout(resolve, 3000));
  await runMintSafetyTests();
}