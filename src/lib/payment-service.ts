// Enterprise Payment Service with Stripe Integration
// Handles real payment processing, subscriptions, and transaction management

import { loadStripe, Stripe } from '@stripe/stripe-js';

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  clientSecret?: string;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface Subscription {
  id: string;
  customerId: string;
  planId: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  amount: number;
  currency: string;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_account' | 'crypto_wallet';
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
}

export interface Invoice {
  id: string;
  customerId: string;
  amount: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  dueDate: string;
  paidAt?: string;
  items: InvoiceItem[];
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitAmount: number;
  amount: number;
}

export interface Refund {
  id: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
  reason: string;
  status: 'pending' | 'succeeded' | 'failed';
  createdAt: string;
}

class PaymentService {
  private stripe: Stripe | null = null;
  private apiUrl: string;
  private token: string | null = null;

  constructor() {
    this.apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    this.token = localStorage.getItem('auth_token');
    this.initializeStripe();
  }

  private async initializeStripe() {
    const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    if (publishableKey && publishableKey.trim() !== '') {
      try {
        this.stripe = await loadStripe(publishableKey);
      } catch (error) {
        console.warn('Stripe initialization failed:', error);
      }
    } else {
      console.warn('Stripe publishable key not configured. Payment features will be limited.');
    }
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(`${this.apiUrl}/api/v1${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      return response.json();
    } catch (error: any) {
      console.error(`Payment API request failed [${endpoint}]:`, error);
      throw new Error(error.message || 'Payment service unavailable');
    }
  }

  // ==================== PAYMENT INTENTS ====================

  async createPaymentIntent(
    amount: number,
    currency: string = 'usd',
    metadata: Record<string, any> = {}
  ): Promise<PaymentIntent> {
    return this.request('/payments/intents', {
      method: 'POST',
      body: JSON.stringify({ amount, currency, metadata }),
    });
  }

  async confirmPayment(clientSecret: string, paymentMethodId: string): Promise<PaymentIntent> {
    if (!this.stripe) {
      throw new Error('Stripe not initialized');
    }

    const result = await this.stripe.confirmCardPayment(clientSecret, {
      payment_method: paymentMethodId,
    });

    if (result.error) {
      throw new Error(result.error.message);
    }

    return this.getPaymentIntent(result.paymentIntent!.id);
  }

  async getPaymentIntent(id: string): Promise<PaymentIntent> {
    return this.request(`/payments/intents/${id}`);
  }

  async cancelPaymentIntent(id: string): Promise<PaymentIntent> {
    return this.request(`/payments/intents/${id}/cancel`, {
      method: 'POST',
    });
  }

  // ==================== CAMPAIGN FUNDING ====================

  async fundCampaign(campaignId: string, amount: number): Promise<PaymentIntent> {
    return this.createPaymentIntent(amount, 'usd', {
      type: 'campaign_funding',
      campaignId,
    });
  }

  async processCampaignPayment(
    campaignId: string,
    paymentMethodId: string,
    amount: number
  ): Promise<{ success: boolean; transactionId: string }> {
    const intent = await this.fundCampaign(campaignId, amount);
    
    if (!intent.clientSecret) {
      throw new Error('No client secret received');
    }

    const confirmed = await this.confirmPayment(intent.clientSecret, paymentMethodId);
    
    if (confirmed.status === 'succeeded') {
      // Trigger blockchain deposit
      await this.request(`/payments/campaigns/${campaignId}/deposit`, {
        method: 'POST',
        body: JSON.stringify({
          paymentIntentId: confirmed.id,
          amount,
        }),
      });

      return {
        success: true,
        transactionId: confirmed.id,
      };
    }

    throw new Error('Payment failed');
  }

  // ==================== SUBSCRIPTIONS ====================

  async createSubscription(
    planId: string,
    paymentMethodId: string
  ): Promise<Subscription> {
    return this.request('/payments/subscriptions', {
      method: 'POST',
      body: JSON.stringify({ planId, paymentMethodId }),
    });
  }

  async getSubscription(id: string): Promise<Subscription> {
    return this.request(`/payments/subscriptions/${id}`);
  }

  async cancelSubscription(id: string, cancelAtPeriodEnd: boolean = true): Promise<Subscription> {
    return this.request(`/payments/subscriptions/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ cancelAtPeriodEnd }),
    });
  }

  async updateSubscription(id: string, planId: string): Promise<Subscription> {
    return this.request(`/payments/subscriptions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ planId }),
    });
  }

  async listSubscriptions(): Promise<Subscription[]> {
    return this.request('/payments/subscriptions');
  }

  // ==================== PAYMENT METHODS ====================

  async addPaymentMethod(paymentMethodId: string, setAsDefault: boolean = false): Promise<PaymentMethod> {
    return this.request('/payments/methods', {
      method: 'POST',
      body: JSON.stringify({ paymentMethodId, setAsDefault }),
    });
  }

  async listPaymentMethods(): Promise<PaymentMethod[]> {
    return this.request('/payments/methods');
  }

  async removePaymentMethod(id: string): Promise<void> {
    await this.request(`/payments/methods/${id}`, {
      method: 'DELETE',
    });
  }

  async setDefaultPaymentMethod(id: string): Promise<PaymentMethod> {
    return this.request(`/payments/methods/${id}/default`, {
      method: 'POST',
    });
  }

  // ==================== INVOICES ====================

  async getInvoice(id: string): Promise<Invoice> {
    return this.request(`/payments/invoices/${id}`);
  }

  async listInvoices(limit: number = 10): Promise<Invoice[]> {
    return this.request(`/payments/invoices?limit=${limit}`);
  }

  async payInvoice(id: string, paymentMethodId: string): Promise<Invoice> {
    return this.request(`/payments/invoices/${id}/pay`, {
      method: 'POST',
      body: JSON.stringify({ paymentMethodId }),
    });
  }

  // ==================== REFUNDS ====================

  async createRefund(
    paymentIntentId: string,
    amount?: number,
    reason: string = 'requested_by_customer'
  ): Promise<Refund> {
    return this.request('/payments/refunds', {
      method: 'POST',
      body: JSON.stringify({ paymentIntentId, amount, reason }),
    });
  }

  async getRefund(id: string): Promise<Refund> {
    return this.request(`/payments/refunds/${id}`);
  }

  async listRefunds(paymentIntentId?: string): Promise<Refund[]> {
    const query = paymentIntentId ? `?paymentIntentId=${paymentIntentId}` : '';
    return this.request(`/payments/refunds${query}`);
  }

  // ==================== PAYOUTS ====================

  async getPayoutHistory(userId?: string): Promise<any[]> {
    const query = userId ? `?userId=${userId}` : '';
    return this.request(`/payments/payouts${query}`);
  }

  async requestPayout(amount: number, currency: string = 'usd'): Promise<any> {
    return this.request('/payments/payouts/request', {
      method: 'POST',
      body: JSON.stringify({ amount, currency }),
    });
  }

  // ==================== BALANCE & TRANSACTIONS ====================

  async getBalance(): Promise<{
    available: number;
    pending: number;
    currency: string;
  }> {
    return this.request('/payments/balance');
  }

  async getTransactionHistory(
    limit: number = 50,
    startDate?: string,
    endDate?: string
  ): Promise<any[]> {
    let query = `?limit=${limit}`;
    if (startDate) query += `&startDate=${startDate}`;
    if (endDate) query += `&endDate=${endDate}`;
    
    return this.request(`/payments/transactions${query}`);
  }

  // ==================== WEBHOOKS ====================

  async verifyWebhookSignature(payload: string, signature: string): Promise<boolean> {
    return this.request('/payments/webhooks/verify', {
      method: 'POST',
      body: JSON.stringify({ payload, signature }),
    });
  }

  // ==================== ANALYTICS ====================

  async getPaymentAnalytics(period: 'day' | 'week' | 'month' | 'year' = 'month'): Promise<{
    totalRevenue: number;
    totalTransactions: number;
    averageTransactionValue: number;
    successRate: number;
    refundRate: number;
    topPaymentMethods: Array<{ method: string; count: number; amount: number }>;
    revenueByDay: Array<{ date: string; amount: number }>;
  }> {
    return this.request(`/payments/analytics?period=${period}`);
  }
}

export const paymentService = new PaymentService();
export default PaymentService;