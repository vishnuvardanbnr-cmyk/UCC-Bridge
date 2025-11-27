#!/usr/bin/env node

/**
 * USDT Bridge - Contract Interaction Test
 * Tests contract functions and permissions
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

async function testBSCBridgeContract() {
  log.section('Testing BSC Bridge Contract');

  const provider = new ethers.JsonRpcProvider(config.bscRpcUrl);
  const wallet = new ethers.Wallet(config.relayerPrivateKey, provider);
  const bridge = new ethers.Contract(config.bscBridgeAddress, BSC_BRIDGE_ABI, wallet);

  await test('Contract is deployed', async () => {
    const code = await provider.getCode(config.bscBridgeAddress);
    if (code === '0x' || code === '0x0') {
      throw new Error('No contract code found');
    }
    log.info(`  Code length: ${code.length} bytes`);
  });

  await test('Can create deposit filter', async () => {
    const filter = bridge.filters.Deposit();
    if (!filter) {
      throw new Error('Failed to create Deposit filter');
    }
    log.info(`  Filter created successfully`);
  });

  await test('Can create withdrawal filter', async () => {
    const filter = bridge.filters.Withdrawal();
    if (!filter) {
      throw new Error('Failed to create Withdrawal filter');
    }
    log.info(`  Filter created successfully`);
  });

  await test('Can estimate gas for unlock (simulation)', async () => {
    try {
      // This will fail if not admin, but we're testing the function exists
      const testAddress = '0x0000000000000000000000000000000000000001';
      const testAmount = ethers.parseUnits('1', 6);
      const testBurnId = ethers.id('test');
      
      await bridge.unlock.estimateGas(testAddress, testAmount, testBurnId);
      log.info(`  Function exists and is callable`);
    } catch (error) {
      if (error.message.includes('execution reverted')) {
        log.info(`  Function exists (reverted as expected without admin role)`);
      } else {
        throw error;
      }
    }
  });
}

async function testUCBridgeContract() {
  log.section('Testing UC Bridge Contract');

  const provider = new ethers.JsonRpcProvider(config.ucRpcUrl);
  const wallet = new ethers.Wallet(config.relayerPrivateKey, provider);
  const bridge = new ethers.Contract(config.ucBridgeAddress, UC_BRIDGE_ABI, wallet);

  await test('Contract is deployed', async () => {
    const code = await provider.getCode(config.ucBridgeAddress);
    if (code === '0x' || code === '0x0') {
      throw new Error('No contract code found');
    }
    log.info(`  Code length: ${code.length} bytes`);
  });

  await test('Can create burn filter', async () => {
    const filter = bridge.filters.Burn();
    if (!filter) {
      throw new Error('Failed to create Burn filter');
    }
    log.info(`  Filter created successfully`);
  });

  await test('Can create mint filter', async () => {
    const filter = bridge.filters.Mint();
    if (!filter) {
      throw new Error('Failed to create Mint filter');
    }
    log.info(`  Filter created successfully`);
  });

  await test('Can estimate gas for mint (simulation)', async () => {
    try {
      const testAddress = '0x0000000000000000000000000000000000000001';
      const testAmount = ethers.parseUnits('1', 6);
      const testDepositId = ethers.id('test');
      
      await bridge.mint.estimateGas(testAddress, testAmount, testDepositId);
      log.info(`  Function exists and is callable`);
    } catch (error) {
      if (error.message.includes('execution reverted')) {
        log.info(`  Function exists (reverted as expected without admin role)`);
      } else {
        throw error;
      }
    }
  });
}

async function testUSDTContracts() {
  log.section('Testing USDT Contracts');

  await test('BSC USDT contract', async () => {
    const provider = new ethers.JsonRpcProvider(config.bscRpcUrl);
    const usdt = new ethers.Contract(config.bscUsdtAddress, USDT_ABI, provider);
    
    const code = await provider.getCode(config.bscUsdtAddress);
    if (code === '0x' || code === '0x0') {
      throw new Error('No contract code found');
    }

    // Test balanceOf function
    const testAddress = '0x0000000000000000000000000000000000000001';
    const balance = await usdt.balanceOf(testAddress);
    log.info(`  balanceOf() works, test address balance: ${ethers.formatUnits(balance, 18)} USDT`);
  });

  await test('UC USDT contract', async () => {
    const provider = new ethers.JsonRpcProvider(config.ucRpcUrl);
    const usdt = new ethers.Contract(config.ucUsdtAddress, USDT_ABI, provider);
    
    const code = await provider.getCode(config.ucUsdtAddress);
    if (code === '0x' || code === '0x0') {
      throw new Error('No contract code found');
    }

    // Test balanceOf function
    const testAddress = '0x0000000000000000000000000000000000000001';
    const balance = await usdt.balanceOf(testAddress);
    log.info(`  balanceOf() works, test address balance: ${ethers.formatUnits(balance, 18)} USDT`);
  });
}

async function testEventHistory() {
  log.section('Testing Event History');

  await test('Query recent BSC events', async () => {
    const provider = new ethers.JsonRpcProvider(config.bscRpcUrl);
    const bridge = new ethers.Contract(config.bscBridgeAddress, BSC_BRIDGE_ABI, provider);
    
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 5000);

    const depositFilter = bridge.filters.Deposit();
    const deposits = await bridge.queryFilter(depositFilter, fromBlock, currentBlock);
    
    const withdrawalFilter = bridge.filters.Withdrawal();
    const withdrawals = await bridge.queryFilter(withdrawalFilter, fromBlock, currentBlock);

    log.info(`  Deposits: ${deposits.length}`);
    log.info(`  Withdrawals: ${withdrawals.length}`);
    log.info(`  Total: ${deposits.length + withdrawals.length} events`);
  });

  await test('Query recent UC events', async () => {
    const provider = new ethers.JsonRpcProvider(config.ucRpcUrl);
    const bridge = new ethers.Contract(config.ucBridgeAddress, UC_BRIDGE_ABI, provider);
    
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 5000);

    const mintFilter = bridge.filters.Mint();
    const mints = await bridge.queryFilter(mintFilter, fromBlock, currentBlock);
    
    const burnFilter = bridge.filters.Burn();
    const burns = await bridge.queryFilter(burnFilter, fromBlock, currentBlock);

    log.info(`  Mints: ${mints.length}`);
    log.info(`  Burns: ${burns.length}`);
    log.info(`  Total: ${mints.length + burns.length} events`);
  });
}

async function testABICompatibility() {
  log.section('Testing ABI Compatibility');

  await test('BSC Bridge ABI has required functions', async () => {
    const requiredFunctions = ['deposit', 'unlock'];
    const abiString = JSON.stringify(BSC_BRIDGE_ABI);
    
    for (const func of requiredFunctions) {
      if (!abiString.includes(func)) {
        throw new Error(`Missing function: ${func}`);
      }
    }
    log.info(`  All required functions present`);
  });

  await test('UC Bridge ABI has required functions', async () => {
    const requiredFunctions = ['withdraw', 'mint'];
    const abiString = JSON.stringify(UC_BRIDGE_ABI);
    
    for (const func of requiredFunctions) {
      if (!abiString.includes(func)) {
        throw new Error(`Missing function: ${func}`);
      }
    }
    log.info(`  All required functions present`);
  });

  await test('Bridge ABIs have required events', async () => {
    const bscAbiString = JSON.stringify(BSC_BRIDGE_ABI);
    const ucAbiString = JSON.stringify(UC_BRIDGE_ABI);
    
    if (!bscAbiString.includes('Deposit') || !bscAbiString.includes('Withdrawal')) {
      throw new Error('BSC Bridge missing required events');
    }
    if (!ucAbiString.includes('Burn') || !ucAbiString.includes('Mint')) {
      throw new Error('UC Bridge missing required events');
    }
    log.info(`  All required events present`);
  });

  await test('USDT ABI has required functions', async () => {
    const requiredFunctions = ['balanceOf', 'approve', 'allowance'];
    const abiString = JSON.stringify(USDT_ABI);
    
    for (const func of requiredFunctions) {
      if (!abiString.includes(func)) {
        throw new Error(`Missing function: ${func}`);
      }
    }
    log.info(`  All required functions present`);
  });
}

async function main() {
  console.log(`
${colors.cyan}╔════════════════════════════════════════╗
║   USDT Bridge - Contract Test         ║
╚════════════════════════════════════════╝${colors.reset}
`);

  try {
    await testABICompatibility();
    await testBSCBridgeContract();
    await testUCBridgeContract();
    await testUSDTContracts();
    await testEventHistory();

    log.section('Test Summary');
    console.log(`
  ${colors.green}Passed: ${testsPassed}${colors.reset}
  ${colors.red}Failed: ${testsFailed}${colors.reset}
  ${colors.cyan}Total:  ${testsPassed + testsFailed}${colors.reset}
`);

    if (testsFailed === 0) {
      log.success('All contract tests passed!');
      process.exit(0);
    } else {
      log.error(`${testsFailed} test(s) failed.`);
      process.exit(1);
    }
  } catch (error) {
    log.error(`Fatal error: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

main();
