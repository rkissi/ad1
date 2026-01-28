import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Coins, 
  Shield, 
  Lock, 
  Zap, 
  CheckCircle, 
  AlertCircle,
  TrendingUp,
  Wallet,
  ArrowRight,
  RefreshCw,
  Activity
} from 'lucide-react';
import { useBlockchainAuth } from '@/lib/auth-service';

interface BlockchainDemoProps {
  className?: string;
}

function BlockchainDemo({ className = "" }: BlockchainDemoProps) {
  const { 
    user, 
    isBlockchainConnected, 
    blockchainService,
    getTokenBalance 
  } = useBlockchainAuth();

  const [tokenBalance, setTokenBalance] = useState('0');
  const [isLoading, setIsLoading] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [campaignEscrow, setCampaignEscrow] = useState<any>(null);
  const [consentRecords, setConsentRecords] = useState<any[]>([]);

  useEffect(() => {
    if (user && isBlockchainConnected) {
      loadBlockchainData();
    }
  }, [user, isBlockchainConnected]);

  const loadBlockchainData = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Load token balance
      const balance = await getTokenBalance();
      setTokenBalance(balance);

      // Load mock campaign escrow data
      const escrowData = await blockchainService.getCampaignEscrow('demo_campaign');
      setCampaignEscrow(escrowData);

      // Load mock consent records
      const consentData = await blockchainService.verifyUserConsent(user.did, 'platform_registration');
      setConsentRecords([consentData]);

    } catch (error) {
      console.error('Failed to load blockchain data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMintTokens = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const transaction = await blockchainService.mintDemoTokens(user.did, '50');
      setTransactions(prev => [transaction, ...prev]);
      
      // Refresh balance
      setTimeout(async () => {
        const newBalance = await getTokenBalance();
        setTokenBalance(newBalance);
      }, 1000);
      
    } catch (error) {
      console.error('Failed to mint tokens:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecordConsent = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const transaction = await blockchainService.recordUserConsent(
        user.did, 
        'demo_campaign_consent', 
        'demo_campaign'
      );
      setTransactions(prev => [transaction, ...prev]);
      
    } catch (error) {
      console.error('Failed to record consent:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLockEscrow = async () => {
    setIsLoading(true);
    try {
      const mockCampaign = {
        id: 'demo_campaign',
        name: 'Demo Campaign',
        budget: 1000,
        advertiser: user?.did || 'demo_advertiser'
      };
      
      const transaction = await blockchainService.lockCampaignFunds(mockCampaign);
      setTransactions(prev => [transaction, ...prev]);
      
      // Refresh escrow data
      setTimeout(async () => {
        const escrowData = await blockchainService.getCampaignEscrow('demo_campaign');
        setCampaignEscrow(escrowData);
      }, 1000);
      
    } catch (error) {
      console.error('Failed to lock escrow:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`bg-white min-h-screen ${className}`}>
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Blockchain Integration Demo</h1>
              <p className="text-gray-600">
                Experience smart contract escrow, consent recording, and automated payouts
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant={isBlockchainConnected ? "default" : "secondary"} className="px-3 py-1">
                {isBlockchainConnected ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Blockchain Connected
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 mr-1" />
                    Mock Mode
                  </>
                )}
              </Badge>
              <Button 
                onClick={loadBlockchainData} 
                disabled={isLoading}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        <Tabs defaultValue="wallet" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="wallet">Token Wallet</TabsTrigger>
            <TabsTrigger value="escrow">Campaign Escrow</TabsTrigger>
            <TabsTrigger value="consent">Consent Records</TabsTrigger>
            <TabsTrigger value="payouts">Automated Payouts</TabsTrigger>
          </TabsList>

          {/* Token Wallet Tab */}
          <TabsContent value="wallet" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Wallet className="w-5 h-5 mr-2 text-blue-600" />
                    Your Token Balance
                  </CardTitle>
                  <CardDescription>
                    Earn tokens by viewing ads and participating in campaigns
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-6">
                    <div className="text-4xl font-bold text-blue-600 mb-2">
                      {parseFloat(tokenBalance).toFixed(2)}
                    </div>
                    <div className="text-gray-500 mb-4">DEV Tokens</div>
                    <Button 
                      onClick={handleMintTokens} 
                      disabled={isLoading}
                      className="w-full"
                    >
                      <Coins className="w-4 h-4 mr-2" />
                      Mint Demo Tokens (+50)
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Activity className="w-5 h-5 mr-2 text-green-600" />
                    Recent Transactions
                  </CardTitle>
                  <CardDescription>
                    Your latest blockchain transactions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {transactions.length === 0 ? (
                      <div className="text-center py-4 text-gray-500">
                        No transactions yet
                      </div>
                    ) : (
                      transactions.slice(0, 3).map((tx, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center">
                            <div className={`w-2 h-2 rounded-full mr-3 ${
                              tx.status === 'confirmed' ? 'bg-green-500' : 
                              tx.status === 'pending' ? 'bg-yellow-500' : 'bg-red-500'
                            }`}></div>
                            <div>
                              <div className="font-medium text-sm">Transaction</div>
                              <div className="text-xs text-gray-500">{tx.hash.substring(0, 16)}...</div>
                            </div>
                          </div>
                          <Badge variant={tx.status === 'confirmed' ? 'default' : 'secondary'}>
                            {tx.status}
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Campaign Escrow Tab */}
          <TabsContent value="escrow" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Lock className="w-5 h-5 mr-2 text-purple-600" />
                    Escrow Management
                  </CardTitle>
                  <CardDescription>
                    Lock campaign funds in smart contract escrow
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <h4 className="font-semibold text-purple-900 mb-2">Demo Campaign</h4>
                      <p className="text-purple-700 text-sm mb-3">
                        Luxury sailing adventures targeting travel enthusiasts
                      </p>
                      <div className="flex justify-between items-center">
                        <span className="text-purple-600">Budget: 1,000 DEV</span>
                        <Button 
                          onClick={handleLockEscrow} 
                          disabled={isLoading}
                          size="sm"
                        >
                          <Lock className="w-4 h-4 mr-2" />
                          Lock Funds
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
                    Escrow Status
                  </CardTitle>
                  <CardDescription>
                    Current escrow balance and distribution
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {campaignEscrow ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-3 bg-green-50 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">
                            {parseFloat(campaignEscrow.lockedAmount).toFixed(0)}
                          </div>
                          <div className="text-green-700 text-sm">Locked</div>
                        </div>
                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">
                            {parseFloat(campaignEscrow.releasedAmount).toFixed(0)}
                          </div>
                          <div className="text-blue-700 text-sm">Released</div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <h5 className="font-medium">Payout Recipients:</h5>
                        {campaignEscrow.recipients.map((recipient: any, index: number) => (
                          <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                            <span className="text-sm capitalize">{recipient.role}</span>
                            <span className="font-medium">{recipient.amount} DEV</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-500">
                      No escrow data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Consent Records Tab */}
          <TabsContent value="consent" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Shield className="w-5 h-5 mr-2 text-blue-600" />
                    Consent Management
                  </CardTitle>
                  <CardDescription>
                    Record and verify user consent on blockchain
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-semibold text-blue-900 mb-2">Campaign Consent</h4>
                      <p className="text-blue-700 text-sm mb-3">
                        Grant consent for demo campaign participation
                      </p>
                      <Button 
                        onClick={handleRecordConsent} 
                        disabled={isLoading}
                        className="w-full"
                      >
                        <Shield className="w-4 h-4 mr-2" />
                        Record Consent
                      </Button>
                    </div>
                    
                    <div className="text-xs text-gray-500 p-3 bg-gray-50 rounded">
                      <strong>Privacy Note:</strong> All consent is recorded on blockchain with 
                      pseudonymous identifiers. No personal data is stored on-chain.
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
                    Consent Records
                  </CardTitle>
                  <CardDescription>
                    Your verified consent history
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {consentRecords.map((record, index) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">{record.scope}</span>
                          <Badge variant={record.isValid ? "default" : "secondary"}>
                            {record.isValid ? 'Valid' : 'Invalid'}
                          </Badge>
                        </div>
                        <div className="text-xs text-gray-500">
                          Block: {record.blockNumber} | {new Date(record.timestamp).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Automated Payouts Tab */}
          <TabsContent value="payouts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Zap className="w-5 h-5 mr-2 text-yellow-600" />
                  Automated Payout System
                </CardTitle>
                <CardDescription>
                  Smart contract-based revenue sharing and rewards distribution
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Coins className="w-6 h-6 text-white" />
                    </div>
                    <h4 className="font-semibold text-blue-900 mb-2">Users</h4>
                    <div className="text-2xl font-bold text-blue-600 mb-1">60%</div>
                    <p className="text-blue-700 text-sm">of ad revenue</p>
                  </div>

                  <div className="text-center p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
                    <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <TrendingUp className="w-6 h-6 text-white" />
                    </div>
                    <h4 className="font-semibold text-green-900 mb-2">Publishers</h4>
                    <div className="text-2xl font-bold text-green-600 mb-1">35%</div>
                    <p className="text-green-700 text-sm">of ad revenue</p>
                  </div>

                  <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
                    <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Shield className="w-6 h-6 text-white" />
                    </div>
                    <h4 className="font-semibold text-purple-900 mb-2">Protocol</h4>
                    <div className="text-2xl font-bold text-purple-600 mb-1">5%</div>
                    <p className="text-purple-700 text-sm">platform fee</p>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
                  <div className="flex items-center mb-3">
                    <Zap className="w-5 h-5 text-yellow-600 mr-2" />
                    <h5 className="font-semibold text-yellow-900">How It Works</h5>
                  </div>
                  <div className="space-y-2 text-sm text-yellow-800">
                    <div className="flex items-center">
                      <ArrowRight className="w-4 h-4 mr-2" />
                      Campaign funds are locked in smart contract escrow
                    </div>
                    <div className="flex items-center">
                      <ArrowRight className="w-4 h-4 mr-2" />
                      Ad events trigger automated payout calculations
                    </div>
                    <div className="flex items-center">
                      <ArrowRight className="w-4 h-4 mr-2" />
                      Funds are distributed according to predefined rules
                    </div>
                    <div className="flex items-center">
                      <ArrowRight className="w-4 h-4 mr-2" />
                      All transactions are transparent and verifiable
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default BlockchainDemo;