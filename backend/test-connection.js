#!/usr/bin/env node

/**
 * USDT Bridge - Connection Test
 * Tests RPC connections, contract accessibility, and basic functionality
 */

import { ethers } from 'ethers';
import { config } from './src/config.js';
import { BSC_BRIDGE_ABI, UC_BRIDGE_ABI, USDT_ABI } from './src/abis.js';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  section: (msg) => console.log(`\n${colors.cyan}━━━ ${msg} ━━━${colors.reset}`)
};

let testsPassed = 0;
let testsFailed = 0;

async function test(name, fn) {
  try {
    await fn();
    log.success(name);
    testsPassed++;
    return true;
  } catch (error) {
    log.error(`${name}: ${error.message}`);
    testsFailed++;
    return false;
  }
}

async function testBSCConnection() {
  log.section('Testing BSC Connection');
  
  await test('Connect to BSC RPC', async () => {
    const provider = new ethers.JsonRpcProvider(config.bscRpcUrl);
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== 56) {
      throw new Error(`Expected chain ID 56, got ${network.chainId}`);
    }
    log.info(`  Chain ID: ${network.chainId}`);
  });

  await test('Get BSC block number', async () => {
    const provider = new ethers.JsonRpcProvider(config.bscRpcUrl);
    const blockNumber = await provider.getBlockNumber();
    log.info(`  Current block: ${blockNumber}`);
    if (blockNumber < 1000) {
      throw new Error('Block number too low');
    }
  });

  await test('Connect to BSC Bridge contract', async () => {
    const provider = new ethers.JsonRpcProvider(config.bscRpcUrl);
    const bridge = new ethers.Contract(config.bscBridgeAddress, BSC_BRIDGE_ABI, provider);
    const code = await provider.getCode(config.bscBridgeAddress);
    if (code === '0x') {
      throw new Error('No contract code at BSC bridge address');
    }
    log.info(`  Contract deployed: ${config.bscBridgeAddress}`);
  });

  await test('Connect to BSC USDT contract', async () => {
    const provider = new ethers.JsonRpcProvider(config.bscRpcUrl);
    const usdt = new ethers.Contract(config.bscUsdtAddress, USDT_ABI, provider);
    const code = await provider.getCode(config.bscUsdtAddress);
    if (code === '0x') {
      throw new Error('No contract code at BSC USDT address');
    }
    log.info(`  Contract deployed: ${config.bscUsdtAddress}`);
  });
}

async function testUCConnection() {
  log.section('Testing Universe Chain Connection');
  
  await test('Connect to UC RPC', async () => {
    const provider = new ethers.JsonRpcProvider(config.ucRpcUrl);
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== 1137) {
      throw new Error(`Expected chain ID 1137, got ${network.chainId}`);
    }
    log.info(`  Chain ID: ${network.chainId}`);
  });

  await test('Get UC block number', async () => {
    const provider = new ethers.JsonRpcProvider(config.ucRpcUrl);
    const blockNumber = await provider.getBlockNumber();
    log.info(`  Current block: ${blockNumber}`);
    if (blockNumber < 1000) {
      throw new Error('Block number too low');
    }
  });

  await test('Connect to UC Bridge contract', async () => {
    const provider = new ethers.JsonRpcProvider(config.ucRpcUrl);
    const bridge = new ethers.Contract(config.ucBridgeAddress, UC_BRIDGE_ABI, provider);
    const code = await provider.getCode(config.ucBridgeAddress);
    if (code === '0x') {
      throw new Error('No contract code at UC bridge address');
    }
    log.info(`  Contract deployed: ${config.ucBridgeAddress}`);
  });

  await test('Connect to UC USDT contract', async () => {
    const provider = new ethers.JsonRpcProvider(config.ucRpcUrl);
    const usdt = new ethers.Contract(config.ucUsdtAddress, USDT_ABI, provider);
    const code = await provider.getCode(config.ucUsdtAddress);
    if (code === '0x') {
      throw new Error('No contract code at UC USDT address');
    }
    log.info(`  Contract deployed: ${config.ucUsdtAddress}`);
  });
}

async function testRelayerWallet() {
  log.section('Testing Relayer Wallet');

  await test('Load relayer wallet', async () => {
    if (!config.relayerPrivateKey) {
      throw new Error('RELAYER_PRIVATE_KEY not configured');
    }
    const wallet = new ethers.Wallet(config.relayerPrivateKey);
    log.info(`  Address: ${wallet.address}`);
  });

  await test('Check BSC balance', async () => {
    const provider = new ethers.JsonRpcProvider(config.bscRpcUrl);
    const wallet = new ethers.Wallet(config.relayerPrivateKey, provider);
    const balance = await provider.getBalance(wallet.address);
    const balanceEth = ethers.formatEther(balance);
    log.info(`  BSC Balance: ${balanceEth} BNB`);
    if (parseFloat(balanceEth) < 0.001) {
      log.warn('  Low balance! Need BNB for gas');
    }
  });

  await test('Check UC balance', async () => {
    const provider = new ethers.JsonRpcProvider(config.ucRpcUrl);
    const wallet = new ethers.Wallet(config.relayerPrivateKey, provider);
    const balance = await provider.getBalance(wallet.address);
    const balanceEth = ethers.formatEther(balance);
    log.info(`  UC Balance: ${balanceEth} UC`);
    if (parseFloat(balanceEth) < 0.001) {
      log.warn('  Low balance! Need UC for gas');
    }
  });
}

