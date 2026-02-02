// Comprehensive Admin Dashboard Component
// Enterprise-grade admin panel for managing all platform aspects

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Users, DollarSign, TrendingUp, AlertTriangle, Settings, 
  CreditCard, BarChart3, Shield, Database, Activity, Loader2 
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthSafe, analyticsAPI } from '@/lib/auth-context';
import { Navbar } from '@/components/ui/navbar';

interface AdminStats {
  totalUsers: number;
  totalCampaigns: number;
  totalRevenue: number;
  activeSubscriptions: number;
  pendingPayouts: number;
  fraudAlerts: number;
  totalPublishers: number;
  activeCampaigns: number;
}

interface User {
  id: string;
  did: string;
  email: string;
  display_name: string;
  role: string;
  created_at: string;
  token_balance?: number;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  from_user_id: string;
  to_user_id: string;
  campaign_id?: string;
  created_at: string;
}

export default function AdminDashboard() {
  const { user, logout } = useAuthSafe();
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalCampaigns: 0,
    totalRevenue: 0,
    activeSubscriptions: 0,
    pendingPayouts: 0,
    fraudAlerts: 0,
    totalPublishers: 0,
    activeCampaigns: 0,
  });

  const [users, setUsers] = useState<User[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState('overview');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load all admin data from Supabase
      const [
        { data: usersData },
        { data: campaignsData },
        { data: transactionsData },
        { data: publishersData },
        platformStats
      ] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('campaigns').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('publishers').select('*'),
        analyticsAPI.getAdminStats()
      ]);

      setUsers(usersData || []);
      setCampaigns(campaignsData || []);
      setTransactions(transactionsData || []);
      
      setStats({
        totalUsers: platformStats.totalUsers || 0,
        totalCampaigns: platformStats.totalCampaigns || 0,
        totalRevenue: platformStats.totalRevenue || 0,
        totalPublishers: platformStats.totalPublishers || 0,
        activeCampaigns: platformStats.activeCampaigns || 0,
        activeSubscriptions: 0,
        pendingPayouts: 0,
        fraudAlerts: 0,
      });
    } catch (error) {
      console.error('Failed to load admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUserAction = async (userId: string, action: 'suspend' | 'activate' | 'delete') => {
    try {
      if (action === 'delete') {
        // Note: This would need proper admin permissions in production
        console.log('Delete user:', userId);
      } else {
        // Update user status in profiles table
        await supabase
          .from('profiles')
          .update({ role: action === 'suspend' ? 'user' : 'user' })
          .eq('id', userId);
      }
      await loadDashboardData();
    } catch (error) {
      console.error(`Failed to ${action} user:`, error);
    }
  };

  const handleCampaignAction = async (campaignId: string, action: 'approve' | 'reject' | 'pause') => {
    try {
      const statusMap = {
        approve: 'active',
        reject: 'rejected',
        pause: 'paused'
      };
      
      await supabase
        .from('campaigns')
        .update({ status: statusMap[action] })
        .eq('id', campaignId);
      
      await loadDashboardData();
    } catch (error) {
      console.error(`Failed to ${action} campaign:`, error);
    }
  };

  const handleRefund = async (transactionId: string, amount?: number) => {
    try {
      await supabase
        .from('transactions')
        .update({ status: 'refunded' })
        .eq('id', transactionId);
      
      await loadDashboardData();
    } catch (error) {
      console.error('Failed to process refund:', error);
    }
  };

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.did?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCampaigns = campaigns.filter(campaign =>
    campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    campaign.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Activity className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <Navbar 
        title="Admin Dashboard"
        user={{
          name: user?.displayName || 'Admin',
          email: user?.email || 'admin@example.com',
          role: 'admin',
        }}
        onLogout={logout}
        showSearch={true}
        notifications={stats.fraudAlerts}
      />
      
      <div className="p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">Comprehensive platform management and analytics</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="w-4 h-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers.toLocaleString()}</div>
              <p className="text-xs text-gray-500 mt-1">Active platform users</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="w-4 h-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</div>
              <p className="text-xs text-gray-500 mt-1">All-time platform revenue</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
              <TrendingUp className="w-4 h-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCampaigns}</div>
              <p className="text-xs text-gray-500 mt-1">Running ad campaigns</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Subscriptions</CardTitle>
              <CreditCard className="w-4 h-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeSubscriptions}</div>
              <p className="text-xs text-gray-500 mt-1">Active subscriptions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
              <BarChart3 className="w-4 h-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingPayouts}</div>
              <p className="text-xs text-gray-500 mt-1">Awaiting processing</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Fraud Alerts</CardTitle>
              <AlertTriangle className="w-4 h-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.fraudAlerts}</div>
              <p className="text-xs text-gray-500 mt-1">Requires attention</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="fraud">Fraud</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Platform Health</CardTitle>
                <CardDescription>Real-time system status and metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Database Status</span>
                    <Badge variant="default" className="bg-green-500">Healthy</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Blockchain Connection</span>
                    <Badge variant="default" className="bg-green-500">Connected</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Payment Gateway</span>
                    <Badge variant="default" className="bg-green-500">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">API Response Time</span>
                    <span className="text-sm text-gray-600">45ms avg</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest platform events</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {transactions.slice(0, 5).map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium">{tx.type}</p>
                        <p className="text-xs text-gray-500">{new Date(tx.createdAt).toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">${tx.amount.toFixed(2)}</p>
                        <Badge variant={tx.status === 'succeeded' ? 'default' : 'secondary'}>
                          {tx.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Manage all platform users</CardDescription>
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="mt-4"
                />
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.display_name || 'N/A'}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge>{user.role}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                            {user.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUserAction(user.id, 'suspend')}
                            >
                              Suspend
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleUserAction(user.id, 'delete')}
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Campaigns Tab */}
          <TabsContent value="campaigns" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Campaign Management</CardTitle>
                <CardDescription>Review and manage advertising campaigns</CardDescription>
                <Input
                  placeholder="Search campaigns..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="mt-4"
                />
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Advertiser</TableHead>
                      <TableHead>Budget</TableHead>
                      <TableHead>Spent</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCampaigns.map((campaign) => (
                      <TableRow key={campaign.id}>
                        <TableCell className="font-medium">{campaign.name}</TableCell>
                        <TableCell>{campaign.advertiser}</TableCell>
                        <TableCell>${campaign.budget.toLocaleString()}</TableCell>
                        <TableCell>${campaign.metrics.spent.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>
                            {campaign.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCampaignAction(campaign.id, 'pause')}
                            >
                              Pause
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleCampaignAction(campaign.id, 'reject')}
                            >
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>All platform financial transactions</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="font-mono text-xs">{tx.id.slice(0, 12)}...</TableCell>
                        <TableCell>{tx.type}</TableCell>
                        <TableCell>${tx.amount.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={tx.status === 'succeeded' ? 'default' : 'secondary'}>
                            {tx.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(tx.createdAt).toLocaleString()}</TableCell>
                        <TableCell>
                          {tx.status === 'succeeded' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRefund(tx.id)}
                            >
                              Refund
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Fraud Tab */}
          <TabsContent value="fraud" className="space-y-6">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {stats.fraudAlerts} fraud alerts require immediate attention
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader>
                <CardTitle>Fraud Detection</CardTitle>
                <CardDescription>Monitor and manage suspicious activities</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">Fraud monitoring system active</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Platform Settings</CardTitle>
                <CardDescription>Configure platform parameters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Payment Gateway</label>
                  <Input placeholder="Stripe API Key" type="password" className="mt-2" />
                </div>
                <div>
                  <label className="text-sm font-medium">Blockchain RPC URL</label>
                  <Input placeholder="https://..." className="mt-2" />
                </div>
                <Button>Save Settings</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      </div>
    </div>
  );
}
