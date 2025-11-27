# USDT Bridge Relayer Service

Automated backend service that listens for bridge events and processes cross-chain transactions between BSC and Universe Chain.

## Features

- 🔄 Automatic event monitoring on both chains
- 🚀 Automated mint/unlock execution
- 📝 Comprehensive logging
- 🛡️ Error handling and retry logic
- ⚡ Real-time transaction processing

## Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

**Required Configuration:**

```env
RELAYER_PRIVATE_KEY=your_private_key_here
```

⚠️ **IMPORTANT**: The relayer wallet must have:
- Admin/relayer role on both bridge contracts
- Sufficient native tokens (BNB on BSC, UC on Universe Chain) for gas fees

### 3. Run the Service

**Development mode (with auto-restart):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

## How It Works

### BSC → Universe Chain

1. User calls `deposit()` on BSC Bridge
2. Relayer detects `Deposit` event
3. Relayer calls `mint()` on UC Bridge
4. User receives USDT on Universe Chain

### Universe Chain → BSC

1. User calls `withdraw()` on UC Bridge (burns USDT)
2. Relayer detects `Burn` event
3. Relayer calls `unlock()` on BSC Bridge
4. User receives USDT on BSC

## Monitoring

Logs are stored in:
- `logs/combined.log` - All logs
- `logs/error.log` - Error logs only

## Architecture

```
backend/
├── src/
│   ├── index.js      # Entry point
│   ├── relayer.js    # Main relayer logic
│   ├── config.js     # Configuration
│   ├── logger.js     # Logging setup
│   └── abis.js       # Contract ABIs
├── logs/             # Log files
├── .env              # Environment variables
└── package.json      # Dependencies
```

## Security Best Practices

1. **Never commit `.env` file**
2. **Use a dedicated relayer wallet** (not your personal wallet)
3. **Monitor relayer balance** regularly
4. **Set up alerts** for failed transactions
5. **Run on a secure server** with proper access controls

## Troubleshooting

### Relayer not processing transactions

1. Check relayer wallet has admin role on contracts
2. Verify sufficient gas balance
3. Check RPC endpoints are accessible
4. Review logs for specific errors

### High gas costs

- Adjust `POLL_INTERVAL` to reduce RPC calls
- Use private RPC endpoints for better reliability

## Production Deployment

### Using PM2

```bash
npm install -g pm2
pm2 start src/index.js --name usdt-bridge-relayer
pm2 save
pm2 startup
```

### Using Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
CMD ["node", "src/index.js"]
```

## Support

For issues or questions, please check the logs first and ensure all configuration is correct.
