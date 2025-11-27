# USDT Bridge - BSC ↔ Universe Chain

Complete cross-chain USDT bridge solution with automated relayer service. Transfer USDT seamlessly between Binance Smart Chain and Universe Chain.

## 🌟 Features

- **Seamless Cross-Chain Transfers**: Bridge USDT between BSC and Universe Chain
- **Automated Processing**: Backend relayer handles cross-chain execution
- **Modern UI**: Clean, responsive Next.js frontend
- **Real-time Updates**: Live transaction monitoring
- **Secure**: Non-custodial bridge with smart contract security

## 📋 Project Structure

```
usdt-bridge/
├── components/          # React components
│   ├── Dashboard.js    # Main bridge interface
│   ├── TransactionHistory.js
│   ├── Web3Provider.js
│   └── Layout.js
├── pages/              # Next.js pages
├── lib/                # Utilities and contracts
│   └── contracts.js    # Contract addresses and ABIs
├── backend/            # Relayer service
│   ├── src/
│   │   ├── index.js   # Entry point
│   │   ├── relayer.js # Event monitoring & processing
│   │   ├── config.js  # Configuration
│   │   └── logger.js  # Logging
│   └── package.json
└── styles/             # CSS styles
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- MetaMask wallet
- Private key for relayer (with admin role on contracts)

### Frontend Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Run development server:**
```bash
npm run dev
```

3. **Open browser:**
Navigate to `http://localhost:3000`

### Backend Relayer Setup

1. **Navigate to backend:**
```bash
cd backend
npm install
```

2. **Configure environment:**
```bash
cp .env.example .env
# Edit .env and add your RELAYER_PRIVATE_KEY
```

3. **Start relayer:**
```bash
npm start
```

## 🔧 Configuration

### Contract Addresses

**BSC Mainnet (Chain ID: 56)**
- Bridge: `0xE4363F8FbD39FB0930772644Ebd14597e5756986`
- USDT: `0x45643aB553621e611984Ff34633adf8E18dA2d55`

**Universe Chain (Chain ID: 1137)**
- Bridge: `0x9b7f2CF537F81f2fCfd3252B993b7B12a47648d1`
- USDT: `0x5B4bB8DC15B345D67Cc333Bd1266108DfE206c76`

### RPC Endpoints

- BSC: `https://data-seed-prebsc-1-s1.bnbchain.org:8545`
- Universe Chain: `https://rpc.mainnet.ucchain.org`

## 💡 How It Works

### BSC → Universe Chain

1. User approves USDT on BSC
2. User calls `deposit()` on BSC Bridge
3. Relayer detects `Deposit` event
4. Relayer calls `mint()` on UC Bridge
5. User receives USDT on Universe Chain

### Universe Chain → BSC

1. User calls `withdraw()` on UC Bridge (burns USDT)
2. Relayer detects `Burn` event
3. Relayer calls `unlock()` on BSC Bridge
4. User receives USDT on BSC

## 🛠️ Tech Stack

**Frontend:**
- Next.js 14
- React 18
- Ethers.js v6
- Tailwind CSS

**Backend:**
- Node.js
- Ethers.js v6
- Winston (logging)

## 🔑 Security

- Non-custodial bridge (users maintain control)
- Smart contract based
- Automated relayer with admin controls
- Event-driven architecture
- Transaction verification on both chains

## 📊 Bridge Flow

```
User (BSC) → deposit() → Event → Relayer → mint() → User (UC)
User (UC) → withdraw() → Event → Relayer → unlock() → User (BSC)
```

## 🧪 Testing

See [TESTING.md](TESTING.md) for comprehensive testing guide.

Quick test:
```bash
# Frontend
npm run dev

# Backend
cd backend
npm start
```

## 🚀 Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete deployment guide.

Quick deploy:
```bash
# Frontend (Vercel)
vercel deploy

# Backend (PM2)
pm2 start backend/src/index.js --name usdt-bridge-relayer
```

## 📝 Documentation

- [README.md](README.md) - This file
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment guide
- [TESTING.md](TESTING.md) - Testing guide
- [backend/README.md](backend/README.md) - Backend documentation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

For issues or questions:
1. Check documentation
2. Review logs
3. Test on testnet first
4. Create an issue with details

## ⚠️ Important Notes

1. **Test on testnets first** before using mainnet
2. **Keep relayer private key secure** - never commit to git
3. **Monitor relayer wallet balance** - ensure sufficient gas
4. **Set up alerts** for relayer downtime
5. **Regular backups** of configuration and logs

## 🎯 Roadmap

- [ ] Multi-signature relayer support
- [ ] Transaction batching for gas optimization
- [ ] Advanced monitoring dashboard
- [ ] Mobile app
- [ ] Additional chain support

---

**Built with ❤️ for seamless cross-chain transfers**

