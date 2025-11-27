#!/usr/bin/env node

/**
 * Check relayer wallet permissions on bridge contracts
 */

import { ethers } from 'ethers';
import { config } from './src/config.js';
import { BSC_BRIDGE_ABI, UC_BRIDGE_ABI } from './src/abis.js';

async function checkPermissions() {
  console.log('🔐 Checking relayer permissions...\n');

  // Derive relayer address
  const relayerWallet = new ethers.Wallet(config.relayerPrivateKey);
  const relayerAddress = relayerWallet.address;
  console.log(`👤 Relayer Address: ${relayerAddress}\n`);

  // Check BSC Bridge
  console.log('🏦 BSC Bridge Permissions:');
  const bscProvider = new ethers.JsonRpcProvider(config.bscRpcUrl);
  const bscBridge = new ethers.Contract(config.bscBridgeAddress, BSC_BRIDGE_ABI, bscProvider);

  try {
    const bscOwner = await bscBridge.owner();
    console.log(`   Owner: ${bscOwner}`);
    console.log(`   ✅ Relayer is owner: ${bscOwner.toLowerCase() === relayerAddress.toLowerCase()}`);
  } catch (error) {
    console.log(`   ❌ Error checking BSC owner: ${error.message}`);
  }

  // Check UC Bridge
  console.log('\n🌌 UC Bridge Permissions:');
  const ucProvider = new ethers.JsonRpcProvider(config.ucRpcUrl);
  const ucBridge = new ethers.Contract(config.ucBridgeAddress, UC_BRIDGE_ABI, ucProvider);

  try {
    const ucOwner = await ucBridge.owner();
    console.log(`   Owner: ${ucOwner}`);
    console.log(`   ✅ Relayer is owner: ${ucOwner.toLowerCase() === relayerAddress.toLowerCase()}`);
  } catch (error) {
    console.log(`   ❌ Error checking UC owner: ${error.message}`);
  }

  // Check balances
  console.log('\n💰 Wallet Balances:');
  try {
    const bscBalance = await bscProvider.getBalance(relayerAddress);
    console.log(`   BSC: ${ethers.formatEther(bscBalance)} BNB`);
  } catch (error) {
    console.log(`   ❌ BSC balance error: ${error.message}`);
  }

  try {
    const ucBalance = await ucProvider.getBalance(relayerAddress);
    console.log(`   UC: ${ethers.formatEther(ucBalance)} UC`);
  } catch (error) {
    console.log(`   ❌ UC balance error: ${error.message}`);
  }
}

checkPermissions().catch(console.error);