async function testEventQueries() {
  log.section('Testing Event Queries');

  await test('Query BSC Deposit events', async () => {
    const provider = new ethers.JsonRpcProvider(config.bscRpcUrl);
    const bridge = new ethers.Contract(config.bscBridgeAddress, BSC_BRIDGE_ABI, provider);
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 1000);
    
    const filter = bridge.filters.Deposit();
    const events = await bridge.queryFilter(filter, fromBlock, currentBlock);
    log.info(`  Found ${events.length} Deposit events in last 1000 blocks`);
  });

  await test('Query UC Burn events', async () => {
    const provider = new ethers.JsonRpcProvider(config.ucRpcUrl);
    const bridge = new ethers.Contract(config.ucBridgeAddress, UC_BRIDGE_ABI, provider);
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 1000);
    
    const filter = bridge.filters.Burn();
    const events = await bridge.queryFilter(filter, fromBlock, currentBlock);
    log.info(`  Found ${events.length} Burn events in last 1000 blocks`);
  });

  await test('Query UC Mint events', async () => {
    const provider = new ethers.JsonRpcProvider(config.ucRpcUrl);
    const bridge = new ethers.Contract(config.ucBridgeAddress, UC_BRIDGE_ABI, provider);
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 1000);
    
    const filter = bridge.filters.Mint();
    const events = await bridge.queryFilter(filter, fromBlock, currentBlock);
    log.info(`  Found ${events.length} Mint events in last 1000 blocks`);
  });

  await test('Query BSC Withdrawal events', async () => {
    const provider = new ethers.JsonRpcProvider(config.bscRpcUrl);
    const bridge = new ethers.Contract(config.bscBridgeAddress, BSC_BRIDGE_ABI, provider);
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 1000);
    
    const filter = bridge.filters.Withdrawal();
    const events = await bridge.queryFilter(filter, fromBlock, currentBlock);
    log.info(`  Found ${events.length} Withdrawal events in last 1000 blocks`);
  });
}

async function testConfiguration() {
  log.section('Testing Configuration');

  await test('Verify contract addresses', async () => {
    if (!config.bscBridgeAddress || config.bscBridgeAddress === '0x0000000000000000000000000000000000000000') {
      throw new Error('Invalid BSC bridge address');
    }
    if (!config.ucBridgeAddress || config.ucBridgeAddress === '0x0000000000000000000000000000000000000000') {
      throw new Error('Invalid UC bridge address');
    }
    log.info(`  BSC Bridge: ${config.bscBridgeAddress}`);
    log.info(`  UC Bridge: ${config.ucBridgeAddress}`);
  });

  await test('Verify RPC URLs', async () => {
    if (!config.bscRpcUrl || !config.bscRpcUrl.startsWith('http')) {
      throw new Error('Invalid BSC RPC URL');
    }
    if (!config.ucRpcUrl || !config.ucRpcUrl.startsWith('http')) {
      throw new Error('Invalid UC RPC URL');
    }
    log.info(`  BSC RPC: ${config.bscRpcUrl}`);
    log.info(`  UC RPC: ${config.ucRpcUrl}`);
  });

  await test('Verify chain IDs', async () => {
    if (config.bscChainId !== 56) {
      throw new Error(`Invalid BSC chain ID: ${config.bscChainId}`);
    }
    if (config.ucChainId !== 1137) {
      throw new Error(`Invalid UC chain ID: ${config.ucChainId}`);
    }
    log.info(`  BSC Chain ID: ${config.bscChainId}`);
    log.info(`  UC Chain ID: ${config.ucChainId}`);
  });
}

async function main() {
  console.log(`
${colors.cyan}╔════════════════════════════════════════╗
║   USDT Bridge - Connection Test       ║
╚════════════════════════════════════════╝${colors.reset}
`);

  try {
    await testConfiguration();
    await testBSCConnection();
    await testUCConnection();
    await testRelayerWallet();
    await testEventQueries();

    log.section('Test Summary');
    console.log(`
  ${colors.green}Passed: ${testsPassed}${colors.reset}
  ${colors.red}Failed: ${testsFailed}${colors.reset}
  ${colors.cyan}Total:  ${testsPassed + testsFailed}${colors.reset}
`);

    if (testsFailed === 0) {
      log.success('All tests passed! System is ready.');
      process.exit(0);
    } else {
      log.error(`${testsFailed} test(s) failed. Please fix the issues.`);
      process.exit(1);
    }
  } catch (error) {
    log.error(`Fatal error: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

main();
