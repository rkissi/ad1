// Smart Contract Integration Service
// Handles interaction with Ethereum smart contracts for escrow, tokens, and consent
import { ethers } from 'ethers';

export interface ContractConfig {
  rpcUrl: string;
  privateKey: string;
  marketplaceAddress: string;
  tokenAddress: string;
  networkId: number;
}

// Helper to get environment variables safely in both Node and Browser/Vite
const getEnv = (key: string, defaultValue: string): string => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] as string;
  }
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      // @ts-ignore
      return import.meta.env[key] as string;
    }
  } catch (e) {
    // import.meta may not be available
  }
  return defaultValue;
};

export const DEFAULT_CONTRACT_CONFIG: ContractConfig = {
  rpcUrl: getEnv('VITE_ETHEREUM_RPC_URL', 'http://localhost:8545'),
  privateKey: getEnv('VITE_PRIVATE_KEY', '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'),
  marketplaceAddress: getEnv('VITE_MARKETPLACE_CONTRACT_ADDRESS', '0x' + '1'.repeat(40)),
  tokenAddress: getEnv('VITE_TOKEN_CONTRACT_ADDRESS', '0x' + '2'.repeat(40)),
  networkId: parseInt(getEnv('VITE_NETWORK_ID', '31337'))
};

// Contract ABIs (simplified for demo)
export const MARKETPLACE_ABI = [
  "function depositCampaignFunds(string campaignId, uint256 amount) external",
  "function releaseFunds(string campaignId, address[] recipients, uint256[] amounts) external",
  "function getCampaignBalance(string campaignId) external view returns (uint256)",
  "function recordConsent(string userDid, string scope, string campaignId) external",
  "function verifyConsent(string userDid, string scope, string campaignId) external view returns (bool)",
  "event FundsDeposited(string indexed campaignId, uint256 amount, address advertiser)",
  "event FundsReleased(string indexed campaignId, address[] recipients, uint256[] amounts)",
  "event ConsentRecorded(string indexed userDid, string scope, string campaignId)"
];

export const TOKEN_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function mint(address to, uint256 amount) external",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
  "function name() external view returns (string)",
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];

