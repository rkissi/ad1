// Transaction State Management for Production Blockchain Integration
// Handles transaction persistence, retry logic, and state recovery

import { ethers } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import SmartContractService from './smart-contracts';
import { eventTracker } from './event-tracker';
import { supabaseServer } from './supabase-server';

export interface TransactionRecord {
  id: string;
  type: 'campaign_deposit' | 'funds_release' | 'consent_record' | 'token_transfer' | 'payout_execution';
  status: 'pending' | 'submitted' | 'confirmed' | 'failed' | 'cancelled';
  txHash?: string;
  blockNumber?: number;
  gasUsed?: string;
  gasPrice?: string;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  payload: any;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
}

export interface PayoutTransaction {
  campaignId: string;
  recipients: {
    address: string;
    amount: string;
    role: 'user' | 'publisher' | 'protocol';
    did?: string;
  }[];
  totalAmount: string;
  eventIds: string[];
}

export class TransactionManager {
  private contractService: SmartContractService;
  private isInitialized: boolean = false;
  private retryInterval: NodeJS.Timeout | null = null;
  // Supabase client (admin) for background tasks
  private supabase = supabaseServer;

  constructor(contractService: SmartContractService) {
    this.contractService = contractService;
  }

  async initialize(): Promise<void> {
    try {
      // Tables are managed via migrations now
      await this.startRetryProcessor();
      await this.recoverPendingTransactions();
      this.isInitialized = true;
      console.log('✅ Transaction Manager initialized');
    } catch (error) {
      console.error('❌ Transaction Manager initialization failed:', error);
      throw error;
    }
  }

  // ==================== CAMPAIGN DEPOSIT TRANSACTIONS ====================

