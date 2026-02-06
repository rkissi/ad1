import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Navbar } from '@/components/ui/navbar';
import { 
  Sidebar, 
  SidebarItem, 
  SidebarGroup, 
  SidebarSeparator,
  SidebarItemCollapsed 
} from '@/components/ui/sidebar';
import { 
  Plus, 
  TrendingUp, 
  Eye, 
  MousePointer, 
  DollarSign,
  Users,
  Calendar,
  BarChart3,
  Settings,
  Upload,
  Play,
  Pause,
  Edit,
  Trash2,
  Home,
  Megaphone,
  Target,
  PieChart,
  CreditCard,
  HelpCircle,
  Bell,
  X,
  Image,
  Video,
  FileText,
  Globe,
  Loader2
} from 'lucide-react';
import { useAuthSafe } from '@/lib/auth-context';
import { campaignAPI } from '@/lib/api/campaigns';
import { analyticsAPI } from '@/lib/api/analytics';
import { creativesAPI } from '@/lib/api/creatives';
import type { Campaign } from '@/types/supabase';
import BlockchainEscrowIntegration from './BlockchainEscrowIntegration';

interface AdvertiserDashboardProps {
  advertiserId?: string;
}

export default function AdvertiserDashboard({ advertiserId }: AdvertiserDashboardProps) {
  const { user, logout } = useAuthSafe();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [stats, setStats] = useState({
    totalCampaigns: 0,
    activeCampaigns: 0,
    totalImpressions: 0,
    totalClicks: 0,
    totalConversions: 0,
    totalSpent: 0,
    totalBudget: 0,
    ctr: 0,
    conversionRate: 0
  });

  // Load campaigns on mount
  useEffect(() => {
    if (user?.id) {
      loadData();
    }
  }, [user?.id]);

  const loadData = async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      const [userCampaigns, dashboardStats] = await Promise.all([
        campaignAPI.getAll(user.id),
        analyticsAPI.getDashboardStats(user.id, 'advertiser')
      ]);
      
      setCampaigns(userCampaigns || []);
      setStats(dashboardStats as any || stats);
    } catch (error) {
      console.error('Error loading advertiser data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCampaign = async (campaignData: Partial<Campaign>) => {
    setIsSaving(true);
    try {
      const newCampaign = await campaignAPI.create({
        ...campaignData,
        advertiser_id: user?.id,
        status: 'draft' // Start as draft, user can activate later
      });
      
      // If there's creative data, create the ad creative
      if (campaignData.creative_manifest && Object.keys(campaignData.creative_manifest).length > 0) {
        await creativesAPI.create({
          campaign_id: newCampaign.id,
          name: `${campaignData.name} - Creative`,
          type: 'banner',
          content: campaignData.creative_manifest,
          cta_text: 'Learn More',
          is_active: true
        });
      }
      
      setCampaigns(prev => [newCampaign, ...prev]);
      setActiveTab('campaigns');
      
      // Refresh stats
      const dashboardStats = await analyticsAPI.getDashboardStats(user!.id, 'advertiser');
      setStats(dashboardStats as any || stats);
    } catch (error) {
      console.error('Error creating campaign:', error);
      alert('Failed to create campaign. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateCampaign = async (id: string, updates: Partial<Campaign>) => {
    try {
      const updated = await campaignAPI.update(id, updates);
      setCampaigns(prev => prev.map(c => c.id === id ? updated : c));
      
      // Refresh stats if status changed
      if (updates.status) {
        const dashboardStats = await analyticsAPI.getDashboardStats(user!.id, 'advertiser');
        setStats(dashboardStats as any || stats);
      }
    } catch (error) {
      console.error('Error updating campaign:', error);
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!confirm('Are you sure you want to delete this campaign?')) return;
    
    try {
      await campaignAPI.delete(id);
      setCampaigns(prev => prev.filter(c => c.id !== id));
      
      // Refresh stats
      const dashboardStats = await analyticsAPI.getDashboardStats(user!.id, 'advertiser');
      setStats(dashboardStats as any || stats);
    } catch (error) {
      console.error('Error deleting campaign:', error);
    }
  };

  const activateCampaign = async (id: string) => {
    await handleUpdateCampaign(id, { status: 'active' as any });
  };

  const pauseCampaign = async (id: string) => {
    await handleUpdateCampaign(id, { status: 'paused' as any });
  };

  // Mock data for initial display when no campaigns exist
  const mockCampaigns: Campaign[] = campaigns.length === 0 && !isLoading ? [
    {
      id: 'demo-1',
      advertiser_id: user?.id || '',
      name: 'Summer Tech Sale 2024',
      description: 'Promote our latest tech products with exclusive summer discounts',
      audience_spec: { interests: ['technology', 'gaming'], ageRange: [18, 45] },
      budget: 5000,
      spent: 1250,
      currency: 'USD',
      creative_manifest: {},
      payout_rules: { impressionPayout: 0.001, clickPayout: 0.05 },
      delivery_constraints: {},
      status: 'active',
      start_date: new Date().toISOString(),
      end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      impressions: 45000,
      clicks: 1800,
      conversions: 45,
      ctr: 0.04,
      blockchain_tx_hash: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ] : campaigns;

  const [newCampaign, setNewCampaign] = useState<Partial<Campaign>>({
    name: '',
    description: '',
    budget: 0,
    audienceSpec: {
      interests: [],
      verifiableClaims: [],
      demographics: {
        ageRange: [18, 65],
        locations: [],
        languages: ['en']
      }
    },
    deliveryConstraints: {
      maxImpressionsPerUser: 3,
      maxClicksPerUser: 1,
      startDate: '',
      endDate: '',
      dailyBudgetLimit: 0
    },
    creativeManifest: {
      type: 'html5',
      url: '',
      assets: [],
      metadata: {}
    }
  });

  const [showCreateCampaign, setShowCreateCampaign] = useState(false);
  const [campaignStep, setCampaignStep] = useState(1);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);

  const availableInterests = [
    'travel', 'sailing', 'fashion', 'technology', 'gaming', 
    'fitness', 'food', 'music', 'art', 'sports', 'education',
    'sustainable-fashion', 'environment', 'health', 'finance'
  ];

  const availableLocations = [
    'US', 'CA', 'UK', 'AU', 'EU', 'JP', 'CN', 'IN', 'BR', 'MX'
  ];

  const totalMetrics = (mockCampaigns || []).reduce((acc, campaign) => ({
    impressions: acc.impressions + (campaign.impressions || 0),
    clicks: acc.clicks + (campaign.clicks || 0),
    conversions: acc.conversions + (campaign.conversions || 0),
    spent: acc.spent + (campaign.spent || 0)
  }), { impressions: 0, clicks: 0, conversions: 0, spent: 0 });

  const createCampaign = () => {
    const campaign: Campaign = {
      id: `camp-${Date.now()}`,
      advertiser: advertiserId,
      name: newCampaign.name || 'Untitled Campaign',
      description: newCampaign.description || '',
      audienceSpec: {
        interests: selectedInterests,
        verifiableClaims: newCampaign.audienceSpec?.verifiableClaims || [],
        demographics: {
          ageRange: newCampaign.audienceSpec?.demographics?.ageRange || [18, 65],
          locations: selectedLocations,
          languages: newCampaign.audienceSpec?.demographics?.languages || ['en']
        }
      },
      budget: newCampaign.budget || 0,
      currency: 'DEV-ERC20',
      creativeManifest: {
        type: newCampaign.creativeManifest?.type || 'html5',
        url: newCampaign.creativeManifest?.url || '/assets/creatives/default.html',
        assets: uploadedFiles.map(f => f.name),
        metadata: newCampaign.creativeManifest?.metadata || {}
      },
      payoutRules: {
        user: 0.6,
        publisher: 0.35,
        protocol: 0.05
      },
      deliveryConstraints: {
        maxImpressionsPerUser: newCampaign.deliveryConstraints?.maxImpressionsPerUser || 3,
        maxClicksPerUser: newCampaign.deliveryConstraints?.maxClicksPerUser || 1,
        startDate: newCampaign.deliveryConstraints?.startDate || new Date().toISOString(),
        endDate: newCampaign.deliveryConstraints?.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        dailyBudgetLimit: newCampaign.deliveryConstraints?.dailyBudgetLimit
      },
      status: 'draft',
      metrics: {
        impressions: 0,
        clicks: 0,
        conversions: 0,
        spent: 0
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setCampaigns(prev => [...prev, campaign]);
    resetCampaignForm();
    setShowCreateCampaign(false);
  };

  const resetCampaignForm = () => {
    setNewCampaign({
      name: '',
      description: '',
      budget: 0,
      audienceSpec: {
        interests: [],
        verifiableClaims: [],
        demographics: {
          ageRange: [18, 65],
          locations: [],
          languages: ['en']
        }
      },
      deliveryConstraints: {
        maxImpressionsPerUser: 3,
        maxClicksPerUser: 1,
        startDate: '',
        endDate: '',
        dailyBudgetLimit: 0
      },
      creativeManifest: {
        type: 'html5',
        url: '',
        assets: [],
        metadata: {}
      }
    });
    setSelectedInterests([]);
    setSelectedLocations([]);
    setUploadedFiles([]);
    setCampaignStep(1);
  };

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev => 
      prev.includes(interest) 
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const toggleLocation = (location: string) => {
    setSelectedLocations(prev => 
      prev.includes(location) 
        ? prev.filter(l => l !== location)
        : [...prev, location]
    );
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setUploadedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(newCampaign.name && newCampaign.description && newCampaign.budget && newCampaign.budget > 0);
      case 2:
        return selectedInterests.length > 0;
      case 3:
        return uploadedFiles.length > 0 || !!newCampaign.creativeManifest?.url;
      default:
        return true;
    }
  };

  const toggleCampaignStatus = async (campaignId: string) => {
    const campaign = campaigns.find(c => c.id === campaignId);
    if (!campaign) return;
    
    const newStatus = campaign.status === 'active' ? 'paused' : 'active';
    
    try {
      await handleUpdateCampaign(campaignId, { status: newStatus as any });
    } catch (error) {
      console.error('Error toggling campaign status:', error);
    }
  };

  const addInterest = (interest: string) => {
    if (interest && !newCampaign.audienceSpec?.interests.includes(interest)) {
      setNewCampaign(prev => ({
        ...prev,
        audienceSpec: {
          ...prev.audienceSpec!,
          interests: [...(prev.audienceSpec?.interests || []), interest]
        }
      }));
    }
  };

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
          icon={<Megaphone className="w-5 h-5" />}
          label="Campaigns"
          active={activeTab === 'campaigns'}
          onClick={() => setActiveTab('campaigns')}
          badge={campaigns.filter(c => c.status === 'active').length}
        />
        <SidebarItem
          icon={<BarChart3 className="w-5 h-5" />}
          label="Analytics"
          active={activeTab === 'analytics'}
          onClick={() => setActiveTab('analytics')}
        />
        <SidebarItem
          icon={<Upload className="w-5 h-5" />}
          label="Creatives"
          active={activeTab === 'creatives'}
          onClick={() => setActiveTab('creatives')}
        />
      </SidebarGroup>

      <SidebarSeparator />

      <SidebarGroup label="Account">
        <SidebarItem
          icon={<CreditCard className="w-5 h-5" />}
          label="Billing"
          active={activeTab === 'billing'}
          onClick={() => setActiveTab('billing')}
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
        icon={<Megaphone className="w-5 h-5" />}
        label="Campaigns"
        active={activeTab === 'campaigns'}
        onClick={() => setActiveTab('campaigns')}
        badge={campaigns.filter(c => c.status === 'active').length}
      />
      <SidebarItemCollapsed
        icon={<BarChart3 className="w-5 h-5" />}
        label="Analytics"
        active={activeTab === 'analytics'}
        onClick={() => setActiveTab('analytics')}
      />
      <SidebarItemCollapsed
        icon={<Upload className="w-5 h-5" />}
        label="Creatives"
        active={activeTab === 'creatives'}
        onClick={() => setActiveTab('creatives')}
      />
      <div className="my-4 border-t border-gray-200" />
      <SidebarItemCollapsed
        icon={<CreditCard className="w-5 h-5" />}
        label="Billing"
        active={activeTab === 'billing'}
        onClick={() => setActiveTab('billing')}
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
          title="Advertiser Dashboard"
          user={{
            name: user?.name || "Advertiser",
            email: user?.email || "advertiser@example.com",
            role: user?.role || 'advertiser',
            tokenBalance: "1,250.00"
          }}
          onLogout={logout}
          notifications={2}
        />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Campaign Overview</h2>
                  <p className="text-gray-600">Monitor your advertising performance and manage campaigns</p>
                </div>
                <Button onClick={() => setShowCreateCampaign(true)} className="flex items-center space-x-2">
                  <Plus className="w-4 h-4" />
                  <span>New Campaign</span>
                </Button>
              </div>

              {/* Overview Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Eye className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Total Impressions</p>
                        <p className="text-2xl font-bold">{totalMetrics.impressions.toLocaleString()}</p>
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
                        <p className="text-2xl font-bold">{totalMetrics.clicks.toLocaleString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <TrendingUp className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Conversions</p>
                        <p className="text-2xl font-bold">{totalMetrics.conversions}</p>
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
                        <p className="text-sm text-gray-600">Total Spent</p>
                        <p className="text-2xl font-bold">${totalMetrics.spent.toFixed(2)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Active Campaigns */}
              <Card>
                <CardHeader>
                  <CardTitle>Active Campaigns</CardTitle>
                  <CardDescription>Your currently running advertising campaigns</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {campaigns.filter(c => c.status === 'active').map((campaign) => (
                      <div key={campaign.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className="p-2 bg-green-100 rounded-lg">
                            <Megaphone className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <h4 className="font-medium">{campaign.name}</h4>
                            <p className="text-sm text-gray-600">{campaign.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <p className="font-medium">${campaign.metrics.spent} / ${campaign.budget}</p>
                            <p className="text-sm text-gray-600">
                              {campaign.metrics.impressions.toLocaleString()} impressions
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleCampaignStatus(campaign.id)}
                          >
                            <Pause className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'campaigns' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">All Campaigns</h2>
                <Button onClick={() => setShowCreateCampaign(true)} className="flex items-center space-x-2">
                  <Plus className="w-4 h-4" />
                  <span>New Campaign</span>
                </Button>
              </div>

              <div className="space-y-4">
                {campaigns.map((campaign) => (
                  <div key={campaign.id} className="space-y-4">
                    <Card className="hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="text-lg font-semibold">{campaign.name}</h3>
                            <p className="text-gray-600">{campaign.description}</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>
                              {campaign.status}
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleCampaignStatus(campaign.id)}
                            >
                              {campaign.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            </Button>
                            <Button variant="outline" size="sm">
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div>
                            <p className="text-sm text-gray-600">Budget</p>
                            <p className="font-semibold">${campaign.budget}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Spent</p>
                            <p className="font-semibold">${campaign.spent || 0}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Impressions</p>
                            <p className="font-semibold">{(campaign.impressions || 0).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">CTR</p>
                            <p className="font-semibold">
                              {campaign.impressions > 0 
                                ? ((campaign.clicks / campaign.impressions) * 100).toFixed(2)
                                : 0}%
                            </p>
                          </div>
                        </div>

                        <div className="mb-4">
                          <div className="flex justify-between text-sm mb-1">
                            <span>Budget Used</span>
                            <span>{(((campaign.spent || 0) / campaign.budget) * 100).toFixed(1)}%</span>
                          </div>
                          <Progress value={((campaign.spent || 0) / campaign.budget) * 100} />
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {((campaign.audience_spec as any)?.interests || []).map((interest: string) => (
                            <Badge key={interest} variant="outline">{interest}</Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Blockchain Escrow Integration */}
                    <BlockchainEscrowIntegration 
                      campaign={campaign}
                      onEscrowUpdate={(status) => {
                        console.log(`Campaign ${campaign.id} escrow status: ${status}`);
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Analytics & Performance</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Performance Overview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span>Click-through Rate</span>
                        <span className="font-semibold">
                          {totalMetrics.impressions > 0 
                            ? ((totalMetrics.clicks / totalMetrics.impressions) * 100).toFixed(2)
                            : 0}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Conversion Rate</span>
                        <span className="font-semibold">
                          {totalMetrics.clicks > 0 
                            ? ((totalMetrics.conversions / totalMetrics.clicks) * 100).toFixed(2)
                            : 0}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Cost per Click</span>
                        <span className="font-semibold">
                          ${totalMetrics.clicks > 0 
                            ? (totalMetrics.spent / totalMetrics.clicks).toFixed(2)
                            : 0}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Cost per Conversion</span>
                        <span className="font-semibold">
                          ${totalMetrics.conversions > 0 
                            ? (totalMetrics.spent / totalMetrics.conversions).toFixed(2)
                            : 0}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Top Performing Interests</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {['sailing', 'travel', 'sustainable-fashion', 'environment'].map((interest, index) => (
                        <div key={interest} className="flex justify-between items-center">
                          <span className="capitalize">{interest}</span>
                          <div className="flex items-center space-x-2">
                            <Progress value={85 - (index * 15)} className="w-20" />
                            <span className="text-sm font-medium">{85 - (index * 15)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'creatives' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Creative Assets</h2>
              
              <Card>
                <CardHeader>
                  <CardTitle>Upload Creative Assets</CardTitle>
                  <CardDescription>Manage your ad creatives and assets</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">Upload Creative Assets</h3>
                    <p className="text-gray-600 mb-4">
                      Support for HTML5, images, videos, and interactive content
                    </p>
                    <Button>Choose Files</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Billing & Payments</h2>
              
              <Card>
                <CardHeader>
                  <CardTitle>Account Balance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-green-50 rounded-lg">
                      <h3 className="font-medium text-green-800">Available Balance</h3>
                      <p className="text-2xl font-bold text-green-900">$1,250.00</p>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h3 className="font-medium text-blue-800">This Month Spent</h3>
                      <p className="text-2xl font-bold text-blue-900">${totalMetrics.spent.toFixed(2)}</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <h3 className="font-medium text-purple-800">Pending Charges</h3>
                      <p className="text-2xl font-bold text-purple-900">$45.20</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">Account Settings</h2>
              
              <Card>
                <CardHeader>
                  <CardTitle>Company Information</CardTitle>
                  <CardDescription>Manage your advertiser account preferences</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input id="companyName" defaultValue="Acme Advertising Co." />
                  </div>
                  <div>
                    <Label htmlFor="contactEmail">Contact Email</Label>
                    <Input id="contactEmail" type="email" defaultValue="advertiser@example.com" />
                  </div>
                  <div>
                    <Label htmlFor="walletAddress">Wallet Address</Label>
                    <Input id="walletAddress" defaultValue="0x742d35Cc6634C0532925a3b8D4C9db96590c6C87" />
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
                  <CardDescription>Resources and support for advertisers</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button variant="outline" className="h-auto p-4 justify-start">
                      <div className="text-left">
                        <h4 className="font-medium">Advertiser Guide</h4>
                        <p className="text-sm text-gray-600">Learn how to create effective campaigns</p>
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
                        <h4 className="font-medium">Best Practices</h4>
                        <p className="text-sm text-gray-600">Tips for better campaign performance</p>
                      </div>
                    </Button>
                    <Button variant="outline" className="h-auto p-4 justify-start">
                      <div className="text-left">
                        <h4 className="font-medium">API Documentation</h4>
                        <p className="text-sm text-gray-600">Technical integration guides</p>
                      </div>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>

      {/* Create Campaign Modal - Enhanced */}
      {showCreateCampaign && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Create New Campaign</CardTitle>
                  <CardDescription>Step {campaignStep} of 4: {
                    campaignStep === 1 ? 'Basic Information' :
                    campaignStep === 2 ? 'Audience Targeting' :
                    campaignStep === 3 ? 'Creative Assets' :
                    'Review & Launch'
                  }</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => {
                  setShowCreateCampaign(false);
                  resetCampaignForm();
                }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              {/* Progress Steps */}
              <div className="flex items-center space-x-2 mt-4">
                {[1, 2, 3, 4].map((step) => (
                  <div key={step} className="flex items-center flex-1">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                      step <= campaignStep ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {step}
                    </div>
                    {step < 4 && (
                      <div className={`flex-1 h-1 mx-2 ${
                        step < campaignStep ? 'bg-blue-600' : 'bg-gray-200'
                      }`} />
                    )}
                  </div>
                ))}
              </div>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Step 1: Basic Information */}
              {campaignStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="campaignName">Campaign Name *</Label>
                    <Input
                      id="campaignName"
                      value={newCampaign.name}
                      onChange={(e) => setNewCampaign(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Summer Sale 2025"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="campaignDescription">Description *</Label>
                    <Textarea
                      id="campaignDescription"
                      value={newCampaign.description}
                      onChange={(e) => setNewCampaign(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe your campaign goals and target audience"
                      rows={4}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="budget">Total Budget ($) *</Label>
                      <Input
                        id="budget"
                        type="number"
                        value={newCampaign.budget}
                        onChange={(e) => setNewCampaign(prev => ({ ...prev, budget: parseFloat(e.target.value) || 0 }))}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="dailyBudget">Daily Budget Limit ($)</Label>
                      <Input
                        id="dailyBudget"
                        type="number"
                        value={newCampaign.deliveryConstraints?.dailyBudgetLimit || ''}
                        onChange={(e) => setNewCampaign(prev => ({
                          ...prev,
                          deliveryConstraints: {
                            ...prev.deliveryConstraints!,
                            dailyBudgetLimit: parseFloat(e.target.value) || undefined
                          }
                        }))}
                        placeholder="Optional"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="startDate">Start Date</Label>
                      <Input
                        id="startDate"
                        type="datetime-local"
                        value={newCampaign.deliveryConstraints?.startDate?.slice(0, 16) || ''}
                        onChange={(e) => setNewCampaign(prev => ({
                          ...prev,
                          deliveryConstraints: {
                            ...prev.deliveryConstraints!,
                            startDate: e.target.value ? new Date(e.target.value).toISOString() : ''
                          }
                        }))}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="endDate">End Date</Label>
                      <Input
                        id="endDate"
                        type="datetime-local"
                        value={newCampaign.deliveryConstraints?.endDate?.slice(0, 16) || ''}
                        onChange={(e) => setNewCampaign(prev => ({
                          ...prev,
                          deliveryConstraints: {
                            ...prev.deliveryConstraints!,
                            endDate: e.target.value ? new Date(e.target.value).toISOString() : ''
                          }
                        }))}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Audience Targeting */}
              {campaignStep === 2 && (
                <div className="space-y-6">
                  <div>
                    <Label>Target Interests *</Label>
                    <p className="text-sm text-gray-600 mb-3">Select interests that match your target audience</p>
                    <div className="flex flex-wrap gap-2">
                      {availableInterests.map((interest) => (
                        <Badge
                          key={interest}
                          variant={selectedInterests.includes(interest) ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => toggleInterest(interest)}
                        >
                          {interest}
                        </Badge>
                      ))}
                    </div>
                    {selectedInterests.length > 0 && (
                      <p className="text-sm text-green-600 mt-2">
                        {selectedInterests.length} interest{selectedInterests.length > 1 ? 's' : ''} selected
                      </p>
                    )}
                  </div>
                  
                  <div>
                    <Label>Geographic Targeting</Label>
                    <p className="text-sm text-gray-600 mb-3">Select target locations (optional)</p>
                    <div className="flex flex-wrap gap-2">
                      {availableLocations.map((location) => (
                        <Badge
                          key={location}
                          variant={selectedLocations.includes(location) ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => toggleLocation(location)}
                        >
                          <Globe className="w-3 h-3 mr-1" />
                          {location}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <Label>Age Range</Label>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div>
                        <Label htmlFor="minAge" className="text-sm">Minimum Age</Label>
                        <Input
                          id="minAge"
                          type="number"
                          value={newCampaign.audienceSpec?.demographics?.ageRange?.[0] || 18}
                          onChange={(e) => setNewCampaign(prev => ({
                            ...prev,
                            audienceSpec: {
                              ...prev.audienceSpec!,
                              demographics: {
                                ...prev.audienceSpec?.demographics,
                                ageRange: [
                                  parseInt(e.target.value) || 18,
                                  prev.audienceSpec?.demographics?.ageRange?.[1] || 65
                                ]
                              }
                            }
                          }))}
                          min="13"
                          max="100"
                        />
                      </div>
                      <div>
                        <Label htmlFor="maxAge" className="text-sm">Maximum Age</Label>
                        <Input
                          id="maxAge"
                          type="number"
                          value={newCampaign.audienceSpec?.demographics?.ageRange?.[1] || 65}
                          onChange={(e) => setNewCampaign(prev => ({
                            ...prev,
                            audienceSpec: {
                              ...prev.audienceSpec!,
                              demographics: {
                                ...prev.audienceSpec?.demographics,
                                ageRange: [
                                  prev.audienceSpec?.demographics?.ageRange?.[0] || 18,
                                  parseInt(e.target.value) || 65
                                ]
                              }
                            }
                          }))}
                          min="13"
                          max="100"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <Label>Frequency Capping</Label>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div>
                        <Label htmlFor="maxImpressions" className="text-sm">Max Impressions per User</Label>
                        <Input
                          id="maxImpressions"
                          type="number"
                          value={newCampaign.deliveryConstraints?.maxImpressionsPerUser || 3}
                          onChange={(e) => setNewCampaign(prev => ({
                            ...prev,
                            deliveryConstraints: {
                              ...prev.deliveryConstraints!,
                              maxImpressionsPerUser: parseInt(e.target.value) || 3
                            }
                          }))}
                          min="1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="maxClicks" className="text-sm">Max Clicks per User</Label>
                        <Input
                          id="maxClicks"
                          type="number"
                          value={newCampaign.deliveryConstraints?.maxClicksPerUser || 1}
                          onChange={(e) => setNewCampaign(prev => ({
                            ...prev,
                            deliveryConstraints: {
                              ...prev.deliveryConstraints!,
                              maxClicksPerUser: parseInt(e.target.value) || 1
                            }
                          }))}
                          min="1"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Creative Assets */}
              {campaignStep === 3 && (
                <div className="space-y-6">
                  <div>
                    <Label>Creative Type</Label>
                    <Select
                      value={newCampaign.creativeManifest?.type || 'html5'}
                      onValueChange={(value: any) => setNewCampaign(prev => ({
                        ...prev,
                        creativeManifest: {
                          ...prev.creativeManifest!,
                          type: value
                        }
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="html5">
                          <div className="flex items-center">
                            <FileText className="w-4 h-4 mr-2" />
                            HTML5 Interactive
                          </div>
                        </SelectItem>
                        <SelectItem value="image">
                          <div className="flex items-center">
                            <Image className="w-4 h-4 mr-2" />
                            Static Image
                          </div>
                        </SelectItem>
                        <SelectItem value="video">
                          <div className="flex items-center">
                            <Video className="w-4 h-4 mr-2" />
                            Video Ad
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="creativeUrl">Creative URL (Optional)</Label>
                    <Input
                      id="creativeUrl"
                      value={newCampaign.creativeManifest?.url || ''}
                      onChange={(e) => setNewCampaign(prev => ({
                        ...prev,
                        creativeManifest: {
                          ...prev.creativeManifest!,
                          url: e.target.value
                        }
                      }))}
                      placeholder="https://example.com/creative.html"
                    />
                  </div>
                  
                  <div>
                    <Label>Upload Creative Assets *</Label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center mt-2">
                      <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-sm text-gray-600 mb-3">
                        Upload images, videos, or HTML5 creatives
                      </p>
                      <Input
                        type="file"
                        multiple
                        onChange={handleFileUpload}
                        className="hidden"
                        id="fileUpload"
                        accept="image/*,video/*,.html,.zip"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('fileUpload')?.click()}
                      >
                        Choose Files
                      </Button>
                    </div>
                    
                    {uploadedFiles.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <Label>Uploaded Files ({uploadedFiles.length})</Label>
                        {uploadedFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center space-x-3">
                              {file.type.startsWith('image/') && <Image className="w-5 h-5 text-blue-600" />}
                              {file.type.startsWith('video/') && <Video className="w-5 h-5 text-purple-600" />}
                              {!file.type.startsWith('image/') && !file.type.startsWith('video/') && (
                                <FileText className="w-5 h-5 text-gray-600" />
                              )}
                              <div>
                                <p className="font-medium text-sm">{file.name}</p>
                                <p className="text-xs text-gray-600">
                                  {(file.size / 1024).toFixed(2)} KB
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFile(index)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="ctaText">Call-to-Action Text</Label>
                    <Input
                      id="ctaText"
                      value={newCampaign.creativeManifest?.metadata?.cta || ''}
                      onChange={(e) => setNewCampaign(prev => ({
                        ...prev,
                        creativeManifest: {
                          ...prev.creativeManifest!,
                          metadata: {
                            ...prev.creativeManifest?.metadata,
                            cta: e.target.value
                          }
                        }
                      }))}
                      placeholder="e.g., Shop Now, Learn More, Sign Up"
                    />
                  </div>
                </div>
              )}

              {/* Step 4: Review & Launch */}
              {campaignStep === 4 && (
                <div className="space-y-6">
                  <Alert>
                    <AlertDescription>
                      Review your campaign details before launching. You can edit these settings later.
                    </AlertDescription>
                  </Alert>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Campaign Details</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <p className="text-sm text-gray-600">Name</p>
                          <p className="font-medium">{newCampaign.name}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Description</p>
                          <p className="text-sm">{newCampaign.description}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Budget</p>
                          <p className="font-medium">${newCampaign.budget}</p>
                        </div>
                        {newCampaign.deliveryConstraints?.dailyBudgetLimit && (
                          <div>
                            <p className="text-sm text-gray-600">Daily Budget Limit</p>
                            <p className="font-medium">${newCampaign.deliveryConstraints.dailyBudgetLimit}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Audience Targeting</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <p className="text-sm text-gray-600">Interests ({selectedInterests.length})</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {selectedInterests.map(interest => (
                              <Badge key={interest} variant="secondary" className="text-xs">
                                {interest}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        {selectedLocations.length > 0 && (
                          <div>
                            <p className="text-sm text-gray-600">Locations ({selectedLocations.length})</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {selectedLocations.map(location => (
                                <Badge key={location} variant="outline" className="text-xs">
                                  {location}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        <div>
                          <p className="text-sm text-gray-600">Age Range</p>
                          <p className="font-medium">
                            {newCampaign.audienceSpec?.demographics?.ageRange?.[0]} - {newCampaign.audienceSpec?.demographics?.ageRange?.[1]} years
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Creative Assets</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <p className="text-sm text-gray-600">Type</p>
                          <p className="font-medium capitalize">{newCampaign.creativeManifest?.type}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Uploaded Files</p>
                          <p className="font-medium">{uploadedFiles.length} file(s)</p>
                        </div>
                        {newCampaign.creativeManifest?.metadata?.cta && (
                          <div>
                            <p className="text-sm text-gray-600">Call-to-Action</p>
                            <p className="font-medium">{newCampaign.creativeManifest.metadata.cta}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Delivery Settings</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <p className="text-sm text-gray-600">Max Impressions per User</p>
                          <p className="font-medium">{newCampaign.deliveryConstraints?.maxImpressionsPerUser}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Max Clicks per User</p>
                          <p className="font-medium">{newCampaign.deliveryConstraints?.maxClicksPerUser}</p>
                        </div>
                        {newCampaign.deliveryConstraints?.startDate && (
                          <div>
                            <p className="text-sm text-gray-600">Start Date</p>
                            <p className="text-sm">{new Date(newCampaign.deliveryConstraints.startDate).toLocaleString()}</p>
                          </div>
                        )}
                        {newCampaign.deliveryConstraints?.endDate && (
                          <div>
                            <p className="text-sm text-gray-600">End Date</p>
                            <p className="text-sm">{new Date(newCampaign.deliveryConstraints.endDate).toLocaleString()}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between pt-6 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (campaignStep > 1) {
                      setCampaignStep(prev => prev - 1);
                    } else {
                      setShowCreateCampaign(false);
                      resetCampaignForm();
                    }
                  }}
                >
                  {campaignStep === 1 ? 'Cancel' : 'Back'}
                </Button>
                
                <Button
                  onClick={() => {
                    if (campaignStep < 4) {
                      if (validateStep(campaignStep)) {
                        setCampaignStep(prev => prev + 1);
                      } else {
                        alert('Please complete all required fields before continuing.');
                      }
                    } else {
                      createCampaign();
                    }
                  }}
                  disabled={!validateStep(campaignStep)}
                >
                  {campaignStep === 4 ? 'Create Campaign' : 'Next'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}