export class SmartContractService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private marketplaceContract: ethers.Contract;
  private tokenContract: ethers.Contract;
  private config: ContractConfig;
  private isInitialized: boolean = false;

  constructor(config: ContractConfig = DEFAULT_CONTRACT_CONFIG) {
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new ethers.Wallet(config.privateKey, this.provider);
    
    this.marketplaceContract = new ethers.Contract(
      config.marketplaceAddress,
      MARKETPLACE_ABI,
      this.wallet
    );
    
    this.tokenContract = new ethers.Contract(
      config.tokenAddress,
      TOKEN_ABI,
      this.wallet
    );
  }

  /**
   * Initialize the smart contract service
   */
  async initialize(): Promise<void> {
    try {
      // Test connection
      const network = await this.provider.getNetwork();
      console.log(`✅ Connected to blockchain network: ${network.name} (${network.chainId})`);
      
      // Get token info
      const tokenName = await this.tokenContract.name();
      const tokenSymbol = await this.tokenContract.symbol();
      console.log(`✅ Token contract connected: ${tokenName} (${tokenSymbol})`);
      
      this.isInitialized = true;
    } catch (error) {
      console.error('❌ Smart contract initialization failed:', error);
      throw error;
    }
  }

  /**
   * Setup event listeners for contract events
   */
  setupEventListeners(): void {
    if (!this.isInitialized) return;

    // Listen for funds deposited
    this.marketplaceContract.on('FundsDeposited', (campaignId, amount, advertiser, event) => {
      console.log(`💰 Funds deposited for campaign ${campaignId}: ${ethers.formatEther(amount)} tokens`);
    });

    // Listen for funds released
    this.marketplaceContract.on('FundsReleased', (campaignId, recipients, amounts, event) => {
      console.log(`💸 Funds released for campaign ${campaignId} to ${recipients.length} recipients`);
    });

    // Listen for consent recorded
    this.marketplaceContract.on('ConsentRecorded', (userDid, scope, campaignId, event) => {
      console.log(`✅ Consent recorded: ${userDid} for scope ${scope}`);
    });

    // Listen for token transfers
    this.tokenContract.on('Transfer', (from, to, value, event) => {
      if (from !== ethers.ZeroAddress && to !== ethers.ZeroAddress) {
        console.log(`🔄 Token transfer: ${ethers.formatEther(value)} from ${from} to ${to}`);
      }
    });
  }

  // ==================== CAMPAIGN ESCROW FUNCTIONS ====================

  /**
   * Deposit campaign funds into escrow
   */
  async depositCampaignFunds(campaignId: string, amount: string): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Smart contract service not initialized');
    }

    try {
      const amountWei = ethers.parseEther(amount);
      
      // First approve the marketplace to spend tokens
      const approveTx = await this.tokenContract.approve(this.config.marketplaceAddress, amountWei);
      await approveTx.wait();
      
      // Then deposit the funds
      const depositTx = await this.marketplaceContract.depositCampaignFunds(campaignId, amountWei);
      const receipt = await depositTx.wait();
      
      console.log(`Campaign funds deposited: ${amount} tokens for campaign ${campaignId}`);
      return receipt.hash;
    } catch (error) {
      console.error('Failed to deposit campaign funds:', error);
      throw error;
    }
  }

  /** 
   * Release campaign funds to recipients
   */
  async releaseCampaignFunds(
    campaignId: string,
    recipients: string[],
    amounts: string[]
  ): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Smart contract service not initialized');
    }

    try {
      const amountsWei = amounts.map(amount => ethers.parseEther(amount));
      
      const releaseTx = await this.marketplaceContract.releaseFunds(
        campaignId,
        recipients,
        amountsWei
      );
      const receipt = await releaseTx.wait();
      
      console.log(`Campaign funds released for campaign ${campaignId}`);
      return receipt.hash;
    } catch (error) {
      console.error('Failed to release campaign funds:', error);
      throw error;
    }
  }

  /** 
   * Get campaign balance in escrow
   */
  async getCampaignBalance(campaignId: string): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Smart contract service not initialized');
    }

    try {
      const balanceWei = await this.marketplaceContract.getCampaignBalance(campaignId);
      return ethers.formatEther(balanceWei);
    } catch (error) {
      console.error('Failed to get campaign balance:', error);
      throw error;
    }
  }

  // ==================== CONSENT MANAGEMENT FUNCTIONS ====================

  /** 
   * Record user consent on blockchain
   */
  async recordConsent(userDid: string, scope: string, campaignId?: string): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Smart contract service not initialized');
    }

    try {
      const consentTx = await this.marketplaceContract.recordConsent(
        userDid,
        scope,
        campaignId || ''
      );
      const receipt = await consentTx.wait();
      
      console.log(`Consent recorded for user ${userDid}, scope: ${scope}`);
      return receipt.hash;
    } catch (error) {
      console.error('Failed to record consent:', error);
      throw error;
    }
  }

  /** 
   * Verify user consent from blockchain
   */
  async verifyConsent(userDid: string, scope: string, campaignId?: string): Promise<boolean> {
    if (!this.isInitialized) {
      throw new Error('Smart contract service not initialized');
    }

    try {
      const isValid = await this.marketplaceContract.verifyConsent(
        userDid,
        scope,
        campaignId || ''
      );
      
      console.log(`Consent verification for ${userDid}: ${isValid}`);
      return isValid;
    } catch (error) {
      console.error('Failed to verify consent:', error);
      return false;
    }
  }

  // ==================== TOKEN MANAGEMENT FUNCTIONS ====================

  /** 
   * Get token balance for an address
   */
  async getTokenBalance(address: string): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Smart contract service not initialized');
    }

    try {
      const balanceWei = await this.tokenContract.balanceOf(address);
      return ethers.formatEther(balanceWei);
    } catch (error) {
      console.error('Failed to get token balance:', error);
      return '0';
    }
  }

  /** 
   * Transfer tokens to an address
   */
  async transferTokens(toAddress: string, amount: string): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Smart contract service not initialized');
    }

    try {
      const amountWei = ethers.parseEther(amount);
      const transferTx = await this.tokenContract.transfer(toAddress, amountWei);
      const receipt = await transferTx.wait();
      
      console.log(`Tokens transferred: ${amount} to ${toAddress}`);
      return receipt.hash;
    } catch (error) {
      console.error('Failed to transfer tokens:', error);
      throw error;
    }
  }

  /** 
   * Mint tokens (for demo purposes)
   */
  async mintTokens(toAddress: string, amount: string): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Smart contract service not initialized');
    }

    try {
      const amountWei = ethers.parseEther(amount);
      const mintTx = await this.tokenContract.mint(toAddress, amountWei);
      const receipt = await mintTx.wait();
      
      console.log(`Tokens minted: ${amount} to ${toAddress}`);
      return receipt.hash;
    } catch (error) {
      console.error('Failed to mint tokens:', error);
      throw error;
    }
  }

  // ==================== UTILITY FUNCTIONS ====================

  /** 
   * Get network information
   */
  async getNetworkInfo(): Promise<any> {
    const network = await this.provider.getNetwork();
    const blockNumber = await this.provider.getBlockNumber();
    
    return {
      name: network.name,
      chainId: network.chainId.toString(),
      blockNumber,
      contracts: {
        marketplace: this.config.marketplaceAddress,
        token: this.config.tokenAddress
      }
    };
  }

  /** 
   * Get transaction receipt
   */
  async getTransactionReceipt(txHash: string): Promise<any> {
    return await this.provider.getTransactionReceipt(txHash);
  }

  /** 
   * Wait for transaction confirmation
   */
  async waitForTransaction(txHash: string, confirmations: number = 1): Promise<any> {
    return await this.provider.waitForTransaction(txHash, confirmations);
  }
}

// ==================== UTILITY CLASSES ====================

export class ContractUtils {
  /** 
   * Convert DID to Ethereum address (deterministic)
   */
  static didToAddress(did: string): string {
    // Simple deterministic conversion for demo
    // In production, this would use proper DID resolution
    const hash = ethers.keccak256(ethers.toUtf8Bytes(did));
    return ethers.getAddress('0x' + hash.slice(-40));
  }


  /** 
   * Format token amount for display
   */
  static formatTokenAmount(amount: string, decimals: number = 18): string {
    return parseFloat(ethers.formatUnits(amount, decimals)).toFixed(6);
  }

  /** 
   * Parse token amount from user input
   */
  static parseTokenAmount(amount: string, decimals: number = 18): bigint {
    return ethers.parseUnits(amount, decimals);
  }

  /** 
   * Validate Ethereum address
   */
  static isValidAddress(address: string): boolean {
    try {
      ethers.getAddress(address);
      return true;
    } catch {
      return false;
    }
  }

  /** 
   * Validate transaction hash
   */
  static isValidTxHash(hash: string): boolean {
    return /^0x[a-fA-F0-9]{64}$/.test(hash);
  }
}

export default SmartContractService;