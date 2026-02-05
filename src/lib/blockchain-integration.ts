// Blockchain Integration Service for Metaverse Advertising Platform
// Connects frontend applications with smart contracts for escrow, consent, and payouts

import SmartContractService, { ContractUtils, DEFAULT_CONTRACT_CONFIG, ContractConfig } from './smart-contracts';
import { Campaign, ConsentReceipt, EventReceipt, UserProfile } from '@/types/platform';

export interface BlockchainTransaction {
  hash: string;
  blockNumber?: number;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: string;
  gasUsed?: string;
  gasPrice?: string;
}

export interface EscrowDetails {
  campaignId: string;
  totalAmount: string;
  lockedAmount: string;
  releasedAmount: string;
  recipients: {
    address: string;
    amount: string;
    role: 'user' | 'publisher' | 'protocol';
  }[];
  status: 'locked' | 'partially_released' | 'fully_released';
}

export interface ConsentRecord {
  userDid: string;
  scope: string;
  campaignId?: string;
  transactionHash: string;
  blockNumber: number;
  timestamp: string;
  isValid: boolean;
}

export class BlockchainIntegrationService {
  private contractService: SmartContractService;
  private isConnected: boolean = false;
  private networkInfo: any = null;

  constructor(config?: ContractConfig) {
    this.contractService = new SmartContractService(config || DEFAULT_CONTRACT_CONFIG);
  }

  /**
   * Initialize blockchain connection and setup event listeners
   */
  async initialize(): Promise<void> {
    try {
      this.networkInfo = await this.contractService.getNetworkInfo();
      this.contractService.setupEventListeners();
      this.isConnected = true;
      console.log('✅ Blockchain integration initialized:', this.networkInfo);
    } catch (error) {
      console.warn('⚠️ Blockchain connection failed, running in mock mode:', error);
      this.isConnected = false;
    }
  }

  /**
   * Check if blockchain is connected
   */
  isBlockchainConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get network information
   */
  getNetworkInfo() {
    return this.networkInfo;
  }

  // ==================== CAMPAIGN ESCROW MANAGEMENT ====================

