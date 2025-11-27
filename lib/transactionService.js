import { ethers } from 'ethers';
import { getBridgeAddress, BRIDGE_ABI } from './contracts';

// Transaction service to fetch bridge transactions from blockchain
export class TransactionService {
  constructor(provider, chainId) {
    this.provider = provider;
    this.chainId = chainId;
    this.bridgeAddress = getBridgeAddress(chainId);
    this.bridgeContract = new ethers.Contract(this.bridgeAddress, BRIDGE_ABI, provider);
  }

  /**
   * Get user transactions from the last N days
   * Verifies transaction status by checking blockchain
   * @param {string} userAddress - User wallet address
   * @param {number} days - Number of days to look back (default: 30)
   * @returns {Promise<Array>} Array of verified transactions
   */
  async getUserTransactions(userAddress, days = 30) {
    try {
      // Get transactions from contract
      const timeRange = days * 24 * 60 * 60;
      const transactions = await this.bridgeContract.getUserTransactionsByTimeRange(
        userAddress,
        timeRange
      );
      
      // Verify and format transactions
      const verifiedTransactions = [];
      
      for (const tx of transactions) {
        // Format the transaction
        const formattedTx = this.formatTransaction(tx);
        
        // Verify actual status by checking if linkedId exists and is not zero
        const hasLinkedTx = tx.linkedId && tx.linkedId !== '0x0000000000000000000000000000000000000000000000000000000000000000';
        
        // If transaction has a linked ID, it's completed
        if (hasLinkedTx) {
          formattedTx.status = 'Completed';
          formattedTx.statusCode = 1;
        }
        // If transaction is older than 5 minutes and has no linked ID, check if it's actually pending
        else if (Date.now() / 1000 - Number(tx.timestamp) > 300) {
          // Old transaction with no linked ID - likely stuck or failed
          // But keep the status from contract
          if (Number(tx.status) === 0) {
            // Still showing as pending after 5 minutes - might be stuck
            formattedTx.status = 'Pending';
          }
        }

        // Fetch actual blockchain tx hashes from relayer
        try {
          const blockchainHashes = await this.fetchBlockchainTxHashes(formattedTx.transactionId);
          if (blockchainHashes) {
            formattedTx.blockchainTxHashes = blockchainHashes;
          }
        } catch (error) {
          console.error('Error fetching blockchain hashes for tx:', formattedTx.transactionId, error);
        }
        
        verifiedTransactions.push(formattedTx);
      }
      
      return verifiedTransactions;
    } catch (error) {
      console.error('Error fetching user transactions:', error);
      return [];
    }
  }

  /**
   * Get a specific transaction by ID
   * @param {string} transactionId - Transaction ID (bytes32)
   * @returns {Promise<Object>} Transaction object
   */
  async getTransaction(transactionId) {
    try {
      const tx = await this.bridgeContract.getTransaction(transactionId);
      return this.formatTransaction(tx);
    } catch (error) {
      console.error('Error fetching transaction:', error);
      return null;
    }
  }

  /**
   * Get total number of transactions
   * @returns {Promise<number>} Total transaction count
   */
  async getTotalTransactions() {
    try {
      const total = await this.bridgeContract.getTotalTransactions();
      return Number(total);
    } catch (error) {
      console.error('Error fetching total transactions:', error);
      return 0;
    }
  }

  /**
   * Get market overview statistics
   * @returns {Promise<Object>} Market statistics
   */
  async getMarketOverview() {
    try {
      const overview = await this.bridgeContract.getMarketOverview();
      return {
        current24hVolume: ethers.formatUnits(overview.current24hVolume, 18),
        previous24hVolume: ethers.formatUnits(overview.previous24hVolume, 18),
        volumeIncreasePercent: Number(overview.volumeIncreasePercent),
        successRate: Number(overview.successRate),
        avgProcessingTime: Number(overview.avgProcessingTime)
      };
    } catch (error) {
      console.error('Error fetching market overview:', error);
      return null;
    }
  }

