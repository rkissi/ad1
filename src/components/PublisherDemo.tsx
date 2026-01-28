import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Navbar } from '@/components/ui/navbar';
import { 
  Sidebar, 
  SidebarItem, 
  SidebarGroup, 
  SidebarSeparator,
  SidebarItemCollapsed 
} from '@/components/ui/sidebar';
import { 
  Globe, 
  Code, 
  Eye, 
  MousePointer, 
  DollarSign,
  Settings,
  Play,
  Pause,
  RefreshCw,
  Copy,
  ExternalLink,
  Zap,
  BarChart3,
  Home,
  Monitor,
  FileCode,
  TrendingUp,
  CreditCard,
  HelpCircle,
  Activity,
  Loader2
} from 'lucide-react';
import { useAuthSafe, publisherAPI, analyticsAPI } from '@/lib/auth-context';
import { marketplaceService } from '@/lib/marketplace-service';
import type { Publisher } from '@/types/supabase';

interface PublisherDemoProps {
  publisherId?: string;
}

export default function PublisherDemo({ publisherId }: PublisherDemoProps) {
  const { user, logout } = useAuthSafe();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [publisher, setPublisher] = useState<Publisher | null>(null);
  const [stats, setStats] = useState({
    totalImpressions: 0,
    totalClicks: 0,
    totalEarnings: 0,
    ctr: 0
  });

  // Load publisher data
  useEffect(() => {
    if (user?.id) {
      loadPublisherData();
    }
  }, [user?.id]);

  const loadPublisherData = async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      let publisherData = await publisherAPI.getByUserId(user.id).catch(() => null);
      
      // If no publisher exists, create a default one
      if (!publisherData) {
        publisherData = {
          id: '',
          user_id: user.id,
          name: (user?.displayName || 'Publisher') + "'s Site",
          domain: 'example.com',
          description: 'A sample website demonstrating ad integration',
          categories: ['technology', 'news'],
          ad_slots: [],
          payout_preferences: {},
          total_impressions: 0,
          total_clicks: 0,
          total_earnings: 0,
          status: 'active',
          api_key: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }
      
      setPublisher(publisherData);
      
      if (publisherData.id) {
        const publisherStats = await analyticsAPI.getDashboardStats(user.id, 'publisher');
        setStats({
          totalImpressions: (publisherStats as any).totalImpressions || 0,
          totalClicks: (publisherStats as any).totalClicks || 0,
          totalEarnings: (publisherStats as any).totalEarnings || 0,
          ctr: (publisherStats as any).ctr || 0
        });
      }
    } catch (error) {
      console.error('Error loading publisher data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Default publisher data for display
  const displayPublisher = publisher || {
    id: '',
    user_id: user?.id || '',
    name: "Demo News Site",
    domain: "demo-news.com",
    description: "A sample news website demonstrating ad integration",
    categories: ["news", "technology", "business"],
    ad_slots: [
      {
        slotId: "header-banner",
        publisherDid: user?.id || '',
        context: {
          url: "https://demo-news.com/tech-article",
          title: "Latest Technology Trends",
          content: "Exploring the future of technology...",
          categories: ["technology", "innovation"],
          keywords: ["tech", "innovation", "future", "trends"]
        },
        dimensions: { width: 728, height: 90 },
        position: "header",
        allowedFormats: ["html5", "image"],
        minBid: 0.01
      },
      {
        slotId: "sidebar-ad",
        publisherDid: publisherId,
        context: {
          url: "https://demo-news.com/business-article",
          title: "Business Growth Strategies",
          content: "How companies are scaling...",
          categories: ["business", "finance"],
          keywords: ["business", "growth", "strategy", "finance"]
        },
        dimensions: { width: 300, height: 250 },
        position: "sidebar",
        allowedFormats: ["html5", "image", "video"],
        minBid: 0.005
      }
    ],
    payoutPreferences: {
      currency: "DEV-ERC20",
      walletAddress: "0x123...abc",
      minimumPayout: 10
    },
    metrics: {
      totalImpressions: 15420,
      totalClicks: 892,
      totalEarnings: 156.78
    },
    status: "active",
    created_at: "2025-01-10T12:00:00Z",
    updated_at: "2025-01-13T12:00:00Z"
  };

  const [adSlots, setAdSlots] = useState<any[]>(displayPublisher.ad_slots || []);
  const [currentAds, setCurrentAds] = useState<Record<string, any | null>>({});
  const [sdkStatus, setSdkStatus] = useState<'loading' | 'ready' | 'error'>('ready');
  const [recentEvents, setRecentEvents] = useState([
    { id: '1', type: 'impression', slotId: 'header-banner', timestamp: '2025-01-13T10:30:00Z', revenue: 0.001 },
    { id: '2', type: 'click', slotId: 'sidebar-ad', timestamp: '2025-01-13T10:25:00Z', revenue: 0.01 },
    { id: '3', type: 'impression', slotId: 'sidebar-ad', timestamp: '2025-01-13T10:20:00Z', revenue: 0.001 }
  ]);

  const adSlotRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Simulate SDK functionality
  const requestAd = async (slotId: string) => {
    setSdkStatus('loading');
    
    const slot = adSlots.find(s => s.slotId === slotId);
    if (!slot) return;

    try {
      // Request ad from real marketplace service
      const adResponse = await marketplaceService.requestAd({
        publisherId: publisher?.id || '',
        slotId,
        userId: user?.id,
        context: {
          url: window.location.href,
          categories: displayPublisher?.categories || []
        }
      });

      if (adResponse) {
        const ad: any = {
          adId: adResponse.adId,
          campaignId: adResponse.campaignId,
          creative: {
            type: "html5",
            content: `
              <div style="
                width: ${slot.dimensions.width}px; 
                height: ${slot.dimensions.height}px; 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-family: Arial, sans-serif;
                border-radius: 8px;
                cursor: pointer;
                position: relative;
                overflow: hidden;
              ">
                <div style="text-align: center; z-index: 2;">
                  <h3 style="margin: 0; font-size: 18px; font-weight: bold;">${adResponse.creative.headline}</h3>
                  <p style="margin: 5px 0; font-size: 14px;">${adResponse.creative.description}</p>
                  <button style="
                    background: rgba(255,255,255,0.2);
                    border: 1px solid rgba(255,255,255,0.3);
                    color: white;
                    padding: 8px 16px;
                    border-radius: 20px;
                    cursor: pointer;
                    font-size: 12px;
                  ">${adResponse.creative.ctaText}</button>
                </div>
              </div>
            `,
            assets: [],
            clickUrl: adResponse.creative.ctaUrl,
            impressionTrackingUrl: adResponse.trackingUrls.impression,
            clickTrackingUrl: adResponse.trackingUrls.click
          },
          bid: 0.015,
          currency: "USD",
          expiresAt: new Date(Date.now() + 3600000).toISOString()
        };

        setCurrentAds(prev => ({ ...prev, [slotId]: ad }));
        setSdkStatus('ready');

        // Track impression via marketplace service
        marketplaceService.trackImpressionPixel(adResponse.trackingUrls.impression);
        trackEvent('impression', slotId, ad.adId);
      } else {
        // Fallback to mock ad if no ads available
        const mockAd: any = {
          adId: `ad-${Date.now()}`,
          campaignId: "demo-campaign",
          creative: {
            type: "html5",
            content: `
              <div style="
                width: ${slot.dimensions.width}px; 
                height: ${slot.dimensions.height}px; 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-family: Arial, sans-serif;
                border-radius: 8px;
                cursor: pointer;
              ">
                <div style="text-align: center;">
                  <h3 style="margin: 0; font-size: 18px;">No Ads Available</h3>
                  <p style="margin: 5px 0; font-size: 14px;">Create a campaign to see ads here</p>
                </div>
              </div>
            `,
            assets: [],
            clickUrl: "#",
          },
          bid: 0,
          currency: "USD",
          expiresAt: new Date(Date.now() + 3600000).toISOString()
        };
        setCurrentAds(prev => ({ ...prev, [slotId]: mockAd }));
        setSdkStatus('ready');
      }
    } catch (error) {
      console.error('Error requesting ad:', error);
      setSdkStatus('error');
    }
  };

  const trackEvent = (eventType: 'impression' | 'click', slotId: string, adId: string) => {
    const revenue = eventType === 'impression' ? 0.001 : 0.01;
    const newEvent = {
      id: Date.now().toString(),
      type: eventType,
      slotId,
      timestamp: new Date().toISOString(),
      revenue
    };
    
    setRecentEvents(prev => [newEvent, ...prev.slice(0, 9)]);
  };

  const handleAdClick = (slotId: string, ad: any) => {
    trackEvent('click', slotId, ad.adId);
    window.open(ad.creative.clickUrl, '_blank');
  };

  const refreshAd = (slotId: string) => {
    setCurrentAds(prev => ({ ...prev, [slotId]: null }));
    requestAd(slotId);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
  };

  const sdkIntegrationCode = `// Install the SDK
npm install @metaverse-ad/publisher-sdk

// Initialize the SDK
import { MetaverseAdSDK } from '@metaverse-ad/publisher-sdk';

const sdk = new MetaverseAdSDK({
  publisherId: '${publisherId}',
  apiUrl: 'https://api.metaverse-ad.com',
  debug: true
});

// Request an ad for a slot
const adSlot = {
  slotId: 'header-banner',
  dimensions: { width: 728, height: 90 },
  context: {
    url: window.location.href,
    title: document.title,
    categories: ['technology', 'news'],
    keywords: ['tech', 'innovation']
  }
};

sdk.requestAd(adSlot)
  .then(ad => {
    if (ad) {
      // Render the ad
      document.getElementById('ad-container').innerHTML = ad.creative.content;
      
      // Track impression
      sdk.trackImpression(ad.adId, adSlot.slotId);
      
      // Handle clicks
      document.getElementById('ad-container').onclick = () => {
        sdk.trackClick(ad.adId, adSlot.slotId);
        window.open(ad.creative.clickUrl, '_blank');
      };
    }
  })
  .catch(error => console.error('Ad request failed:', error));`;

  useEffect(() => {
    // Auto-request ads for all slots on component mount
    adSlots.forEach(slot => {
      requestAd(slot.slotId);
    });
  }, []);

  const renderSidebarContent = () => (
    <>
      <SidebarGroup>
        <SidebarItem
          icon={<Home className="w-5 h-5" />}
          label="Dashboard"
          active={activeTab === 'dashboard'}
          onClick={() => setActiveTab('dashboard')}
        />
        <SidebarItem
          icon={<Monitor className="w-5 h-5" />}
          label="Live Demo"
          active={activeTab === 'demo'}
          onClick={() => setActiveTab('demo')}
        />
        <SidebarItem
          icon={<Code className="w-5 h-5" />}
          label="SDK Integration"
          active={activeTab === 'integration'}
          onClick={() => setActiveTab('integration')}
        />
        <SidebarItem
          icon={<BarChart3 className="w-5 h-5" />}
          label="Analytics"
          active={activeTab === 'analytics'}
          onClick={() => setActiveTab('analytics')}
        />
      </SidebarGroup>

      <SidebarSeparator />

      <SidebarGroup label="Account">
        <SidebarItem
          icon={<CreditCard className="w-5 h-5" />}
          label="Payouts"
          active={activeTab === 'payouts'}
          onClick={() => setActiveTab('payouts')}
        />
        <SidebarItem
          icon={<Settings className="w-5 h-5" />}
          label="Settings"
          active={activeTab === 'settings'}
          onClick={() => setActiveTab('settings')}
        />
        <SidebarItem
          icon={<HelpCircle className="w-5 h-5" />}
          label="Help & Support"
          active={activeTab === 'help'}
          onClick={() => setActiveTab('help')}
        />
      </SidebarGroup>
    </>
  );

  const renderCollapsedSidebar = () => (
    <div className="py-4 space-y-2">
      <SidebarItemCollapsed
        icon={<Home className="w-5 h-5" />}
        label="Dashboard"
        active={activeTab === 'dashboard'}
        onClick={() => setActiveTab('dashboard')}
      />
      <SidebarItemCollapsed
        icon={<Monitor className="w-5 h-5" />}
        label="Live Demo"
        active={activeTab === 'demo'}
        onClick={() => setActiveTab('demo')}
      />
      <SidebarItemCollapsed
        icon={<Code className="w-5 h-5" />}
        label="SDK Integration"
        active={activeTab === 'integration'}
        onClick={() => setActiveTab('integration')}
      />
      <SidebarItemCollapsed
        icon={<BarChart3 className="w-5 h-5" />}
        label="Analytics"
        active={activeTab === 'analytics'}
        onClick={() => setActiveTab('analytics')}
      />
      <div className="my-4 border-t border-gray-200" />
      <SidebarItemCollapsed
        icon={<CreditCard className="w-5 h-5" />}
        label="Payouts"
        active={activeTab === 'payouts'}
        onClick={() => setActiveTab('payouts')}
      />
      <SidebarItemCollapsed
        icon={<Settings className="w-5 h-5" />}
        label="Settings"
        active={activeTab === 'settings'}
        onClick={() => setActiveTab('settings')}
      />
      <SidebarItemCollapsed
        icon={<HelpCircle className="w-5 h-5" />}
        label="Help & Support"
        active={activeTab === 'help'}
        onClick={() => setActiveTab('help')}
      />
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar 
        collapsed={sidebarCollapsed} 
        onCollapsedChange={setSidebarCollapsed}
        className="hidden lg:flex"
      >
        {sidebarCollapsed ? renderCollapsedSidebar() : renderSidebarContent()}
      </Sidebar>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Navbar */}
        <Navbar
          title="Publisher Dashboard"
          user={{
            name: user?.name || "Publisher",
            email: user?.email || "publisher@example.com",
            role: user?.role || 'publisher',
            tokenBalance: stats.totalEarnings.toFixed(2)
          }}
          onLogout={logout}
          notifications={1}
        />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Publisher Overview</h2>
                  <p className="text-gray-600">Integration example for {displayPublisher?.name || 'Publisher'}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <Globe className="w-3 h-3 mr-1" />
                    {displayPublisher?.domain || 'example.com'}
                  </Badge>
                  <Badge variant={sdkStatus === 'ready' ? 'default' : 'secondary'}>
                    SDK {sdkStatus}
                  </Badge>
                </div>
              </div>

              {/* Publisher Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Eye className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Total Impressions</p>
                        <p className="text-2xl font-bold">{stats.totalImpressions.toLocaleString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <MousePointer className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Total Clicks</p>
                        <p className="text-2xl font-bold">{stats.totalClicks.toLocaleString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-yellow-100 rounded-lg">
                        <DollarSign className="w-6 h-6 text-yellow-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Total Earnings</p>
                        <p className="text-2xl font-bold">${stats.totalEarnings}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <BarChart3 className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">CTR</p>
                        <p className="text-2xl font-bold">
                          {stats.totalImpressions > 0 ? ((stats.totalClicks / stats.totalImpressions) * 100).toFixed(2) : 0}%
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Events */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Ad Events</CardTitle>
                  <CardDescription>Real-time tracking of ad interactions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recentEvents.slice(0, 5).map((event) => (
                      <div key={event.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div className="flex items-center space-x-3">
                          {event.type === 'impression' ? (
                            <div className="p-2 bg-blue-100 rounded-lg">
                              <Eye className="w-4 h-4 text-blue-600" />
                            </div>
                          ) : (
                            <div className="p-2 bg-green-100 rounded-lg">
                              <MousePointer className="w-4 h-4 text-green-600" />
                            </div>
                          )}
                          <div>
                            <span className="font-medium capitalize">{event.type}</span>
                            <span className="text-gray-600 ml-2">• {event.slotId}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-medium text-green-600">+${event.revenue}</span>
                          <div className="text-xs text-gray-500">
                            {new Date(event.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'demo' && (
            <div className="space-y-6">
              {/* Simulated Website */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Globe className="w-5 h-5" />
                    <span>Demo News Website</span>
                  </CardTitle>
                  <CardDescription>
                    Live demonstration of ad integration in a typical website
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg p-4 bg-white">
                    {/* Header with ad slot */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <h2 className="text-lg font-bold">Demo News</h2>
                        <nav className="flex space-x-4 text-sm">
                          <a href="#" className="text-blue-600">Home</a>
                          <a href="#" className="text-blue-600">Tech</a>
                          <a href="#" className="text-blue-600">Business</a>
                        </nav>
                      </div>
                      
                      {/* Header Ad Slot */}
                      <div className="border-2 border-dashed border-gray-300 rounded p-2 mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-gray-500">Header Banner (728x90)</span>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => refreshAd('header-banner')}
                            disabled={sdkStatus === 'loading'}
                          >
                            <RefreshCw className="w-3 h-3" />
                          </Button>
                        </div>
                        <div 
                          ref={el => adSlotRefs.current['header-banner'] = el}
                          onClick={() => currentAds['header-banner'] && handleAdClick('header-banner', currentAds['header-banner'])}
                          dangerouslySetInnerHTML={{ 
                            __html: currentAds['header-banner']?.creative.content || 
                              '<div style="width: 728px; height: 90px; background: #f3f4f6; display: flex; align-items: center; justify-content: center; color: #6b7280; border-radius: 4px;">Loading ad...</div>'
                          }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Main Content */}
                      <div className="md:col-span-2">
                        <article>
                          <h1 className="text-2xl font-bold mb-2">Latest Technology Trends</h1>
                          <p className="text-gray-600 mb-4">Published on January 13, 2025</p>
                          <p className="mb-4">
                            The technology landscape continues to evolve at an unprecedented pace. 
                            From artificial intelligence to blockchain, new innovations are reshaping 
                            how we work, communicate, and live our daily lives.
                          </p>
                          <p className="mb-4">
                            In this comprehensive analysis, we explore the most significant trends 
                            that will define the next decade of technological advancement...
                          </p>
                        </article>
                      </div>

                      {/* Sidebar with ad slot */}
                      <div className="space-y-4">
                        <div className="border-2 border-dashed border-gray-300 rounded p-2">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-gray-500">Sidebar Ad (300x250)</span>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => refreshAd('sidebar-ad')}
                              disabled={sdkStatus === 'loading'}
                            >
                              <RefreshCw className="w-3 h-3" />
                            </Button>
                          </div>
                          <div 
                            ref={el => adSlotRefs.current['sidebar-ad'] = el}
                            onClick={() => currentAds['sidebar-ad'] && handleAdClick('sidebar-ad', currentAds['sidebar-ad'])}
                            dangerouslySetInnerHTML={{ 
                              __html: currentAds['sidebar-ad']?.creative.content || 
                                '<div style="width: 300px; height: 250px; background: #f3f4f6; display: flex; align-items: center; justify-content: center; color: #6b7280; border-radius: 4px;">Loading ad...</div>'
                            }}
                          />
                        </div>

                        <div className="bg-gray-50 p-4 rounded">
                          <h3 className="font-semibold mb-2">Related Articles</h3>
                          <ul className="space-y-2 text-sm">
                            <li><a href="#" className="text-blue-600">AI in Healthcare</a></li>
                            <li><a href="#" className="text-blue-600">Blockchain Revolution</a></li>
                            <li><a href="#" className="text-blue-600">Future of Work</a></li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'integration' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Code className="w-5 h-5" />
                    <span>SDK Integration Guide</span>
                  </CardTitle>
                  <CardDescription>
                    Complete code example for integrating the Metaverse Ad SDK
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Alert>
                      <Zap className="h-4 w-4" />
                      <AlertDescription>
                        The SDK handles ad requests, rendering, and event tracking automatically.
                        Just define your ad slots and the SDK does the rest!
                      </AlertDescription>
                    </Alert>

                    <div className="relative">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                        <code>{sdkIntegrationCode}</code>
                      </pre>
                      <Button
                        size="sm"
                        variant="outline"
                        className="absolute top-2 right-2"
                        onClick={() => copyCode(sdkIntegrationCode)}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-semibold mb-2">Key Features</h4>
                        <ul className="space-y-1 text-sm text-gray-600">
                          <li>• Automatic ad matching</li>
                          <li>• Privacy-compliant tracking</li>
                          <li>• Real-time bidding</li>
                          <li>• Revenue optimization</li>
                          <li>• Easy integration</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Supported Formats</h4>
                        <ul className="space-y-1 text-sm text-gray-600">
                          <li>• HTML5 Interactive</li>
                          <li>• Static Images</li>
                          <li>• Video Content</li>
                          <li>• Rich Media</li>
                          <li>• Native Ads</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Ad Slot Configuration</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {adSlots.map((slot) => (
                      <div key={slot.slotId} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold">{slot.slotId}</h4>
                          <Badge variant="outline">{slot.position}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Dimensions:</span>
                            <span className="ml-2">{slot.dimensions.width}x{slot.dimensions.height}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Min Bid:</span>
                            <span className="ml-2">${slot.minBid}</span>
                          </div>
                        </div>
                        <div className="mt-2">
                          <span className="text-gray-600 text-sm">Formats:</span>
                          <div className="flex space-x-2 mt-1">
                            {slot.allowedFormats.map((format) => (
                              <Badge key={format} variant="secondary" className="text-xs">
                                {format}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Analytics & Performance</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Performance Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span>Fill Rate</span>
                        <span className="font-semibold">94.2%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Average CPM</span>
                        <span className="font-semibold">$2.15</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Revenue per Visit</span>
                        <span className="font-semibold">$0.08</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Viewability Rate</span>
                        <span className="font-semibold">87.3%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Top Performing Slots</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span>header-banner</span>
                        <span className="font-semibold">$89.45</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>sidebar-ad</span>
                        <span className="font-semibold">$67.33</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'payouts' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Payouts & Earnings</h2>
              
              <Card>
                <CardHeader>
                  <CardTitle>Earnings Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-green-50 rounded-lg">
                      <h3 className="font-medium text-green-800">Available Balance</h3>
                      <p className="text-2xl font-bold text-green-900">${stats.totalEarnings}</p>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h3 className="font-medium text-blue-800">This Month</h3>
                      <p className="text-2xl font-bold text-blue-900">$45.20</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <h3 className="font-medium text-purple-800">Pending</h3>
                      <p className="text-2xl font-bold text-purple-900">$12.50</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Publisher Settings</h2>
              
              <Card>
                <CardHeader>
                  <CardTitle>Account Information</CardTitle>
                  <CardDescription>Configure your publisher account and preferences</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label htmlFor="publisherName">Publisher Name</Label>
                    <Input id="publisherName" defaultValue={displayPublisher?.name || ''} />
                  </div>
                  <div>
                    <Label htmlFor="domain">Domain</Label>
                    <Input id="domain" defaultValue={displayPublisher?.domain || ''} />
                  </div>
                  <div>
                    <Label htmlFor="walletAddress">Payout Wallet Address</Label>
                    <Input id="walletAddress" defaultValue={(displayPublisher?.payout_preferences as any)?.walletAddress || ''} />
                  </div>
                  <div>
                    <Label htmlFor="minPayout">Minimum Payout ($)</Label>
                    <Input 
                      id="minPayout" 
                      type="number" 
                      defaultValue={(displayPublisher?.payout_preferences as any)?.minimumPayout || 50} 
                    />
                  </div>
                  <Button>Save Settings</Button>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'help' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Help & Support</h2>
              
              <Card>
                <CardHeader>
                  <CardTitle>Get Help</CardTitle>
                  <CardDescription>Resources and support for publishers</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button variant="outline" className="h-auto p-4 justify-start">
                      <div className="text-left">
                        <h4 className="font-medium">Publisher Guide</h4>
                        <p className="text-sm text-gray-600">Learn how to maximize your revenue</p>
                      </div>
                    </Button>
                    <Button variant="outline" className="h-auto p-4 justify-start">
                      <div className="text-left">
                        <h4 className="font-medium">Contact Support</h4>
                        <p className="text-sm text-gray-600">Get help from our team</p>
                      </div>
                    </Button>
                    <Button variant="outline" className="h-auto p-4 justify-start">
                      <div className="text-left">
                        <h4 className="font-medium">SDK Documentation</h4>
                        <p className="text-sm text-gray-600">Technical integration guides</p>
                      </div>
                    </Button>
                    <Button variant="outline" className="h-auto p-4 justify-start">
                      <div className="text-left">
                        <h4 className="font-medium">Best Practices</h4>
                        <p className="text-sm text-gray-600">Tips for better ad performance</p>
                      </div>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}