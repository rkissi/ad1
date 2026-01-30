// Transaction State Management for Production Blockchain Integration
// Handles transaction persistence, retry logic, and state recovery

import { ethers } from 'ethers';
import DatabaseService from './database';
import SmartContractService from './smart-contracts';
import { eventTracker } from './event-tracker';

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
  private db: DatabaseService;
  private contractService: SmartContractService;
  private isInitialized: boolean = false;
  private retryInterval: NodeJS.Timeout | null = null;

  constructor(db: DatabaseService, contractService: SmartContractService) {
    this.db = db;
    this.contractService = contractService;
  }

  async initialize(): Promise<void> {
    try {
      await this.createTransactionTables();
      await this.startRetryProcessor();
      await this.recoverPendingTransactions();
      this.isInitialized = true;
      console.log('✅ Transaction Manager initialized');
    } catch (error) {
      console.error('❌ Transaction Manager initialization failed:', error);
      throw error;
    }
  }

  private async createTransactionTables(): Promise<void> {
    const client = await this.db['pool'].connect();
    
    try {
      await client.query('BEGIN');

      // Blockchain transactions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS blockchain_transactions (
          id VARCHAR(255) PRIMARY KEY,
          type VARCHAR(50) NOT NULL,
          status VARCHAR(20) DEFAULT 'pending',
          tx_hash VARCHAR(66),
          block_number BIGINT,
          gas_used VARCHAR(20),
          gas_price VARCHAR(30),
          error_message TEXT,
          retry_count INTEGER DEFAULT 0,
          max_retries INTEGER DEFAULT 3,
          payload JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          confirmed_at TIMESTAMP
        )
      `);

      // Payout tracking table
      await client.query(`
        CREATE TABLE IF NOT EXISTS payouts (
          id VARCHAR(255) PRIMARY KEY,
          campaign_id VARCHAR(255) NOT NULL,
          transaction_id VARCHAR(255) REFERENCES blockchain_transactions(id),
          recipient_address VARCHAR(42) NOT NULL,
          recipient_did VARCHAR(255),
          amount DECIMAL(18,6) NOT NULL,
          role VARCHAR(20) NOT NULL,
          status VARCHAR(20) DEFAULT 'pending',
          event_ids TEXT[],
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          processed_at TIMESTAMP
        )
      `);

      // Create indexes
      await client.query('CREATE INDEX IF NOT EXISTS idx_blockchain_tx_status ON blockchain_transactions(status)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_blockchain_tx_type ON blockchain_transactions(type)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_payouts_campaign ON payouts(campaign_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status)');

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ==================== CAMPAIGN DEPOSIT TRANSACTIONS ====================

  async depositCampaignFunds(campaignId: string, amount: string, advertiserDid: string): Promise<TransactionRecord> {
    const transactionId = `deposit_${campaignId}_${Date.now()}`;
    
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
    } catch (error) {
      transaction.status = 'failed';
      transaction.errorMessage = error.message;
      transaction.updatedAt = new Date().toISOString();
      
      await this.updateTransaction(transaction);
      throw error;
    }
  }

  // ==================== PAYOUT TRANSACTIONS ====================

  async reconcileCampaign(campaignId: string): Promise<{ offChainSpent: number, onChainSpent: number, reconciled: boolean }> {
    const campaign = await this.db.getCampaign(campaignId);
    if (!campaign) throw new Error('Campaign not found');

    const details = await this.contractService.getCampaignDetails(campaignId);
    const onChainSpent = parseFloat(ethers.formatEther(details.spentAmount));
    const offChainSpent = campaign.metrics.spent || 0;

    return {
      offChainSpent,
      onChainSpent,
      reconciled: Math.abs(offChainSpent - onChainSpent) < 0.000001
    };
  }

  async executeBatchPayouts(payoutData: PayoutTransaction): Promise<TransactionRecord> {
    const campaign = await this.db.getCampaign(payoutData.campaignId);
    if (!campaign) throw new Error('Campaign not found');

    const details = await this.contractService.getCampaignDetails(payoutData.campaignId);
    const lockedAmount = parseFloat(ethers.formatEther(details.lockedAmount));
    const totalPayout = parseFloat(payoutData.totalAmount);

    if (totalPayout > lockedAmount) {
      throw new Error(`Insufficient funds: payout ${totalPayout} exceeds locked ${lockedAmount}`);
    }

    const transactionId = `payout_${payoutData.campaignId}_${Date.now()}`;
    
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
    } catch (error) {
      transaction.status = 'failed';
      transaction.errorMessage = error.message;
      transaction.updatedAt = new Date().toISOString();
      
      await this.updateTransaction(transaction);
      throw error;
    }
  }

  // ==================== CONSENT TRANSACTIONS ====================

  async recordConsent(userDid: string, scope: string, campaignId?: string): Promise<TransactionRecord> {
    const transactionId = `consent_${userDid}_${scope}_${Date.now()}`;
    
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
    } catch (error) {
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
    } catch (error) {
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
    await this.db.updateCampaign(campaignId, { 
      status: 'active',
      blockchainTxHash: transaction.txHash 
    });
    
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
    const client = await this.db['pool'].connect();
    
    try {
      // Update payout records
      await client.query(
        'UPDATE payouts SET status = $1, processed_at = CURRENT_TIMESTAMP WHERE transaction_id = $2',
        ['confirmed', transaction.id]
      );
      
      // Update campaign metrics
      const payoutData = transaction.payload as PayoutTransaction;
      const campaign = await this.db.getCampaign(payoutData.campaignId);
      
      if (campaign) {
        const totalPayout = parseFloat(payoutData.totalAmount);
        campaign.metrics.spent = (campaign.metrics.spent || 0) + totalPayout;
        
        await this.db.updateCampaign(payoutData.campaignId, { metrics: campaign.metrics });
      }
      
      console.log(`💰 Payouts confirmed for campaign ${payoutData.campaignId}: ${payoutData.totalAmount} tokens`);
    } finally {
      client.release();
    }
  }

  private async handleConsentConfirmed(transaction: TransactionRecord): Promise<void> {
    const { userDid, scope, campaignId } = transaction.payload;
    
    // Create consent record in database
    const consentRecord = {
      id: `consent_${userDid}_${scope}_${Date.now()}`,
      userDid,
      scope,
      campaignId,
      grantedAt: new Date().toISOString(),
      signature: 'blockchain_verified',
      blockchainTxHash: transaction.txHash
    };
    
    await this.db.createConsent(consentRecord);
    
    console.log(`✅ Consent confirmed for user ${userDid}, scope: ${scope}`);
  }

  // ==================== RETRY LOGIC ====================

  private async scheduleRetry(transaction: TransactionRecord): Promise<void> {
    const retryDelay = Math.pow(2, transaction.retryCount) * 30000; // Exponential backoff: 30s, 60s, 120s
    
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
    } catch (error) {
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
    const client = await this.db['pool'].connect();
    
    try {
      const result = await client.query(`
        SELECT * FROM blockchain_transactions 
        WHERE status = 'failed' 
        AND retry_count < max_retries 
        AND updated_at < NOW() - INTERVAL '5 minutes'
        ORDER BY created_at ASC
        LIMIT 10
      `);
      
      for (const row of result.rows) {
        const transaction = this.mapTransactionFromDb(row);
        await this.retryTransaction(transaction);
      }
    } finally {
      client.release();
    }
  }

  // ==================== RECOVERY FUNCTIONS ====================

  async recoverPendingTransactions(): Promise<void> {
    const client = await this.db['pool'].connect();
    
    try {
      const result = await client.query(`
        SELECT * FROM blockchain_transactions 
        WHERE status IN ('pending', 'submitted') 
        AND tx_hash IS NOT NULL
        ORDER BY created_at ASC
      `);
      
      console.log(`🔄 Recovering ${result.rows.length} pending transactions...`);
      
      for (const row of result.rows) {
        const transaction = this.mapTransactionFromDb(row);
        this.monitorTransaction(transaction);
      }
    } finally {
      client.release();
    }
  }

  // ==================== DATABASE OPERATIONS ====================

  private async saveTransaction(transaction: TransactionRecord): Promise<void> {
    const client = await this.db['pool'].connect();
    
    try {
      await client.query(`
        INSERT INTO blockchain_transactions (
          id, type, status, tx_hash, retry_count, max_retries, payload, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        transaction.id,
        transaction.type,
        transaction.status,
        transaction.txHash,
        transaction.retryCount,
        transaction.maxRetries,
        JSON.stringify(transaction.payload),
        transaction.createdAt,
        transaction.updatedAt
      ]);
    } finally {
      client.release();
    }
  }

  private async updateTransaction(transaction: TransactionRecord): Promise<void> {
    const client = await this.db['pool'].connect();
    
    try {
      await client.query(`
        UPDATE blockchain_transactions 
        SET status = $1, tx_hash = $2, block_number = $3, gas_used = $4, 
            error_message = $5, retry_count = $6, updated_at = $7, confirmed_at = $8
        WHERE id = $9
      `, [
        transaction.status,
        transaction.txHash,
        transaction.blockNumber,
        transaction.gasUsed,
        transaction.errorMessage,
        transaction.retryCount,
        transaction.updatedAt,
        transaction.confirmedAt,
        transaction.id
      ]);
    } finally {
      client.release();
    }
  }

  private async savePayoutRecords(transactionId: string, payoutData: PayoutTransaction): Promise<void> {
    const client = await this.db['pool'].connect();
    
    try {
      for (const recipient of payoutData.recipients) {
        await client.query(`
          INSERT INTO payouts (
            id, campaign_id, transaction_id, recipient_address, recipient_did, 
            amount, role, event_ids, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          `payout_${transactionId}_${recipient.address}`,
          payoutData.campaignId,
          transactionId,
          recipient.address,
          recipient.did,
          recipient.amount,
          recipient.role,
          payoutData.eventIds,
          new Date().toISOString()
        ]);
      }
    } finally {
      client.release();
    }
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
      createdAt: row.created_at?.toISOString(),
      updatedAt: row.updated_at?.toISOString(),
      confirmedAt: row.confirmed_at?.toISOString()
    };
  }

  // ==================== QUERY FUNCTIONS ====================

  async getTransaction(id: string): Promise<TransactionRecord | null> {
    const client = await this.db['pool'].connect();
    
    try {
      const result = await client.query('SELECT * FROM blockchain_transactions WHERE id = $1', [id]);
      return result.rows[0] ? this.mapTransactionFromDb(result.rows[0]) : null;
    } finally {
      client.release();
    }
  }

  async getTransactionsByType(type: string): Promise<TransactionRecord[]> {
    const client = await this.db['pool'].connect();
    
    try {
      const result = await client.query(
        'SELECT * FROM blockchain_transactions WHERE type = $1 ORDER BY created_at DESC',
        [type]
      );
      return result.rows.map(row => this.mapTransactionFromDb(row));
    } finally {
      client.release();
    }
  }

  async getCampaignPayouts(campaignId: string): Promise<any[]> {
    const client = await this.db['pool'].connect();
    
    try {
      const result = await client.query(`
        SELECT p.*, bt.status as transaction_status, bt.tx_hash, bt.confirmed_at
        FROM payouts p
        LEFT JOIN blockchain_transactions bt ON p.transaction_id = bt.id
        WHERE p.campaign_id = $1
        ORDER BY p.created_at DESC
      `, [campaignId]);
      
      return result.rows;
    } finally {
      client.release();
    }
  }

  async getTransactionStats(): Promise<{
    total: number;
    pending: number;
    confirmed: number;
    failed: number;
    byType: Record<string, number>;
  }> {
    const client = await this.db['pool'].connect();
    
    try {
      const [totalResult, statusResult, typeResult] = await Promise.all([
        client.query('SELECT COUNT(*) as count FROM blockchain_transactions'),
        client.query('SELECT status, COUNT(*) as count FROM blockchain_transactions GROUP BY status'),
        client.query('SELECT type, COUNT(*) as count FROM blockchain_transactions GROUP BY type')
      ]);
      
      const statusCounts = statusResult.rows.reduce((acc, row) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      }, {});
      
      const typeCounts = typeResult.rows.reduce((acc, row) => {
        acc[row.type] = parseInt(row.count);
        return acc;
      }, {});
      
      return {
        total: parseInt(totalResult.rows[0].count),
        pending: statusCounts.pending || 0,
        confirmed: statusCounts.confirmed || 0,
        failed: statusCounts.failed || 0,
        byType: typeCounts
      };
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
    }
  }
}

export default TransactionManager;