  /**
   * Format transaction object for display
   * @param {Object} tx - Raw transaction from contract
   * @returns {Object} Formatted transaction
   */
  formatTransaction(tx) {
    const statusMap = {
      0: 'Pending',
      1: 'Completed',
      2: 'Failed',
      3: 'Cancelled'
    };

    // Detect correct decimals based on amount size
    // If amount is huge (> 1e15), it's likely using 18 decimals instead of 6
    let decimals = 6; // USDT standard
    const amountBigInt = BigInt(tx.amount.toString());
    
    // If amount is greater than 1 trillion (1e12), it's probably 18 decimals
    if (amountBigInt > BigInt('1000000000000')) {
      decimals = 18;
    }

    return {
      transactionId: tx.transactionId,
      user: tx.user,
      type: tx.transactionType,
      amount: ethers.formatUnits(tx.amount, decimals),
      amountRaw: tx.amount.toString(),
      sourceChain: tx.sourceChain,
      destinationChain: tx.destinationChain,
      destinationAddress: tx.destinationAddress,
      status: statusMap[tx.status] || 'Unknown',
      statusCode: Number(tx.status),
      timestamp: Number(tx.timestamp),
      date: new Date(Number(tx.timestamp) * 1000).toLocaleString(),
      linkedId: tx.linkedId,
      // Placeholder for actual blockchain tx hashes (to be fetched separately)
      blockchainTxHashes: null
    };
  }

  /**
   * Fetch actual blockchain transaction hashes from relayer API
   * @param {string} transactionId - Internal transaction ID
   * @returns {Promise<Object|null>} Blockchain tx hashes or null
   */
  async fetchBlockchainTxHashes(transactionId) {
    try {
      const relayerUrl = process.env.NEXT_PUBLIC_RELAYER_URL || 'https://bridge.ucchain.org';
      const response = await fetch(`${relayerUrl}/api/tx-hashes/${transactionId}`);

      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('Error fetching blockchain tx hashes:', error);
      return null;
    }
  }

  /**
   * Listen for new deposit events
   * @param {Function} callback - Callback function to handle new deposits
   */
  onDeposit(callback) {
    const filter = this.bridgeContract.filters.Deposit();
    this.bridgeContract.on(filter, (user, amount, depositId, destinationChain, destinationAddress, event) => {
      // Auto-detect decimals
      const amountBigInt = BigInt(amount.toString());
      const decimals = amountBigInt > BigInt('1000000000000') ? 18 : 6;
      
      callback({
        user,
        amount: ethers.formatUnits(amount, decimals),
        depositId,
        destinationChain,
        destinationAddress,
        txHash: event.transactionHash,
        blockNumber: event.blockNumber
      });
    });
  }

  /**
   * Listen for new withdrawal/unlock events
   * @param {Function} callback - Callback function to handle new withdrawals
   */
  onWithdrawal(callback) {
    const filter = this.bridgeContract.filters.Withdrawal();
    this.bridgeContract.on(filter, (user, amount, withdrawalId, sourceChain, burnId, event) => {
      // Auto-detect decimals
      const amountBigInt = BigInt(amount.toString());
      const decimals = amountBigInt > BigInt('1000000000000') ? 18 : 6;
      
      callback({
        user,
        amount: ethers.formatUnits(amount, decimals),
        withdrawalId,
        sourceChain,
        burnId,
        txHash: event.transactionHash,
        blockNumber: event.blockNumber
      });
    });
  }

  /**
   * Stop listening to events
   */
  removeAllListeners() {
    this.bridgeContract.removeAllListeners();
  }
}

/**
 * Get transactions from both chains for a user
 * @param {Object} bscProvider - BSC provider
 * @param {Object} ucProvider - UC provider
 * @param {string} userAddress - User wallet address
 * @param {number} days - Number of days to look back
 * @returns {Promise<Array>} Combined transactions from both chains
 */
export async function getAllUserTransactions(bscProvider, ucProvider, userAddress, days = 30) {
  try {
    const bscService = new TransactionService(bscProvider, 56);
    const ucService = new TransactionService(ucProvider, 1137);

    const [bscTxs, ucTxs] = await Promise.all([
      bscService.getUserTransactions(userAddress, days),
      ucService.getUserTransactions(userAddress, days)
    ]);

    // Combine and sort by timestamp (newest first)
    const allTxs = [...bscTxs, ...ucTxs].sort((a, b) => b.timestamp - a.timestamp);
    
    return allTxs;
  } catch (error) {
    console.error('Error fetching all user transactions:', error);
    return [];
  }
}