  async depositCampaignFunds(campaignId: string, amount: string, advertiserDid: string): Promise<TransactionRecord> {
    const transactionId = uuidv4();
    
    const transaction: TransactionRecord = {
      id: transactionId,
      type: 'campaign_deposit',
      status: 'pending',
      retryCount: 0,
      maxRetries: 3,
      payload: {
        campaignId,
        amount,
        advertiserDid
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Save transaction record
    await this.saveTransaction(transaction);

    // Execute blockchain transaction
    try {
      const txHash = await this.contractService.depositCampaignFunds(campaignId, amount);
      
      transaction.status = 'submitted';
      transaction.txHash = txHash;
      transaction.updatedAt = new Date().toISOString();
      
      await this.updateTransaction(transaction);
      
      // Start monitoring for confirmation
      this.monitorTransaction(transaction);
      
      return transaction;
    } catch (error: any) {
      transaction.status = 'failed';
      transaction.errorMessage = error.message;
      transaction.updatedAt = new Date().toISOString();
      
      await this.updateTransaction(transaction);
      throw error;
    }
  }

  // ==================== PAYOUT TRANSACTIONS ====================

  async executeBatchPayouts(payoutData: PayoutTransaction): Promise<TransactionRecord> {
    const { data: campaign } = await this.supabase
      .from('campaigns')
      .select('*')
      .eq('id', payoutData.campaignId)
      .single();

    if (!campaign) throw new Error('Campaign not found');

    const details = await this.contractService.getCampaignBalance(payoutData.campaignId);
    // Note: getCampaignBalance returns formatted ether string
    const lockedAmount = parseFloat(details);
    const totalPayout = parseFloat(payoutData.totalAmount);

    if (totalPayout > lockedAmount) {
      throw new Error(`Insufficient funds: payout ${totalPayout} exceeds locked ${lockedAmount}`);
    }

    const transactionId = uuidv4();
    
    const transaction: TransactionRecord = {
      id: transactionId,
      type: 'payout_execution',
      status: 'pending',
      retryCount: 0,
      maxRetries: 5, // Higher retry count for payouts
      payload: payoutData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Save transaction and payout records
    await this.saveTransaction(transaction);
    await this.savePayoutRecords(transactionId, payoutData);

    try {
      // Execute automated payout via smart contract
      const recipients = payoutData.recipients.map(r => r.address);
      const amounts = payoutData.recipients.map(r => r.amount);
      
      const txHash = await this.contractService.releaseCampaignFunds(
        payoutData.campaignId,
        recipients,
        amounts
      );
      
      transaction.status = 'submitted';
      transaction.txHash = txHash;
      transaction.updatedAt = new Date().toISOString();
      
      await this.updateTransaction(transaction);
      this.monitorTransaction(transaction);
      
      return transaction;
    } catch (error: any) {
      transaction.status = 'failed';
      transaction.errorMessage = error.message;
      transaction.updatedAt = new Date().toISOString();
      
      await this.updateTransaction(transaction);
      throw error;
    }
  }

  // ==================== CONSENT TRANSACTIONS ====================

  async recordConsent(userDid: string, scope: string, campaignId?: string): Promise<TransactionRecord> {
    const transactionId = uuidv4();
    
    const transaction: TransactionRecord = {
      id: transactionId,
      type: 'consent_record',
      status: 'pending',
      retryCount: 0,
      maxRetries: 3,
      payload: {
        userDid,
        scope,
        campaignId
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await this.saveTransaction(transaction);

    try {
      const txHash = await this.contractService.recordConsent(userDid, scope, campaignId);
      
      transaction.status = 'submitted';
      transaction.txHash = txHash;
      transaction.updatedAt = new Date().toISOString();
      
      await this.updateTransaction(transaction);
      this.monitorTransaction(transaction);
      
      return transaction;
    } catch (error: any) {
      transaction.status = 'failed';
      transaction.errorMessage = error.message;
      transaction.updatedAt = new Date().toISOString();
      
      await this.updateTransaction(transaction);
      throw error;
    }
  }

  // ==================== TRANSACTION MONITORING ====================

  private async monitorTransaction(transaction: TransactionRecord): Promise<void> {
    if (!transaction.txHash) return;

    try {
      // Wait for transaction confirmation
      const receipt = await this.contractService.waitForTransaction(transaction.txHash, 1);
      
      if (receipt && receipt.status === 1) {
        transaction.status = 'confirmed';
        transaction.blockNumber = receipt.blockNumber;
        transaction.gasUsed = receipt.gasUsed?.toString();
        transaction.confirmedAt = new Date().toISOString();
        transaction.updatedAt = new Date().toISOString();
        
        await this.updateTransaction(transaction);
        await this.handleTransactionConfirmed(transaction);
        
        console.log(`✅ Transaction confirmed: ${transaction.id} (${transaction.txHash})`);
      } else {
        throw new Error('Transaction failed on blockchain');
      }
    } catch (error: any) {
      console.error(`❌ Transaction monitoring failed for ${transaction.id}:`, error);
      
      transaction.status = 'failed';
      transaction.errorMessage = error.message;
      transaction.updatedAt = new Date().toISOString();
      
      await this.updateTransaction(transaction);
      
      // Schedule retry if within limits
      if (transaction.retryCount < transaction.maxRetries) {
        await this.scheduleRetry(transaction);
      }
    }
  }

  private async handleTransactionConfirmed(transaction: TransactionRecord): Promise<void> {
    switch (transaction.type) {
      case 'campaign_deposit':
        await this.handleCampaignDepositConfirmed(transaction);
        break;
      case 'payout_execution':
        await this.handlePayoutConfirmed(transaction);
        break;
      case 'consent_record':
        await this.handleConsentConfirmed(transaction);
        break;
    }
  }

  private async handleCampaignDepositConfirmed(transaction: TransactionRecord): Promise<void> {
    const { campaignId } = transaction.payload;
    
    // Update campaign status to active
    await this.supabase
      .from('campaigns')
      .update({
        status: 'active',
        blockchain_tx_hash: transaction.txHash
      })
      .eq('id', campaignId);
    
    // Track deposit event
    await eventTracker.trackEvent({
      type: 'impression', // Using impression as a generic event type
      adId: `campaign_${campaignId}`,
      campaignId,
      userDid: transaction.payload.advertiserDid,
      publisherDid: 'system',
      slotId: 'deposit',
      metadata: {
        eventType: 'campaign_funded',
        amount: transaction.payload.amount,
        txHash: transaction.txHash
      }
    });
  }

  private async handlePayoutConfirmed(transaction: TransactionRecord): Promise<void> {
    // Update payout records
    await this.supabase
      .from('payouts')
      .update({
        status: 'confirmed',
        processed_at: new Date().toISOString()
      })
      .eq('transaction_id', transaction.id);
    
    // Update campaign metrics
    const payoutData = transaction.payload as PayoutTransaction;
    const { data: campaign } = await this.supabase
      .from('campaigns')
      .select('*')
      .eq('id', payoutData.campaignId)
      .single();

    if (campaign) {
      // Assuming metrics is a JSONB column
      const totalPayout = parseFloat(payoutData.totalAmount);
      const metrics = (campaign.metrics as any) || {};
      metrics.spent = (metrics.spent || 0) + totalPayout;
      
      await this.supabase
        .from('campaigns')
        .update({ spent: metrics.spent }) // Updating spent column directly if exists, else metrics
        .eq('id', payoutData.campaignId);
    }

    console.log(`💰 Payouts confirmed for campaign ${payoutData.campaignId}: ${payoutData.totalAmount} tokens`);
  }

  private async handleConsentConfirmed(transaction: TransactionRecord): Promise<void> {
    const { userDid, scope, campaignId } = transaction.payload;
    
    // Create consent record in database
    await this.supabase.from('consents').insert({
      // id: auto-generated
      user_id: userDid, // Assuming userDid is UUID now. If DID string, we might need to look up.
      // But prompt says "user references -> profiles.id".
      scope,
      campaign_id: campaignId,
      granted_at: new Date().toISOString(),
      signature: 'blockchain_verified',
      blockchain_tx_hash: transaction.txHash,
      is_active: true
    });
    
    console.log(`✅ Consent confirmed for user ${userDid}, scope: ${scope}`);
  }

  // ==================== RETRY LOGIC ====================

  private async scheduleRetry(transaction: TransactionRecord): Promise<void> {
    const retryDelay = Math.pow(2, transaction.retryCount) * 30000; // Exponential backoff
    
    setTimeout(async () => {
      await this.retryTransaction(transaction);
    }, retryDelay);
    
    console.log(`⏰ Scheduled retry for transaction ${transaction.id} in ${retryDelay/1000}s`);
  }

  private async retryTransaction(transaction: TransactionRecord): Promise<void> {
    transaction.retryCount++;
    transaction.status = 'pending';
    transaction.updatedAt = new Date().toISOString();
    
    await this.updateTransaction(transaction);
    
    try {
      let txHash: string;
      
      switch (transaction.type) {
        case 'campaign_deposit':
          txHash = await this.contractService.depositCampaignFunds(
            transaction.payload.campaignId,
            transaction.payload.amount
          );
          break;
          
        case 'payout_execution':
          const payoutData = transaction.payload as PayoutTransaction;
          txHash = await this.contractService.releaseCampaignFunds(
            payoutData.campaignId,
            payoutData.recipients.map(r => r.address),
            payoutData.recipients.map(r => r.amount)
          );
          break;
          
        case 'consent_record':
          txHash = await this.contractService.recordConsent(
            transaction.payload.userDid,
            transaction.payload.scope,
            transaction.payload.campaignId
          );
          break;
          
        default:
          throw new Error(`Unknown transaction type: ${transaction.type}`);
      }
      
      transaction.status = 'submitted';
      transaction.txHash = txHash;
      transaction.updatedAt = new Date().toISOString();
      
      await this.updateTransaction(transaction);
      this.monitorTransaction(transaction);
      
      console.log(`🔄 Transaction retry successful: ${transaction.id}`);
    } catch (error: any) {
      transaction.status = 'failed';
      transaction.errorMessage = error.message;
      transaction.updatedAt = new Date().toISOString();
      
      await this.updateTransaction(transaction);
      
      if (transaction.retryCount < transaction.maxRetries) {
        await this.scheduleRetry(transaction);
      } else {
        console.error(`❌ Transaction failed permanently: ${transaction.id}`);
      }
    }
  }

  private async startRetryProcessor(): Promise<void> {
    // Process failed transactions every 5 minutes
    this.retryInterval = setInterval(async () => {
      await this.processPendingRetries();
    }, 5 * 60 * 1000);
  }

  private async processPendingRetries(): Promise<void> {
    // Fetch failed transactions via Supabase
    const { data: rows, error } = await this.supabase
      .from('blockchain_transactions')
      .select('*')
      .eq('status', 'failed')
      .lt('retry_count', 3) // Hardcoded max_retries check or join
      // Supabase filtering for timestamp < NOW - 5 mins is tricky with simple string
      // But we can just fetch and filter in JS for now or use .lt('updated_at', new Date(Date.now() - 5*60*1000).toISOString())
      .lt('updated_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true })
      .limit(10);

    if (error) {
       console.error('Failed to fetch pending retries:', error);
       return;
    }

    if (!rows) return;
      
    for (const row of rows) {
      const transaction = this.mapTransactionFromDb(row);
      await this.retryTransaction(transaction);
    }
  }

  // ==================== RECOVERY FUNCTIONS ====================

  async recoverPendingTransactions(): Promise<void> {
    const { data: rows, error } = await this.supabase
      .from('blockchain_transactions')
      .select('*')
      .in('status', ['pending', 'submitted'])
      .not('tx_hash', 'is', null)
      .order('created_at', { ascending: true });

    if (error) {
       console.error('Failed to recover transactions:', error);
       return;
    }

    console.log(`🔄 Recovering ${rows?.length || 0} pending transactions...`);
      
    if (rows) {
      for (const row of rows) {
        const transaction = this.mapTransactionFromDb(row);
        this.monitorTransaction(transaction);
      }
    }
  }

  // ==================== DATABASE OPERATIONS ====================

  private async saveTransaction(transaction: TransactionRecord): Promise<void> {
    const { error } = await this.supabase
      .from('blockchain_transactions')
      .insert({
        id: transaction.id,
        type: transaction.type,
        status: transaction.status,
        tx_hash: transaction.txHash,
        retry_count: transaction.retryCount,
        max_retries: transaction.maxRetries,
        payload: transaction.payload, // JSONB
        created_at: transaction.createdAt,
        updated_at: transaction.updatedAt
      });
    
    if (error) console.error('Error saving transaction:', error);
  }

  private async updateTransaction(transaction: TransactionRecord): Promise<void> {
    const { error } = await this.supabase
      .from('blockchain_transactions')
      .update({
        status: transaction.status,
        tx_hash: transaction.txHash,
        block_number: transaction.blockNumber,
        gas_used: transaction.gasUsed,
        error_message: transaction.errorMessage,
        retry_count: transaction.retryCount,
        updated_at: transaction.updatedAt,
        confirmed_at: transaction.confirmedAt
      })
      .eq('id', transaction.id);

    if (error) console.error('Error updating transaction:', error);
  }

  private async savePayoutRecords(transactionId: string, payoutData: PayoutTransaction): Promise<void> {
    const payouts = payoutData.recipients.map(recipient => ({
      // id: uuid auto
      campaign_id: payoutData.campaignId,
      transaction_id: transactionId,
      recipient_address: recipient.address,
      recipient_did: recipient.did,
      amount: parseFloat(recipient.amount),
      role: recipient.role,
      event_ids: payoutData.eventIds,
      created_at: new Date().toISOString()
    }));

    const { error } = await this.supabase.from('payouts').insert(payouts);
    if (error) console.error('Error saving payouts:', error);
  }

  private mapTransactionFromDb(row: any): TransactionRecord {
    return {
      id: row.id,
      type: row.type,
      status: row.status,
      txHash: row.tx_hash,
      blockNumber: row.block_number,
      gasUsed: row.gas_used,
      gasPrice: row.gas_price,
      errorMessage: row.error_message,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      payload: row.payload,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      confirmedAt: row.confirmed_at
    };
  }

  // ==================== QUERY FUNCTIONS ====================

  async getTransaction(id: string): Promise<TransactionRecord | null> {
    const { data, error } = await this.supabase
      .from('blockchain_transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return this.mapTransactionFromDb(data);
  }

  async getTransactionsByType(type: string): Promise<TransactionRecord[]> {
    const { data, error } = await this.supabase
      .from('blockchain_transactions')
      .select('*')
      .eq('type', type)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map(row => this.mapTransactionFromDb(row));
  }

  async close(): Promise<void> {
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
    }
  }
}

export default TransactionManager;
