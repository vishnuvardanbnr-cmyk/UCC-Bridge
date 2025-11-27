import { createContext, useContext, useState, useEffect } from 'react';
import { ethers } from 'ethers';

const Web3Context = createContext();

export const useWeb3 = () => {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  return context;
};

export const Web3Provider = ({ children }) => {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState('');
  const [chainId, setChainId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  // Initialize provider
  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      // const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      setProvider(web3Provider);

      // Listen for account changes
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          setSigner(web3Provider.getSigner());
          setIsConnected(true);
        } else {
          setAccount('');
          setSigner(null);
          setIsConnected(false);
        }
      });

      // Listen for chain changes
      window.ethereum.on('chainChanged', (chainId) => {
        setChainId(parseInt(chainId, 16));
        window.location.reload();
      });
    }
  }, []);

  // Connect wallet
  const connectWallet = async () => {
    if (!provider) {
      alert('Please install MetaMask or another Web3 wallet');
      return;
    }

    try {
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const address = signer.address;
      const network = await provider.getNetwork();

      setSigner(signer);
      setAccount(address);
      setChainId(network.chainId);
      setIsConnected(true);
    } catch (error) {
      console.error('Error connecting wallet:', error);
      alert('Failed to connect wallet. Please try again.');
    }
  };

  // Disconnect wallet
  const disconnectWallet = () => {
    setAccount('');
    setSigner(null);
    setChainId(null);
    setIsConnected(false);
  };

  // Switch network
  const switchNetwork = async (targetChainId) => {
    if (!window.ethereum) return false;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${targetChainId.toString(16)}` }],
      });
      return true;
    } catch (error) {
      // Network not added to wallet
      if (error.code === 4902) {
        try {
          const networks = {
            1: { name: 'Ethereum Mainnet', rpc: 'https://mainnet.infura.io/v3/YOUR_KEY' },
            56: { name: 'BSC Mainnet', rpc: 'https://bsc-dataseed.binance.org/' },
            137: { name: 'Polygon Mainnet', rpc: 'https://polygon-rpc.com/' },
            42161: { name: 'Arbitrum One', rpc: 'https://arb1.arbitrum.io/rpc' },
            1137: { name: 'Universe Chain', rpc: 'https://rpc.mainnet.ucchain.org' }
          };

          const network = networks[targetChainId];
          if (network) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: `0x${targetChainId.toString(16)}`,
                chainName: network.name,
                rpcUrls: [network.rpc],
                nativeCurrency: {
                  name: 'ETH',
                  symbol: 'ETH',
                  decimals: 18,
                },
                blockExplorerUrls: ['https://etherscan.io/'],
              }],
            });
            return true;
          }
        } catch (addError) {
          console.error('Error adding network:', addError);
        }
      }
      return false;
    }
  };

  const value = {
    provider,
    signer,
    account,
    chainId,
    isConnected,
    connectWallet,
    disconnectWallet,
    switchNetwork,
  };

  return (
    <Web3Context.Provider value={value}>
      {children}
    </Web3Context.Provider>
  );
};