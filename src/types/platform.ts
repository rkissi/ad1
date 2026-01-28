// Core data schemas for the Metaverse of Advertising platform

export interface UserProfile {
  did: string;
  displayName: string;
  email: string;
  interests: string[];
  rewardPreferences: {
    type: 'token' | 'voucher';
    ratePerImpression: number;
    ratePerClick: number;
    ratePerConversion: number;
  };
  consents: {
    marketplace_opt_in: boolean;
    campaigns: Record<string, boolean>;
    data_processing: boolean;
    analytics: boolean;
  };
  pdsUrl: string;
  walletAddress?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Campaign {
  id: string;
  advertiser: string; // DID
  name: string;
  description: string;
  audienceSpec: {
    interests: string[];
    verifiableClaims: string[];
    demographics?: {
      ageRange?: [number, number];
      locations?: string[];
      languages?: string[];
    };
  };
  budget: number;
  currency: string;
  creativeManifest: {
    type: 'html5' | 'image' | 'video' | 'interactive';
    url: string;
    assets: string[];
    metadata: Record<string, any>;
  };
  payoutRules: {
    user: number; // percentage
    publisher: number; // percentage
    protocol: number; // percentage
  };
  deliveryConstraints: {
    maxImpressionsPerUser: number;
    maxClicksPerUser: number;
    startDate: string;
    endDate: string;
    dailyBudgetLimit?: number;
  };
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
  metrics: {
    impressions: number;
    clicks: number;
    conversions: number;
    spent: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ConsentReceipt {
  id: string;
  userDid: string;
  scope: 'marketplace' | 'campaign' | 'analytics' | 'data_processing';
  campaignId?: string;
  grantedAt: string;
  expiresAt?: string;
  revokedAt?: string;
  signature: string;
  ipfsHash?: string;
  blockchainTxHash?: string;
}

export interface AdSlot {
  slotId: string;
  publisherDid: string;
  context: {
    url: string;
    title: string;
    content: string;
    categories: string[];
    keywords: string[];
  };
  dimensions: {
    width: number;
    height: number;
  };
  position: 'header' | 'sidebar' | 'content' | 'footer' | 'overlay';
  allowedFormats: string[];
  minBid: number;
}

export interface AdRequest {
  slotId: string;
  publisherDid: string;
  userDid?: string; // pseudonymous
  context: AdSlot['context'];
  timestamp: string;
  sessionId: string;
}

export interface AdResponse {
  adId: string;
  campaignId: string;
  creative: {
    type: string;
    content: string;
    assets: string[];
    clickUrl: string;
    impressionTrackingUrl: string;
    clickTrackingUrl: string;
  };
  bid: number;
  currency: string;
  expiresAt: string;
}

export interface EventReceipt {
  id: string;
  type: 'impression' | 'click' | 'conversion';
  adId: string;
  campaignId: string;
  userDid: string; // pseudonymous
  publisherDid: string;
  slotId: string;
  timestamp: string;
  metadata: Record<string, any>;
  signature: string;
  ipfsHash?: string;
  blockchainTxHash?: string;
}

export interface PayoutReceipt {
  id: string;
  campaignId: string;
  eventReceiptIds: string[];
  recipients: {
    did: string;
    amount: number;
    currency: string;
    walletAddress: string;
  }[];
  totalAmount: number;
  currency: string;
  blockchainTxHash: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
}

export interface Publisher {
  did: string;
  name: string;
  domain: string;
  description: string;
  categories: string[];
  adSlots: AdSlot[];
  payoutPreferences: {
    currency: string;
    walletAddress: string;
    minimumPayout: number;
  };
  metrics: {
    totalImpressions: number;
    totalClicks: number;
    totalEarnings: number;
  };
  status: 'active' | 'suspended' | 'pending_verification';
  createdAt: string;
  updatedAt: string;
}

export interface Advertiser {
  did: string;
  name: string;
  email: string;
  company: string;
  description: string;
  walletAddress: string;
  campaigns: string[]; // campaign IDs
  totalSpent: number;
  status: 'active' | 'suspended' | 'pending_verification';
  createdAt: string;
  updatedAt: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

// Authentication types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface JWTPayload {
  sub: string; // user DID
  email: string;
  role: 'user' | 'advertiser' | 'publisher' | 'admin';
  iat: number;
  exp: number;
}

// Matching engine types
export interface MatchingRequest {
  adSlot: AdSlot;
  userProfile?: Partial<UserProfile>;
  context: {
    timestamp: string;
    sessionId: string;
    userAgent: string;
    ipAddress: string; // will be hashed for privacy
  };
}

export interface MatchingResponse {
  matches: {
    ad: AdResponse;
    score: number;
    reasoning: string[];
  }[];
  totalMatches: number;
  processingTime: number;
}

// Smart contract types
export interface ContractEvent {
  eventName: string;
  blockNumber: number;
  transactionHash: string;
  args: Record<string, any>;
  timestamp: string;
}

export interface EscrowDeposit {
  campaignId: string;
  advertiser: string;
  amount: number;
  currency: string;
  blockNumber: number;
  transactionHash: string;
  timestamp: string;
}

// Example data constants
export const EXAMPLE_USER_PROFILE: UserProfile = {
  did: "did:local:123abc",
  displayName: "Alex",
  email: "alex@example.com",
  interests: ["travel", "sailing", "sustainable-fashion"],
  rewardPreferences: {
    type: "token",
    ratePerImpression: 0.001,
    ratePerClick: 0.01,
    ratePerConversion: 0.1
  },
  consents: {
    marketplace_opt_in: true,
    campaigns: {},
    data_processing: true,
    analytics: true
  },
  pdsUrl: "http://localhost:8000/pds/did:local:123abc",
  walletAddress: "0x742d35Cc6634C0532925a3b8D4C9db96590c6C87",
  createdAt: "2025-01-13T12:00:00Z",
  updatedAt: "2025-01-13T12:00:00Z"
};

export const EXAMPLE_CAMPAIGN: Campaign = {
  id: "camp-001",
  advertiser: "did:local:adv001",
  name: "Summer Sailing Offers",
  description: "Premium sailing experiences for adventure seekers",
  audienceSpec: {
    interests: ["sailing", "travel"],
    verifiableClaims: ["age>21"],
    demographics: {
      ageRange: [21, 65],
      locations: ["US", "CA", "AU"],
      languages: ["en"]
    }
  },
  budget: 1000.0,
  currency: "DEV-ERC20",
  creativeManifest: {
    type: "html5",
    url: "/assets/creatives/sail.html",
    assets: ["/assets/images/sailing-hero.jpg", "/assets/videos/sailing-promo.mp4"],
    metadata: {
      title: "Discover Premium Sailing",
      description: "Book your next sailing adventure",
      cta: "Book Now"
    }
  },
  payoutRules: {
    user: 0.6,
    publisher: 0.35,
    protocol: 0.05
  },
  deliveryConstraints: {
    maxImpressionsPerUser: 3,
    maxClicksPerUser: 1,
    startDate: "2025-01-13T00:00:00Z",
    endDate: "2025-04-13T23:59:59Z",
    dailyBudgetLimit: 50
  },
  status: "active",
  metrics: {
    impressions: 0,
    clicks: 0,
    conversions: 0,
    spent: 0
  },
  createdAt: "2025-01-13T12:00:00Z",
  updatedAt: "2025-01-13T12:00:00Z"
};

export const EXAMPLE_CONSENT_RECEIPT: ConsentReceipt = {
  id: "consent-0001",
  userDid: "did:local:123abc",
  scope: "marketplace",
  grantedAt: "2025-01-13T12:00:00Z",
  expiresAt: null,
  signature: "0xabc123...",
  ipfsHash: "QmX1Y2Z3...",
  blockchainTxHash: "0xdef456..."
};