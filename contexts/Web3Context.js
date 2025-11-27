import { createContext, useContext, useState, useEffect } from 'react';
import { ethers } from 'ethers';

const Web3Context = createContext();

export function useWeb3() {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  return context;
}

export function Web3Provider({ children }) {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState('');
  const [chainId, setChainId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize Web3
  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      setProvider(web3Provider);

      // Check if already connected
      checkConnection(web3Provider);

      // Listen for account changes
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      setIsInitialized(true);
    } else {
      setIsInitialized(true);
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, []);

  const checkConnection = async (web3Provider) => {
    try {
      const accounts = await web3Provider.listAccounts();
      if (accounts.length > 0) {
        const signer = await web3Provider.getSigner();
        const address = await signer.getAddress();
        const network = await web3Provider.getNetwork();

        setSigner(signer);
        setAccount(address);
        setChainId(Number(network.chainId));
        setIsConnected(true);
      }
    } catch (error) {
      console.error('Error checking connection:', error);
    }
  };

  const handleAccountsChanged = async (accounts) => {
    if (accounts.length > 0 && provider) {
      try {
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        const network = await provider.getNetwork();

        setSigner(signer);
        setAccount(address);
        setChainId(Number(network.chainId));
        setIsConnected(true);
      } catch (error) {
        console.error('Error handling account change:', error);
        disconnect();
      }
    } else {
      disconnect();
    }
  };

  const handleChainChanged = () => {
    // Reload the page when chain changes
    window.location.reload();
  };

  const connectWallet = async () => {
    if (!provider) {
      throw new Error('Please install MetaMask');
    }

    try {
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();

      setSigner(signer);
      setAccount(address);
      setChainId(Number(network.chainId));
      setIsConnected(true);

      return { address, chainId: Number(network.chainId) };
    } catch (error) {
      console.error('Error connecting wallet:', error);
      throw error;
    }
  };

  const disconnect = () => {
    setSigner(null);
    setAccount('');
    setChainId(null);
    setIsConnected(false);
  };

  const switchNetwork = async (targetChainId) => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${Number(targetChainId).toString(16)}` }],
      });
      return true;
    } catch (error) {
      if (error.code === 4902) {
        try {
          const chainParams = {
            56: {
              chainId: '0x38',
              chainName: 'BSC Mainnet',
              nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
              rpcUrls: ['https://bsc-dataseed.binance.org'],
              blockExplorerUrls: ['https://bscscan.com']
            },
            1137: {
              chainId: '0x471',
              chainName: 'Universe Chain',
              nativeCurrency: { name: 'UC', symbol: 'UC', decimals: 18 },
              rpcUrls: ['https://rpc.mainnet.ucchain.org'],
              blockExplorerUrls: ['https://ucscan.io']
            }
          };
          
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [chainParams[targetChainId]],
          });
          return true;
        } catch (addError) {
          console.error('Error adding network:', addError);
          return false;
        }
      }
      console.error('Error switching network:', error);
      return false;
    }
  };

  const value = {
    provider,
    signer,
    account,
    chainId,
    isConnected,
    isInitialized,
    connectWallet,
    disconnect,
    switchNetwork
  };

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>;
}