  /**
   * Lock campaign funds in escrow
   */
  async lockCampaignFunds(campaign: Campaign): Promise<BlockchainTransaction> {
    if (!this.isConnected) {
      return this.mockTransaction('deposit');
    }

    try {
      const txHash = await this.contractService.depositCampaignFunds(
        campaign.id,
        campaign.budget.toString()
      );

      return {
        hash: txHash,
        status: 'pending',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to lock campaign funds:', error);
      throw new Error(`Escrow deposit failed: ${error}`);
    }
  }

  /**
   * Get campaign escrow details
   */
  async getCampaignEscrow(campaignId: string): Promise<EscrowDetails> {
    if (!this.isConnected) {
      return this.mockEscrowDetails(campaignId);
    }

    try {
      const balance = await this.contractService.getCampaignBalance(campaignId);
      
      return {
        campaignId,
        totalAmount: balance,
        lockedAmount: balance,
        releasedAmount: '0',
        recipients: [],
        status: 'locked'
      };
    } catch (error) {
      console.error('Failed to get escrow details:', error);
      throw new Error(`Escrow query failed: ${error}`);
    }
  }

  /**
   * Release funds to recipients based on campaign performance
   */
  async releaseCampaignFunds(
    campaignId: string,
    payouts: {
      userDid: string;
      publisherDid: string;
      amounts: {
        user: number;
        publisher: number;
        protocol: number;
      };
    }
  ): Promise<BlockchainTransaction> {
    if (!this.isConnected) {
      return this.mockTransaction('release');
    }

    try {
      // Convert DIDs to addresses
      const userAddress = ContractUtils.didToAddress(payouts.userDid);
      const publisherAddress = ContractUtils.didToAddress(payouts.publisherDid);
      const protocolAddress = ContractUtils.didToAddress('did:protocol:treasury');

      const recipients = [userAddress, publisherAddress, protocolAddress];
      const amounts = [
        payouts.amounts.user.toString(),
        payouts.amounts.publisher.toString(),
        payouts.amounts.protocol.toString()
      ];

      const txHash = await this.contractService.releaseCampaignFunds(
        campaignId,
        recipients,
        amounts
      );

      return {
        hash: txHash,
        status: 'pending',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to release campaign funds:', error);
      throw new Error(`Payout failed: ${error}`);
    }
  }

  // ==================== CONSENT MANAGEMENT ====================

  /**
   * Record user consent on blockchain
   */
  async recordUserConsent(
    userDid: string,
    scope: string,
    campaignId?: string
  ): Promise<BlockchainTransaction> {
    if (!this.isConnected) {
      return this.mockTransaction('consent');
    }

    try {
      const txHash = await this.contractService.recordConsent(userDid, scope, campaignId);

      return {
        hash: txHash,
        status: 'pending',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to record consent:', error);
      throw new Error(`Consent recording failed: ${error}`);
    }
  }

  /**
   * Verify user consent from blockchain
   */
  async verifyUserConsent(
    userDid: string,
    scope: string,
    campaignId?: string
  ): Promise<ConsentRecord> {
    if (!this.isConnected) {
      return this.mockConsentRecord(userDid, scope, campaignId);
    }

    try {
      const isValid = await this.contractService.verifyConsent(userDid, scope, campaignId);

      return {
        userDid,
        scope,
        campaignId,
        transactionHash: `0x${Math.random().toString(16).substr(2, 64)}`,
        blockNumber: await this.contractService['provider'].getBlockNumber(),
        timestamp: new Date().toISOString(),
        isValid
      };
    } catch (error) {
      console.error('Failed to verify consent:', error);
      throw new Error(`Consent verification failed: ${error}`);
    }
  }

  /**
   * Revoke user consent
   */
  async revokeUserConsent(
    userDid: string,
    scope: string,
    campaignId?: string
  ): Promise<BlockchainTransaction> {
    // For now, record a revocation consent
    return this.recordUserConsent(userDid, `revoke_${scope}`, campaignId);
  }

  // ==================== TOKEN MANAGEMENT ====================

  /**
   * Get user token balance
   */
  async getUserTokenBalance(userDid: string): Promise<string> {
    if (!this.isConnected) {
      return (Math.random() * 100).toFixed(6);
    }

    try {
      const address = ContractUtils.didToAddress(userDid);
      return await this.contractService.getTokenBalance(address);
    } catch (error) {
      console.error('Failed to get token balance:', error);
      return '0';
    }
  }

  /**
   * Transfer tokens between users
   */
  async transferTokens(
    fromDid: string,
    toDid: string,
    amount: string
  ): Promise<BlockchainTransaction> {
    if (!this.isConnected) {
      return this.mockTransaction('transfer');
    }

    try {
      const toAddress = ContractUtils.didToAddress(toDid);
      const txHash = await this.contractService.transferTokens(toAddress, amount);

      return {
        hash: txHash,
        status: 'pending',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to transfer tokens:', error);
      throw new Error(`Token transfer failed: ${error}`);
    }
  }

  /**
   * Mint tokens for demo purposes
   */
  async mintDemoTokens(userDid: string, amount: string): Promise<BlockchainTransaction> {
    if (!this.isConnected) {
      return this.mockTransaction('mint');
    }

    try {
      const address = ContractUtils.didToAddress(userDid);
      const txHash = await this.contractService.mintTokens(address, amount);

      return {
        hash: txHash,
        status: 'pending',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to mint tokens:', error);
      throw new Error(`Token minting failed: ${error}`);
    }
  }

  // ==================== AUTOMATED PAYOUTS ====================

  /**
   * Calculate and execute automated payouts for a campaign
   */
  async executeAutomatedPayouts(
    campaign: Campaign,
    events: EventReceipt[]
  ): Promise<{
    transaction: BlockchainTransaction;
    payoutDetails: {
      totalPayout: number;
      userPayouts: { userDid: string; amount: number }[];
      publisherPayouts: { publisherDid: string; amount: number }[];
      protocolPayout: number;
    };
  }> {
    // Calculate payouts based on events
    const payoutDetails = this.calculateEventPayouts(campaign, events);
    
    // Group payouts by recipient
    const userPayouts = this.groupPayoutsByUser(payoutDetails.userPayouts);
    const publisherPayouts = this.groupPayoutsByPublisher(payoutDetails.publisherPayouts);

    // Execute blockchain transactions for each recipient
    const transactions: BlockchainTransaction[] = [];

    // Pay users
    for (const [userDid, amount] of Object.entries(userPayouts)) {
      const tx = await this.transferTokens('protocol', userDid, amount.toString());
      transactions.push(tx);
    }

    // Pay publishers
    for (const [publisherDid, amount] of Object.entries(publisherPayouts)) {
      const tx = await this.transferTokens('protocol', publisherDid, amount.toString());
      transactions.push(tx);
    }

    return {
      transaction: transactions[0] || this.mockTransaction('payout'),
      payoutDetails
    };
  }

  /**
   * Calculate payouts based on campaign events
   */
  private calculateEventPayouts(campaign: Campaign, events: EventReceipt[]) {
    const userPayouts: { userDid: string; amount: number }[] = [];
    const publisherPayouts: { publisherDid: string; amount: number }[] = [];
    let totalPayout = 0;

    events.forEach(event => {
      let eventValue = 0;
      
      switch (event.type) {
        case 'impression':
          eventValue = 0.001;
          break;
        case 'click':
          eventValue = 0.01;
          break;
        case 'conversion':
          eventValue = 0.1;
          break;
      }

      const userAmount = eventValue * campaign.payoutRules.user;
      const publisherAmount = eventValue * campaign.payoutRules.publisher;

      userPayouts.push({ userDid: event.userDid, amount: userAmount });
      publisherPayouts.push({ publisherDid: event.publisherDid, amount: publisherAmount });
      
      totalPayout += eventValue;
    });

    return {
      totalPayout,
      userPayouts,
      publisherPayouts,
      protocolPayout: totalPayout * campaign.payoutRules.protocol
    };
  }

  /**
   * Group payouts by user DID
   */
  private groupPayoutsByUser(payouts: { userDid: string; amount: number }[]): Record<string, number> {
    return payouts.reduce((acc, payout) => {
      acc[payout.userDid] = (acc[payout.userDid] || 0) + payout.amount;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Group payouts by publisher DID
   */
  private groupPayoutsByPublisher(payouts: { publisherDid: string; amount: number }[]): Record<string, number> {
    return payouts.reduce((acc, payout) => {
      acc[payout.publisherDid] = (acc[payout.publisherDid] || 0) + payout.amount;
      return acc;
    }, {} as Record<string, number>);
  }

  // ==================== MOCK FUNCTIONS FOR OFFLINE MODE ====================

  private mockTransaction(type: string): BlockchainTransaction {
    return {
      hash: `0x${Math.random().toString(16).substr(2, 64)}`,
      status: 'confirmed',
      timestamp: new Date().toISOString(),
      gasUsed: '21000',
      gasPrice: '20000000000'
    };
  }

  private mockEscrowDetails(campaignId: string): EscrowDetails {
    return {
      campaignId,
      totalAmount: '1000.0',
      lockedAmount: '800.0',
      releasedAmount: '200.0',
      recipients: [
        { address: '0x1234...', amount: '120.0', role: 'user' },
        { address: '0x5678...', amount: '70.0', role: 'publisher' },
        { address: '0x9abc...', amount: '10.0', role: 'protocol' }
      ],
      status: 'partially_released'
    };
  }

  private mockConsentRecord(userDid: string, scope: string, campaignId?: string): ConsentRecord {
    return {
      userDid,
      scope,
      campaignId,
      transactionHash: `0x${Math.random().toString(16).substr(2, 64)}`,
      blockNumber: Math.floor(Math.random() * 1000000),
      timestamp: new Date().toISOString(),
      isValid: true
    };
  }
}

export default BlockchainIntegrationService;
