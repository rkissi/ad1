// Marketplace Service - Integrates with Supabase Edge Functions for ad serving
import { supabase } from '@/lib/supabase';

export interface AdRequest {
  publisherId: string;
  slotId: string;
  userId?: string;
  context?: {
    url?: string;
    keywords?: string[];
    categories?: string[];
  };
}

export interface AdCreative {
  type: string;
  headline: string;
  description: string;
  imageUrl?: string;
  ctaText: string;
  ctaUrl: string;
}

export interface AdResponse {
  adId: string;
  campaignId: string;
  creative: AdCreative;
  trackingUrls: {
    impression: string;
    click: string;
  };
}

export interface TrackingEvent {
  type: 'impression' | 'click' | 'conversion';
  adId: string;
  campaignId: string;
  publisherId?: string;
  slotId?: string;
  userId?: string;
}

export interface ConsentAction {
  action: 'grant' | 'revoke' | 'check' | 'list';
  userId: string;
  scope?: string;
  campaignId?: string;
  consentId?: string;
}

export interface PayoutRequest {
  action: 'request' | 'process' | 'status' | 'history';
  userId: string;
  amount?: number;
  payoutMethod?: 'token' | 'voucher' | 'crypto';
  walletAddress?: string;
  payoutId?: string;
}

class MarketplaceService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  }

  /**
   * Request an ad from the marketplace
   */
  async requestAd(request: AdRequest): Promise<AdResponse | null> {
    try {
      const { data, error } = await supabase.functions.invoke('supabase-functions-ad-serve', {
        body: request
      });

      if (error) {
        console.error('Ad request error:', error);
        return null;
      }

      return data as AdResponse;
    } catch (error) {
      console.error('Failed to request ad:', error);
      return null;
    }
  }

  /**
   * Track an ad event (impression, click, conversion)
   */
  async trackEvent(event: TrackingEvent): Promise<boolean> {
    try {
      const { data, error } = await supabase.functions.invoke('supabase-functions-ad-track', {
        body: event
      });

      if (error) {
        console.error('Event tracking error:', error);
        return false;
      }

      return data?.success || false;
    } catch (error) {
      console.error('Failed to track event:', error);
      return false;
    }
  }

  /**
   * Track impression using pixel URL
   */
  trackImpressionPixel(url: string): void {
    const img = new Image(1, 1);
    img.src = url;
  }

  /**
   * Manage user consent
   */
  async manageConsent(request: ConsentAction): Promise<any> {
    try {
      const { data, error } = await supabase.functions.invoke('supabase-functions-consent-manager', {
        body: request
      });

      if (error) {
        console.error('Consent management error:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Failed to manage consent:', error);
      throw error;
    }
  }

  /**
   * Grant consent for a specific scope
   */
  async grantConsent(userId: string, scope: string, campaignId?: string): Promise<any> {
    return this.manageConsent({
      action: 'grant',
      userId,
      scope,
      campaignId
    });
  }

  /**
   * Revoke consent
   */
  async revokeConsent(userId: string, scope?: string, consentId?: string): Promise<any> {
    return this.manageConsent({
      action: 'revoke',
      userId,
      scope,
      consentId
    });
  }

  /**
   * Check if user has consent for a scope
   */
  async checkConsent(userId: string, scope: string): Promise<boolean> {
    const result = await this.manageConsent({
      action: 'check',
      userId,
      scope
    });
    return result?.hasConsent || false;
  }

  /**
   * List all user consents
   */
  async listConsents(userId: string): Promise<any[]> {
    const result = await this.manageConsent({
      action: 'list',
      userId
    });
    return result?.consents || [];
  }

  /**
   * Manage rewards payouts
   */
  async managePayout(request: PayoutRequest): Promise<any> {
    try {
      const { data, error } = await supabase.functions.invoke('supabase-functions-rewards-payout', {
        body: request
      });

      if (error) {
        console.error('Payout management error:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Failed to manage payout:', error);
      throw error;
    }
  }

  /**
   * Request a payout
   */
  async requestPayout(
    userId: string, 
    amount: number, 
    payoutMethod: 'token' | 'voucher' | 'crypto' = 'token',
    walletAddress?: string
  ): Promise<any> {
    return this.managePayout({
      action: 'request',
      userId,
      amount,
      payoutMethod,
      walletAddress
    });
  }

  /**
   * Get payout history
   */
  async getPayoutHistory(userId: string): Promise<any> {
    return this.managePayout({
      action: 'history',
      userId
    });
  }

  /**
   * Get payout status
   */
  async getPayoutStatus(userId: string, payoutId: string): Promise<any> {
    return this.managePayout({
      action: 'status',
      userId,
      payoutId
    });
  }
}

// Export singleton instance
export const marketplaceService = new MarketplaceService();

// Export class for testing
export default MarketplaceService;
