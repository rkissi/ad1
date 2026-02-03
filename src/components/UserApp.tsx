import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Navbar } from '@/components/ui/navbar';
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Sidebar, 
  SidebarItem, 
  SidebarGroup, 
  SidebarSeparator,
  SidebarItemCollapsed 
} from '@/components/ui/sidebar';
import { 
  User, 
  Wallet, 
  Shield, 
  Settings, 
  TrendingUp, 
  Eye, 
  MousePointer, 
  Coins,
  CheckCircle,
  XCircle,
  Info,
  Home,
  Activity,
  Bell,
  HelpCircle,
  LogOut,
  BarChart3,
  Gift,
  CreditCard,
  History,
  Loader2
} from 'lucide-react';
import { useAuthSafe, rewardsAPI, consentAPI, eventAPI, analyticsAPI } from '@/lib/auth-context';
import { marketplaceService } from '@/lib/marketplace-service';
import type { UserReward, Consent, Event } from '@/types/supabase';

interface UserAppProps {
  initialProfile?: any;
}

export default function UserApp({ initialProfile }: UserAppProps) {
  const { user, profile, logout, updateProfile: updateAuthProfile, refreshProfile } = useAuthSafe();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Real data states
  const [earnings, setEarnings] = useState({
    total: 0,
    thisMonth: 0,
    pendingPayouts: 0,
    tokenBalance: 0
  });
  const [recentActivity, setRecentActivity] = useState<Event[]>([]);
  const [consents, setConsents] = useState<Consent[]>([]);
  const [rewards, setRewards] = useState<UserReward[]>([]);

  // Load user data on mount
  useEffect(() => {
    if (user?.id) {
      loadUserData();
    }
  }, [user?.id]);

  const loadUserData = async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      // Load all user data in parallel
      const [stats, userRewards, userConsents, userEvents] = await Promise.all([
        analyticsAPI.getDashboardStats(user.id, user.role),
        rewardsAPI.getUserRewards(user.id).catch(() => []),
        consentAPI.getUserConsents(user.id).catch(() => []),
        eventAPI.getUserEvents(user.id).catch(() => []),
      ]);

      setEarnings({
        total: (stats as any).totalEarned || 0,
        thisMonth: (stats as any).totalEarned || 0, // TODO: Filter by month
        pendingPayouts: (stats as any).pendingRewards || 0,
        tokenBalance: (stats as any).tokenBalance || 0
      });
      
      setRewards(userRewards || []);
      setConsents(userConsents || []);
      setRecentActivity(userEvents || []);
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateProfile = async (updates: any) => {
    setIsSaving(true);
    try {
      await updateAuthProfile(updates);
      await refreshProfile();
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleConsent = async (consentId: string, isActive: boolean) => {
    try {
      if (isActive) {
        // Use marketplace service for consent management
        await marketplaceService.revokeConsent(user!.id, undefined, consentId);
      }
      // Reload consents
      const updatedConsents = await consentAPI.getUserConsents(user!.id);
      setConsents(updatedConsents || []);
    } catch (error) {
      console.error('Error toggling consent:', error);
    }
  };

  const grantNewConsent = async (scope: string) => {
    if (!user?.id) return;
    try {
      await marketplaceService.grantConsent(user.id, scope);
      const updatedConsents = await consentAPI.getUserConsents(user.id);
      setConsents(updatedConsents || []);
    } catch (error) {
      console.error('Error granting consent:', error);
    }
  };

  const requestPayout = async (amount: number) => {
    if (!user?.id) return;
    try {
      const result = await marketplaceService.requestPayout(
        user.id,
        amount,
        (profile?.reward_preferences as any)?.type || 'token',
        profile?.wallet_address || undefined
      );
      if (result.success) {
        // Refresh user data
        await loadUserData();
        alert('Payout request submitted successfully!');
      }
    } catch (error: any) {
      console.error('Error requesting payout:', error);
      alert(error.message || 'Failed to request payout');
    }
  };

  const addInterest = (interest: string) => {
    if (interest && profile && !profile.interests?.includes(interest)) {
      handleUpdateProfile({ interests: [...(profile.interests || []), interest] });
    }
  };

  const removeInterest = (interest: string) => {
    if (profile) {
      handleUpdateProfile({ interests: (profile.interests || []).filter(i => i !== interest) });
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
          icon={<User className="w-5 h-5" />}
          label="Profile"
          active={activeTab === 'profile'}
          onClick={() => setActiveTab('profile')}
        />
        <SidebarItem
          icon={<Wallet className="w-5 h-5" />}
          label="Wallet"
          active={activeTab === 'wallet'}
          onClick={() => setActiveTab('wallet')}
          badge={earnings.pendingPayouts > 0 ? '$' + earnings.pendingPayouts.toFixed(2) : undefined}
        />
        <SidebarItem
          icon={<Activity className="w-5 h-5" />}
          label="Activity"
          active={activeTab === 'activity'}
          onClick={() => setActiveTab('activity')}
        />
      </SidebarGroup>

      <SidebarSeparator />

      <SidebarGroup label="Privacy & Settings">
        <SidebarItem
          icon={<Shield className="w-5 h-5" />}
          label="Privacy"
          active={activeTab === 'privacy'}
          onClick={() => setActiveTab('privacy')}
        />
        <SidebarItem
          icon={<Settings className="w-5 h-5" />}
          label="Preferences"
          active={activeTab === 'preferences'}
          onClick={() => setActiveTab('preferences')}
        />
        <SidebarItem
          icon={<Bell className="w-5 h-5" />}
          label="Notifications"
          active={activeTab === 'notifications'}
          onClick={() => setActiveTab('notifications')}
        />
      </SidebarGroup>

      <SidebarSeparator />

      <SidebarGroup label="Support">
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
        icon={<User className="w-5 h-5" />}
        label="Profile"
        active={activeTab === 'profile'}
        onClick={() => setActiveTab('profile')}
      />
      <SidebarItemCollapsed
        icon={<Wallet className="w-5 h-5" />}
        label="Wallet"
        active={activeTab === 'wallet'}
        onClick={() => setActiveTab('wallet')}
        badge={earnings.pendingPayouts > 0 ? '!' : undefined}
      />
      <SidebarItemCollapsed
        icon={<Activity className="w-5 h-5" />}
        label="Activity"
        active={activeTab === 'activity'}
        onClick={() => setActiveTab('activity')}
      />
      <div className="my-4 border-t border-gray-200" />
      <SidebarItemCollapsed
        icon={<Shield className="w-5 h-5" />}
        label="Privacy"
        active={activeTab === 'privacy'}
        onClick={() => setActiveTab('privacy')}
      />
      <SidebarItemCollapsed
        icon={<Settings className="w-5 h-5" />}
        label="Preferences"
        active={activeTab === 'preferences'}
        onClick={() => setActiveTab('preferences')}
      />
      <SidebarItemCollapsed
        icon={<Bell className="w-5 h-5" />}
        label="Notifications"
        active={activeTab === 'notifications'}
        onClick={() => setActiveTab('notifications')}
      />
      <div className="my-4 border-t border-gray-200" />
      <SidebarItemCollapsed
        icon={<HelpCircle className="w-5 h-5" />}
        label="Help & Support"
        active={activeTab === 'help'}
        onClick={() => setActiveTab('help')}
      />
    </div>
  );

  if (isLoading) {
      return (
          <div className="flex h-screen bg-gray-50">
               <Sidebar
                collapsed={sidebarCollapsed}
                onCollapsedChange={setSidebarCollapsed}
                className="hidden lg:flex"
               >
                {sidebarCollapsed ? renderCollapsedSidebar() : renderSidebarContent()}
               </Sidebar>
               <div className="flex-1 flex flex-col overflow-hidden">
                    <Navbar
                        title="User Dashboard"
                        user={{
                            name: 'User',
                            email: '',
                            role: 'user',
                            tokenBalance: '...'
                        }}
                        onLogout={logout}
                        notifications={0}
                    />
                   <main className="flex-1 overflow-y-auto p-6 space-y-6">
                       <div className="flex items-center justify-between">
                           <div className="space-y-2">
                               <Skeleton className="h-8 w-[250px]" />
                               <Skeleton className="h-4 w-[200px]" />
                           </div>
                           <Skeleton className="h-10 w-[150px]" />
                       </div>
                       <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                           <Skeleton className="h-32" />
                           <Skeleton className="h-32" />
                           <Skeleton className="h-32" />
                           <Skeleton className="h-32" />
                       </div>
                       <Skeleton className="h-[400px]" />
                   </main>
               </div>
          </div>
      )
  }

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
          title="User Dashboard"
          user={{
            name: user?.displayName || profile?.display_name || 'User',
            email: user?.email || profile?.email || '',
            role: user?.role || 'user',
            tokenBalance: user?.tokenBalance?.toString() || earnings.total.toFixed(2)
          }}
          onLogout={logout}
          notifications={3}
        />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Welcome Section */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Welcome back, {user?.displayName || profile?.display_name || 'User'}</h2>
                  <p className="text-gray-600">Here's your privacy-first advertising overview</p>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Verified
                  </Badge>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    DID: {(user?.did || profile?.did || '').slice(-8)}
                  </Badge>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-yellow-100 rounded-lg">
                        <Coins className="w-6 h-6 text-yellow-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Total Earnings</p>
                        <p className="text-2xl font-bold">${earnings.total}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <TrendingUp className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">This Month</p>
                        <p className="text-2xl font-bold">${earnings.thisMonth}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Eye className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Ad Views</p>
                        <p className="text-2xl font-bold">1,247</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Shield className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Privacy Score</p>
                        <p className="text-2xl font-bold">95%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Your latest ad interactions and earnings</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentActivity.slice(0, 5).map((activity) => (
                      <div key={activity.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          {activity.type === 'impression' ? (
                            <div className="p-2 bg-blue-100 rounded-lg">
                              <Eye className="w-4 h-4 text-blue-600" />
                            </div>
                          ) : (
                            <div className="p-2 bg-green-100 rounded-lg">
                              <MousePointer className="w-4 h-4 text-green-600" />
                            </div>
                          )}
                          <div>
                            <h4 className="font-medium">{activity.campaign}</h4>
                            <p className="text-sm text-gray-600 capitalize">
                              {activity.type} • {new Date(activity.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-green-600">+${activity.reward}</p>
                          <p className="text-sm text-gray-600">Earned</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'profile' && (
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Manage your personal information and interests</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input
                      id="displayName"
                      value={profile?.display_name || ''}
                      onChange={(e) => handleUpdateProfile({ display_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profile?.email || ''}
                      onChange={(e) => handleUpdateProfile({ email: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <Label>Interests</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(profile?.interests || []).map((interest) => (
                      <Badge key={interest} variant="secondary" className="cursor-pointer">
                        {interest}
                        <XCircle 
                          className="w-3 h-3 ml-1" 
                          onClick={() => removeInterest(interest)}
                        />
                      </Badge>
                    ))}
                  </div>
                  <div className="flex space-x-2 mt-2">
                    <Input
                      placeholder="Add new interest"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          addInterest(e.currentTarget.value);
                          e.currentTarget.value = '';
                        }
                      }}
                    />
                    <Button variant="outline">Add</Button>
                  </div>
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Your interests help us show you more relevant ads while keeping your data private.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}

          {activeTab === 'wallet' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Wallet Overview</CardTitle>
                  <CardDescription>Your earnings and payout information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-green-50 rounded-lg">
                      <h3 className="font-medium text-green-800">Available Balance</h3>
                      <p className="text-2xl font-bold text-green-900">${earnings.total}</p>
                    </div>
                    <div className="p-4 bg-yellow-50 rounded-lg">
                      <h3 className="font-medium text-yellow-800">Pending Payouts</h3>
                      <p className="text-2xl font-bold text-yellow-900">${earnings.pendingPayouts}</p>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h3 className="font-medium text-blue-800">This Month</h3>
                      <p className="text-2xl font-bold text-blue-900">${earnings.thisMonth}</p>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <Button className="flex-1">
                      <CreditCard className="w-4 h-4 mr-2" />
                      Withdraw Funds
                    </Button>
                    <Button variant="outline">
                      <History className="w-4 h-4 mr-2" />
                      View Transactions
                    </Button>
                  </div>

                  {profile?.wallet_address && (
                    <div>
                      <Label>Wallet Address</Label>
                      <div className="flex items-center space-x-2 mt-1">
                        <Input value={profile.wallet_address} readOnly />
                        <Button variant="outline" size="sm">Copy</Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'activity' && (
            <Card>
              <CardHeader>
                <CardTitle>Activity History</CardTitle>
                <CardDescription>Complete history of your ad interactions and earnings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        {activity.type === 'impression' ? (
                          <Eye className="w-5 h-5 text-blue-600" />
                        ) : (
                          <MousePointer className="w-5 h-5 text-green-600" />
                        )}
                        <div>
                          <h4 className="font-medium">{activity.campaign}</h4>
                          <p className="text-sm text-gray-600 capitalize">
                            {activity.type} • {new Date(activity.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-green-600">+${activity.reward}</p>
                        <p className="text-sm text-gray-600">Earned</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Consent Management</CardTitle>
                  <CardDescription>Control what data you share and how it's used</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {consents.map((consent) => (
                    <div key={consent.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h4 className="font-medium capitalize">{consent.scope} Access</h4>
                        <p className="text-sm text-gray-600">
                          Granted on {new Date(consent.grantedAt).toLocaleDateString()}
                          {consent.campaignId && ` • Campaign: ${consent.campaignId}`}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={consent.status === 'active' ? 'default' : 'secondary'}>
                          {consent.status}
                        </Badge>
                        <Switch
                          checked={consent.status === 'active'}
                          onCheckedChange={() => toggleConsent(consent.id)}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Privacy Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Marketplace Participation</Label>
                      <p className="text-sm text-gray-600">Allow ads to be shown to you</p>
                    </div>
                    <Switch
                      checked={(profile?.consents as any)?.marketplace_opt_in || false}
                      onCheckedChange={(checked) => handleUpdateProfile({
                        consents: { ...(profile?.consents as any || {}), marketplace_opt_in: checked }
                      })}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Analytics</Label>
                      <p className="text-sm text-gray-600">Help improve the platform</p>
                    </div>
                    <Switch
                      checked={(profile?.consents as any)?.analytics || false}
                      onCheckedChange={(checked) => handleUpdateProfile({
                        consents: { ...(profile?.consents as any || {}), analytics: checked }
                      })}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Data Processing</Label>
                      <p className="text-sm text-gray-600">Process data for ad matching</p>
                    </div>
                    <Switch
                      checked={(profile?.consents as any)?.data_processing || false}
                      onCheckedChange={(checked) => handleUpdateProfile({
                        consents: { ...(profile?.consents as any || {}), data_processing: checked }
                      })}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'preferences' && (
            <Card>
              <CardHeader>
                <CardTitle>Reward Preferences</CardTitle>
                <CardDescription>Configure how you want to be rewarded for ad interactions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label>Reward Type</Label>
                  <div className="flex space-x-4 mt-2">
                    <Button 
                      variant={(profile?.reward_preferences as any)?.type === 'token' ? 'default' : 'outline'}
                      onClick={() => handleUpdateProfile({ 
                        reward_preferences: { ...(profile?.reward_preferences as any || {}), type: 'token' }
                      })}
                    >
                      Crypto Tokens
                    </Button>
                    <Button 
                      variant={(profile?.reward_preferences as any)?.type === 'voucher' ? 'default' : 'outline'}
                      onClick={() => handleUpdateProfile({ 
                        reward_preferences: { ...(profile?.reward_preferences as any || {}), type: 'voucher' }
                      })}
                    >
                      Gift Vouchers
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="impressionRate">Per Impression ($)</Label>
                    <Input
                      id="impressionRate"
                      type="number"
                      step="0.001"
                      value={(profile?.reward_preferences as any)?.ratePerImpression || 0.001}
                      onChange={(e) => handleUpdateProfile({
                        reward_preferences: {
                          ...(profile?.reward_preferences as any || {}),
                          ratePerImpression: parseFloat(e.target.value)
                        }
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="clickRate">Per Click ($)</Label>
                    <Input
                      id="clickRate"
                      type="number"
                      step="0.01"
                      value={(profile?.reward_preferences as any)?.ratePerClick || 0.05}
                      onChange={(e) => handleUpdateProfile({
                        reward_preferences: {
                          ...(profile?.reward_preferences as any || {}),
                          ratePerClick: parseFloat(e.target.value)
                        }
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="conversionRate">Per Conversion ($)</Label>
                    <Input
                      id="conversionRate"
                      type="number"
                      step="0.1"
                      value={(profile?.reward_preferences as any)?.ratePerConversion || 2.0}
                      onChange={(e) => handleUpdateProfile({
                        reward_preferences: {
                          ...(profile?.reward_preferences as any || {}),
                          ratePerConversion: parseFloat(e.target.value)
                        }
                      })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'notifications' && (
            <Card>
              <CardHeader>
                <CardTitle>Notification Settings</CardTitle>
                <CardDescription>Manage how you receive updates and alerts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-gray-600">Receive updates via email</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Payout Alerts</Label>
                    <p className="text-sm text-gray-600">Get notified when you earn rewards</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Privacy Updates</Label>
                    <p className="text-sm text-gray-600">Important privacy and security updates</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'help' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Help & Support</CardTitle>
                  <CardDescription>Get help with your account and platform features</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button variant="outline" className="h-auto p-4 justify-start">
                      <div className="text-left">
                        <h4 className="font-medium">FAQ</h4>
                        <p className="text-sm text-gray-600">Common questions and answers</p>
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
                        <h4 className="font-medium">Privacy Guide</h4>
                        <p className="text-sm text-gray-600">Learn about data protection</p>
                      </div>
                    </Button>
                    <Button variant="outline" className="h-auto p-4 justify-start">
                      <div className="text-left">
                        <h4 className="font-medium">Platform Tutorial</h4>
                        <p className="text-sm text-gray-600">How to use the platform</p>
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
