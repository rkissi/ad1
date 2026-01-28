// Publisher SDK for Metaverse Advertising Platform
// Provides easy integration for publishers to request and display ads

export interface AdSlot {
  slotId: string;
  width: number;
  height: number;
  format: 'banner' | 'video' | 'native' | 'interstitial';
  context: {
    keywords?: string[];
    categories?: string[];
    url?: string;
    referrer?: string;
    userAgent?: string;
    deviceType?: 'desktop' | 'mobile' | 'tablet';
    [key: string]: any;
  };
}

export interface AdRequest {
  slotId: string;
  publisherDid: string;
  userDid?: string;
  context: AdSlot['context'];
  timestamp: string;
  sessionId: string;
}

export interface AdResponse {
  adId: string;
  campaignId: string;
  creative: {
    type: 'html5' | 'image' | 'video' | 'native';
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

export interface PublisherConfig {
  publisherId: string;
  apiUrl: string;
  apiKey?: string;
  enableAnalytics: boolean;
  enableConsent: boolean;
  debugMode: boolean;
}

export interface EventData {
  eventType: 'impression' | 'click' | 'conversion' | 'viewability';
  adId: string;
  slotId: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export class PublisherSDK {
  private config: PublisherConfig;
  private sessionId: string;
  private eventQueue: EventData[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isInitialized: boolean = false;
  private adSlots: Map<string, AdSlot> = new Map();
  private activeAds: Map<string, AdResponse> = new Map();

  constructor(config: PublisherConfig) {
    this.config = {
      enableAnalytics: true,
      enableConsent: true,
      debugMode: false,
      ...config
    };
    this.sessionId = this.generateSessionId();
    
    if (this.config.debugMode) {
      console.log('🚀 Publisher SDK initialized:', this.config);
    }
  }

  /**
   * Initialize the SDK
   */
  async initialize(): Promise<void> {
    try {
      // Verify publisher with the platform
      const verification = await this.verifyPublisher();
      if (!verification.verified) {
        throw new Error('Publisher verification failed');
      }

      // Setup event tracking
      this.setupEventTracking();
      
      // Setup page visibility tracking
      this.setupVisibilityTracking();
      
      // Setup automatic event flushing
      this.startEventFlushing();
      
      this.isInitialized = true;
      
      if (this.config.debugMode) {
        console.log('✅ Publisher SDK initialized successfully');
      }
    } catch (error) {
      console.error('❌ Publisher SDK initialization failed:', error);
      throw error;
    }
  }

  /**
   * Register an ad slot
   */
  registerAdSlot(slot: AdSlot): void {
    this.adSlots.set(slot.slotId, slot);
    
    if (this.config.debugMode) {
      console.log('📍 Ad slot registered:', slot.slotId);
    }
  }

  /**
   * Request an ad for a specific slot
   */
  async requestAd(slotId: string, userDid?: string): Promise<AdResponse | null> {
    if (!this.isInitialized) {
      throw new Error('SDK not initialized. Call initialize() first.');
    }

    const slot = this.adSlots.get(slotId);
    if (!slot) {
      throw new Error(`Ad slot ${slotId} not registered`);
    }

    try {
      const adRequest: AdRequest = {
        slotId,
        publisherDid: this.config.publisherId,
        userDid,
        context: {
          ...slot.context,
          url: window.location.href,
          referrer: document.referrer,
          userAgent: navigator.userAgent,
          deviceType: this.detectDeviceType(),
          timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString(),
        sessionId: this.sessionId
      };

      const response = await fetch(`${this.config.apiUrl}/api/v1/marketplace/match`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
        },
        body: JSON.stringify({
          slot,
          publisherDid: this.config.publisherId,
          userDid,
          sessionId: this.sessionId,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Ad request failed: ${response.status}`);
      }

      const result = await response.json();
      const ad = result.data;

      if (ad) {
        this.activeAds.set(ad.adId, ad);
        
        if (this.config.debugMode) {
          console.log('🎯 Ad received:', ad.adId, 'for slot:', slotId);
        }
      }

      return ad;
    } catch (error) {
      console.error('Failed to request ad:', error);
      return null;
    }
  }

  /**
   * Render an ad in a DOM element
   */
  renderAd(ad: AdResponse, containerElement: HTMLElement): void {
    if (!ad || !containerElement) {
      console.error('Invalid ad or container element');
      return;
    }

    try {
      // Clear existing content
      containerElement.innerHTML = '';
      
      // Create ad container
      const adContainer = document.createElement('div');
      adContainer.className = 'metaverse-ad-container';
      adContainer.style.cssText = `
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
        cursor: pointer;
      `;
      
      // Add creative content
      if (ad.creative.type === 'html5') {
        adContainer.innerHTML = ad.creative.content;
      } else if (ad.creative.type === 'image') {
        const img = document.createElement('img');
        img.src = ad.creative.content;
        img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
        adContainer.appendChild(img);
      } else if (ad.creative.type === 'video') {
        const video = document.createElement('video');
        video.src = ad.creative.content;
        video.autoplay = true;
        video.muted = true;
        video.loop = true;
        video.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
        adContainer.appendChild(video);
      }
      
      // Add click handler
      adContainer.addEventListener('click', () => {
        this.handleAdClick(ad);
      });
      
      // Setup impression tracking
      this.setupImpressionTracking(ad, adContainer);
      
      // Add to container
      containerElement.appendChild(adContainer);
      
      if (this.config.debugMode) {
        console.log('🎨 Ad rendered:', ad.adId);
      }
    } catch (error) {
      console.error('Failed to render ad:', error);
    }
  }

  /**
   * Request and render ad in one call
   */
  async loadAd(slotId: string, containerElement: HTMLElement, userDid?: string): Promise<boolean> {
    try {
      const ad = await this.requestAd(slotId, userDid);
      if (ad) {
        this.renderAd(ad, containerElement);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to load ad:', error);
      return false;
    }
  }

  /**
   * Track custom events
   */
  trackEvent(eventType: 'impression' | 'click' | 'conversion' | 'viewability', adId: string, slotId: string, metadata?: Record<string, any>): void {
    const event: EventData = {
      eventType,
      adId,
      slotId,
      timestamp: new Date().toISOString(),
      metadata: {
        ...metadata,
        sessionId: this.sessionId,
        userAgent: navigator.userAgent,
        url: window.location.href
      }
    };

    this.eventQueue.push(event);
    
    if (this.config.debugMode) {
      console.log('📊 Event tracked:', eventType, adId);
    }

    // Flush immediately for critical events
    if (eventType === 'click' || eventType === 'conversion') {
      this.flushEvents();
    }
  }

  /**
   * Get publisher metrics
   */
  async getMetrics(): Promise<any> {
    try {
      const response = await fetch(`${this.config.apiUrl}/api/v1/publishers/${this.config.publisherId}/metrics`, {
        headers: {
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
        }
      });

      if (!response.ok) {
        throw new Error(`Metrics request failed: ${response.status}`);
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Failed to get metrics:', error);
      return null;
    }
  }

  /**
   * Cleanup and destroy SDK instance
   */
  destroy(): void {
    // Flush remaining events
    this.flushEvents();
    
    // Clear timers
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    // Clear data
    this.adSlots.clear();
    this.activeAds.clear();
    this.eventQueue = [];
    
    this.isInitialized = false;
    
    if (this.config.debugMode) {
      console.log('🧹 Publisher SDK destroyed');
    }
  }

  // ==================== PRIVATE METHODS ====================

  private async verifyPublisher(): Promise<{ verified: boolean; publisher?: any }> {
    try {
      const response = await fetch(`${this.config.apiUrl}/api/v1/publishers/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
        },
        body: JSON.stringify({ publisherId: this.config.publisherId })
      });

      if (!response.ok) {
        return { verified: false };
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Publisher verification failed:', error);
      return { verified: false };
    }
  }

  private setupEventTracking(): void {
    // Track page unload to flush events
    window.addEventListener('beforeunload', () => {
      this.flushEvents();
    });

    // Track page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.flushEvents();
      }
    });
  }

  private setupVisibilityTracking(): void {
    // Setup Intersection Observer for viewability tracking
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          const adId = entry.target.getAttribute('data-ad-id');
          const slotId = entry.target.getAttribute('data-slot-id');
          
          if (adId && slotId) {
            if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
              this.trackEvent('viewability', adId, slotId, {
                viewabilityRatio: entry.intersectionRatio,
                viewabilityTime: Date.now()
              });
            }
          }
        });
      }, {
        threshold: [0.5, 1.0]
      });

      // Store observer for later use
      (this as any).visibilityObserver = observer;
    }
  }

  private setupImpressionTracking(ad: AdResponse, element: HTMLElement): void {
    // Set data attributes for tracking
    element.setAttribute('data-ad-id', ad.adId);
    element.setAttribute('data-slot-id', ad.creative.clickUrl.split('/').pop() || '');
    
    // Setup intersection observer for impression tracking
    if ((this as any).visibilityObserver) {
      (this as any).visibilityObserver.observe(element);
    }
    
    // Track impression immediately when ad becomes visible
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.trackEvent('impression', ad.adId, element.getAttribute('data-slot-id') || '', {
            campaignId: ad.campaignId,
            bid: ad.bid,
            currency: ad.currency
          });
          observer.disconnect(); // Only track impression once
        }
      });
    }, { threshold: 0.5 });
    
    observer.observe(element);
  }

  private handleAdClick(ad: AdResponse): void {
    // Track click event
    this.trackEvent('click', ad.adId, '', {
      campaignId: ad.campaignId,
      clickUrl: ad.creative.clickUrl,
      bid: ad.bid,
      currency: ad.currency
    });

    // Open click URL
    if (ad.creative.clickUrl) {
      window.open(ad.creative.clickUrl, '_blank', 'noopener,noreferrer');
    }
  }

  private startEventFlushing(): void {
    // Flush events every 10 seconds
    this.flushTimer = setInterval(() => {
      this.flushEvents();
    }, 10000);
  }

  private async flushEvents(): Promise<void> {
    if (this.eventQueue.length === 0) {
      return;
    }

    const eventsToFlush = [...this.eventQueue];
    this.eventQueue = [];

    try {
      const response = await fetch(`${this.config.apiUrl}/api/v1/events/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
        },
        body: JSON.stringify({
          events: eventsToFlush,
          publisherId: this.config.publisherId,
          sessionId: this.sessionId
        })
      });

      if (!response.ok) {
        // Re-queue events if flush failed
        this.eventQueue.unshift(...eventsToFlush);
        console.error('Failed to flush events:', response.status);
      } else if (this.config.debugMode) {
        console.log(`📤 Flushed ${eventsToFlush.length} events`);
      }
    } catch (error) {
      // Re-queue events if flush failed
      this.eventQueue.unshift(...eventsToFlush);
      console.error('Failed to flush events:', error);
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private detectDeviceType(): 'desktop' | 'mobile' | 'tablet' {
    const userAgent = navigator.userAgent;
    
    if (/tablet|ipad|playbook|silk/i.test(userAgent)) {
      return 'tablet';
    }
    
    if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(userAgent)) {
      return 'mobile';
    }
    
    return 'desktop';
  }
}

// ==================== CONVENIENCE FUNCTIONS ====================

/**
 * Initialize the Publisher SDK with configuration
 */
export async function initializePublisherSDK(config: PublisherConfig): Promise<PublisherSDK> {
  const sdk = new PublisherSDK(config);
  await sdk.initialize();
  return sdk;
}

/**
 * Create a simple ad slot configuration
 */
export function createAdSlot(
  slotId: string,
  width: number,
  height: number,
  format: AdSlot['format'] = 'banner',
  keywords: string[] = []
): AdSlot {
  return {
    slotId,
    width,
    height,
    format,
    context: {
      keywords,
      categories: [],
      deviceType: 'desktop'
    }
  };
}

/**
 * Auto-initialize SDK from script tag attributes
 */
export function autoInitialize(): void {
  // Look for script tag with SDK configuration
  const scriptTag = document.querySelector('script[data-publisher-id]') as HTMLScriptElement;
  
  if (scriptTag) {
    const config: PublisherConfig = {
      publisherId: scriptTag.dataset.publisherId!,
      apiUrl: scriptTag.dataset.apiUrl || 'http://localhost:3001',
      apiKey: scriptTag.dataset.apiKey,
      enableAnalytics: scriptTag.dataset.enableAnalytics !== 'false',
      enableConsent: scriptTag.dataset.enableConsent !== 'false',
      debugMode: scriptTag.dataset.debugMode === 'true'
    };

    initializePublisherSDK(config).then(sdk => {
      // Make SDK globally available
      (window as any).MetaverseAdsSDK = sdk;
      
      // Dispatch ready event
      window.dispatchEvent(new CustomEvent('metaverse-ads-ready', { detail: sdk }));
    }).catch(error => {
      console.error('Failed to auto-initialize Publisher SDK:', error);
    });
  }
}

// Auto-initialize if script is loaded
if (typeof window !== 'undefined' && document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoInitialize);
} else if (typeof window !== 'undefined') {
  autoInitialize();
}

export default PublisherSDK;