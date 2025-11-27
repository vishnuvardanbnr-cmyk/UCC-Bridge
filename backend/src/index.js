import http from 'http';
import fs from 'fs';
import path from 'path';
import BridgeRelayer from './relayer.js';
import { processDepositByTxHash } from './process-deposit.js';
import { processWithdrawalByTxHash } from './process-withdrawal.js';
import logger from './logger.js';

async function main() {
  logger.info('=== USDT Bridge Relayer Service ===');
  logger.info('Initializing...');

  const relayer = new BridgeRelayer();

  try {
    await relayer.initialize();
    await relayer.start();

    // Create HTTP server for Railway health checks and API
    const PORT = process.env.PORT || 3001;
    const server = http.createServer((req, res) => {
      // Enable CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      if (req.url === '/health' || req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          service: 'USDT Bridge Relayer',
          uptime: process.uptime(),
          timestamp: new Date().toISOString()
        }));
      } else if (req.url.startsWith('/api/tx-hashes/')) {
        // Extract transaction ID from URL
        const txId = req.url.split('/api/tx-hashes/')[1];

        if (!txId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Transaction ID required' }));
          return;
        }

        const txHashes = relayer.stateManager.getTransactionHashes(txId);

        if (txHashes) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(txHashes));
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Transaction not found' }));
        }
      } else if (req.url === '/api/test-body' && req.method === 'POST') {
        // Debug endpoint to see raw body
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });

        req.on('end', () => {
          console.log('=== RAW BODY RECEIVED ===');
          console.log('Length:', body.length);
          console.log('Body:', body);
          console.log('Body bytes:', body.split('').map(c => c.charCodeAt(0)));
          console.log('========================');

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ received: body, length: body.length }));
        });
        return;
      } else if (req.url === '/api/process-deposit' && req.method === 'POST') {
        // Process deposit by transaction hash
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });

        req.on('end', async () => {
          try {
            console.log('=== PROCESS DEPOSIT REQUEST ===');
            console.log('Raw body:', body);
            console.log('Body length:', body.length);

            // Try to extract txHash from the body - handle different formats
            let txHash = null;

            // Handle the case where body is wrapped in quotes
            let cleanBody = body.trim();

            // Force remove quotes if present
            const firstChar = cleanBody.charAt(0);
            const lastChar = cleanBody.charAt(cleanBody.length - 1);

            if ((firstChar === "'" && lastChar === "'") ||
                (firstChar === '"' && lastChar === '"')) {
              cleanBody = cleanBody.slice(1, -1);
            }

            // Try to extract txHash - handle both proper JSON and malformed cases
            try {
              // First try proper JSON parsing
              const parsed = JSON.parse(cleanBody);
              txHash = parsed.txHash;
              console.log('JSON parsed txHash:', txHash);
            } catch (jsonError) {
              // Fallback to manual extraction for malformed JSON
              console.log('JSON parsing failed, trying manual extraction');
              if (cleanBody.includes('txHash:') && cleanBody.includes('0x')) {
                // Remove braces and extract the value after txHash:
                const withoutBraces = cleanBody.replace(/[{}]/g, '');
                const parts = withoutBraces.split(':');
                if (parts.length >= 2) {
                  txHash = parts[1].trim();
                  console.log('Manually extracted txHash:', txHash);
                }
              }
            }

            if (!txHash) {
              console.log('Could not extract txHash from body:', cleanBody);
            }

            if (!txHash) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Transaction hash required' }));
              return;
            }

            logger.info('Processing deposit request', { txHash });

            const result = await processDepositByTxHash(txHash);

            if (result.success) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(result));
            } else {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(result));
            }
          } catch (error) {
            logger.error('Error processing deposit request', { error: error.message });
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
          }
        });
      } else if (req.url === '/api/process-withdrawal' && req.method === 'POST') {
        // Process withdrawal by transaction hash (UC -> BSC)
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });

        req.on('end', async () => {
          try {
            console.log('=== PROCESS WITHDRAWAL REQUEST ===');
            console.log('Raw body:', body);
            console.log('Body length:', body.length);

            // Try to extract txHash from the body - handle different formats
            let txHash = null;

            // Handle the case where body is wrapped in quotes
            let cleanBody = body.trim();

            // Force remove quotes if present
            const firstChar = cleanBody.charAt(0);
            const lastChar = cleanBody.charAt(cleanBody.length - 1);

            if ((firstChar === "'" && lastChar === "'") ||
                (firstChar === '"' && lastChar === '"')) {
              cleanBody = cleanBody.slice(1, -1);
            }

            // Try to extract txHash - handle both proper JSON and malformed cases
            try {
              // First try proper JSON parsing
              const parsed = JSON.parse(cleanBody);
              txHash = parsed.txHash;
              console.log('JSON parsed txHash:', txHash);
            } catch (jsonError) {
              // Fallback to manual extraction for malformed JSON
              console.log('JSON parsing failed, trying manual extraction');
              if (cleanBody.includes('txHash:') && cleanBody.includes('0x')) {
                // Remove braces and extract the value after txHash:
                const withoutBraces = cleanBody.replace(/[{}]/g, '');
                const parts = withoutBraces.split(':');
                if (parts.length >= 2) {
                  txHash = parts[1].trim();
                  console.log('Manually extracted txHash:', txHash);
                }
              }
            }

            if (!txHash) {
              console.log('Could not extract txHash from body:', cleanBody);
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Transaction hash required' }));
              return;
            }

            logger.info('Processing withdrawal request', { txHash });

            // Process UC withdrawal using the relayer's handleUcBurn method
            // We need to create a mock event object from the transaction hash
            const result = await processWithdrawalByTxHash(txHash);

            if (result.success) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(result));
            } else {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(result));
            }
          } catch (error) {
            logger.error('Error processing withdrawal request', { error: error.message });
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
          }
        });
      } else if (req.url === '/api/tx-hashes') {
        // Get all transaction hashes
        const allHashes = relayer.stateManager.getAllTransactionHashes();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(allHashes));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    });

    server.listen(PORT, () => {
      logger.info(`Health check server listening on port ${PORT}`);
      logger.info('Relayer service is running. Press Ctrl+C to stop.');
    });

    // Handle graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down gracefully...');
      server.close();
      relayer.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (error) {
    logger.error('Failed to start relayer', { error: error.message });
    process.exit(1);
  }
}

main();
