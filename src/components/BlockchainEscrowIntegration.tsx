// Blockchain Escrow Integration Component
// Connects frontend to smart contracts for campaign fund management and automated payouts

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Lock, 
  Unlock, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  DollarSign,
  TrendingUp,
  Users,
  Loader2
} from 'lucide-react';
import { useBlockchainIntegration } from '@/lib/blockchain-integration';
import { Campaign } from '@/types/platform';

interface BlockchainEscrowIntegrationProps {
  campaign: Campaign;
  onEscrowUpdate?: (status: string) => void;
}

export default function BlockchainEscrowIntegration({ 
  campaign, 
  onEscrowUpdate 
}: BlockchainEscrowIntegrationProps) {
  const {
    service,
    isConnected,
    networkInfo,
    lockCampaignFunds,
    getCampaignEscrow,
    releaseCampaignFunds,
    getTokenBalance
  } = useBlockchainIntegration();

  const [escrowDetails, setEscrowDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState<{
    type: 'lock' | 'release' | null;
    status: 'pending' | 'confirmed' | 'failed' | null;
    hash?: string;
    message?: string;
  }>({ type: null, status: null });
  const [advertiserBalance, setAdvertiserBalance] = useState<string>('0');

  useEffect(() => {
    loadEscrowDetails();
    loadAdvertiserBalance();
  }, [campaign.id]);

  const loadEscrowDetails = async () => {
    try {
      const details = await getCampaignEscrow(campaign.id);
      setEscrowDetails(details);
    } catch (error) {
      console.error('Failed to load escrow details:', error);
    }
  };

  const loadAdvertiserBalance = async () => {
    try {
      const balance = await getTokenBalance(campaign.advertiser);
      setAdvertiserBalance(balance);
    } catch (error) {
      console.error('Failed to load advertiser balance:', error);
    }
  };

  const handleLockFunds = async () => {
    setLoading(true);
    setTxStatus({ type: 'lock', status: 'pending' });

    try {
      const tx = await lockCampaignFunds(campaign);
      setTxStatus({
        type: 'lock',
        status: 'confirmed',
        hash: tx.hash,
        message: 'Campaign funds successfully locked in escrow'
      });
      
      // Reload escrow details
      await loadEscrowDetails();
      await loadAdvertiserBalance();
      
      if (onEscrowUpdate) {
        onEscrowUpdate('locked');
      }
    } catch (error: any) {
      setTxStatus({
        type: 'lock',
        status: 'failed',
        message: error.message || 'Failed to lock funds'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReleaseFunds = async () => {
    setLoading(true);
    setTxStatus({ type: 'release', status: 'pending' });

    try {
      // Calculate payouts based on campaign metrics
      const totalEvents = campaign.metrics.impressions + campaign.metrics.clicks + campaign.metrics.conversions;
      const eventValue = campaign.metrics.spent / totalEvents;
      
      const userAmount = eventValue * campaign.payoutRules.user * totalEvents;
      const publisherAmount = eventValue * campaign.payoutRules.publisher * totalEvents;
      const protocolAmount = eventValue * campaign.payoutRules.protocol * totalEvents;

      const payouts = {
        userDid: 'did:user:example',
        publisherDid: 'did:publisher:example',
        amounts: {
          user: userAmount,
          publisher: publisherAmount,
          protocol: protocolAmount
        }
      };

      const tx = await releaseCampaignFunds(campaign.id, payouts);
      setTxStatus({
        type: 'release',
        status: 'confirmed',
        hash: tx.hash,
        message: 'Funds successfully released to recipients'
      });
      
      // Reload escrow details
      await loadEscrowDetails();
      
      if (onEscrowUpdate) {
        onEscrowUpdate('released');
      }
    } catch (error: any) {
      setTxStatus({
        type: 'release',
        status: 'failed',
        message: error.message || 'Failed to release funds'
      });
    } finally {
      setLoading(false);
    }
  };

  const getEscrowStatusBadge = () => {
    if (!escrowDetails) return null;

    const statusConfig = {
      locked: { variant: 'default' as const, icon: Lock, text: 'Locked in Escrow' },
      partially_released: { variant: 'secondary' as const, icon: TrendingUp, text: 'Partially Released' },
      fully_released: { variant: 'outline' as const, icon: CheckCircle, text: 'Fully Released' }
    };

    const config = statusConfig[escrowDetails.status as keyof typeof statusConfig];
    if (!config) return null;

    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center space-x-1">
        <Icon className="w-3 h-3" />
        <span>{config.text}</span>
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Blockchain Connection Status */}
      <Alert className={isConnected ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}>
        <AlertDescription className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {isConnected ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-green-800">
                  Connected to {networkInfo?.name || 'blockchain'} (Chain ID: {networkInfo?.chainId})
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 text-yellow-600" />
                <span className="text-yellow-800">
                  Running in mock mode - blockchain not connected
                </span>
              </>
            )}
          </div>
          {getEscrowStatusBadge()}
        </AlertDescription>
      </Alert>

      {/* Transaction Status */}
      {txStatus.status && (
        <Alert className={
          txStatus.status === 'confirmed' ? 'border-green-200 bg-green-50' :
          txStatus.status === 'failed' ? 'border-red-200 bg-red-50' :
          'border-blue-200 bg-blue-50'
        }>
          <AlertDescription className="flex items-center space-x-2">
            {txStatus.status === 'pending' && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
            {txStatus.status === 'confirmed' && <CheckCircle className="w-4 h-4 text-green-600" />}
            {txStatus.status === 'failed' && <AlertCircle className="w-4 h-4 text-red-600" />}
            <div className="flex-1">
              <p className="font-medium">
                {txStatus.status === 'pending' && 'Transaction pending...'}
                {txStatus.status === 'confirmed' && 'Transaction confirmed!'}
                {txStatus.status === 'failed' && 'Transaction failed'}
              </p>
              {txStatus.message && <p className="text-sm">{txStatus.message}</p>}
              {txStatus.hash && (
                <p className="text-xs font-mono mt-1">
                  TX: {txStatus.hash.slice(0, 10)}...{txStatus.hash.slice(-8)}
                </p>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Escrow Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Lock className="w-5 h-5" />
              <span>Escrow Overview</span>
            </CardTitle>
            <CardDescription>Campaign funds locked in smart contract</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Budget</span>
                <span className="font-semibold">${campaign.budget.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Locked Amount</span>
                <span className="font-semibold text-green-600">
                  ${escrowDetails?.lockedAmount || '0.00'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Released Amount</span>
                <span className="font-semibold text-blue-600">
                  ${escrowDetails?.releasedAmount || '0.00'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Spent</span>
                <span className="font-semibold">${campaign.metrics.spent.toFixed(2)}</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Budget Utilization</span>
                <span>{((campaign.metrics.spent / campaign.budget) * 100).toFixed(1)}%</span>
              </div>
              <Progress value={(campaign.metrics.spent / campaign.budget) * 100} />
            </div>

            <div className="pt-4 space-y-2">
              <Button
                onClick={handleLockFunds}
                disabled={loading || escrowDetails?.status === 'locked'}
                className="w-full"
              >
                {loading && txStatus.type === 'lock' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Locking Funds...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Lock Funds in Escrow
                  </>
                )}
              </Button>
              
              <Button
                onClick={handleReleaseFunds}
                disabled={loading || !escrowDetails || escrowDetails.status !== 'locked'}
                variant="outline"
                className="w-full"
              >
                {loading && txStatus.type === 'release' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Releasing Funds...
                  </>
                ) : (
                  <>
                    <Unlock className="w-4 h-4 mr-2" />
                    Release Funds
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Payout Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="w-5 h-5" />
              <span>Payout Distribution</span>
            </CardTitle>
            <CardDescription>Automated payout breakdown</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div>
                  <p className="font-medium text-blue-900">Users</p>
                  <p className="text-sm text-blue-700">{(campaign.payoutRules.user * 100)}% of revenue</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-blue-900">
                    ${(campaign.metrics.spent * campaign.payoutRules.user).toFixed(2)}
                  </p>
                  <p className="text-xs text-blue-700">
                    {escrowDetails?.recipients?.filter((r: any) => r.role === 'user').length || 0} recipients
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div>
                  <p className="font-medium text-green-900">Publishers</p>
                  <p className="text-sm text-green-700">{(campaign.payoutRules.publisher * 100)}% of revenue</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-green-900">
                    ${(campaign.metrics.spent * campaign.payoutRules.publisher).toFixed(2)}
                  </p>
                  <p className="text-xs text-green-700">
                    {escrowDetails?.recipients?.filter((r: any) => r.role === 'publisher').length || 0} recipients
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <div>
                  <p className="font-medium text-purple-900">Protocol</p>
                  <p className="text-sm text-purple-700">{(campaign.payoutRules.protocol * 100)}% of revenue</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-purple-900">
                    ${(campaign.metrics.spent * campaign.payoutRules.protocol).toFixed(2)}
                  </p>
                  <p className="text-xs text-purple-700">Platform fee</p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Your Token Balance</span>
                <span className="font-semibold text-lg">{parseFloat(advertiserBalance).toFixed(2)} DEV</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      {escrowDetails?.recipients && escrowDetails.recipients.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Payouts</CardTitle>
            <CardDescription>Automated payout transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {escrowDetails.recipients.map((recipient: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${
                      recipient.role === 'user' ? 'bg-blue-100' :
                      recipient.role === 'publisher' ? 'bg-green-100' :
                      'bg-purple-100'
                    }`}>
                      <DollarSign className={`w-4 h-4 ${
                        recipient.role === 'user' ? 'text-blue-600' :
                        recipient.role === 'publisher' ? 'text-green-600' :
                        'text-purple-600'
                      }`} />
                    </div>
                    <div>
                      <p className="font-medium capitalize">{recipient.role}</p>
                      <p className="text-sm text-gray-600 font-mono">
                        {recipient.address.slice(0, 6)}...{recipient.address.slice(-4)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">${recipient.amount}</p>
                    <Badge variant="outline" className="text-xs">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Confirmed
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Smart Contract Info */}
      {isConnected && networkInfo && (
        <Card>
          <CardHeader>
            <CardTitle>Smart Contract Details</CardTitle>
            <CardDescription>Blockchain integration information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Network</p>
                <p className="font-mono">{networkInfo.name}</p>
              </div>
              <div>
                <p className="text-gray-600">Chain ID</p>
                <p className="font-mono">{networkInfo.chainId}</p>
              </div>
              <div>
                <p className="text-gray-600">Marketplace Contract</p>
                <p className="font-mono text-xs">
                  {networkInfo.contracts?.marketplace?.slice(0, 10)}...
                  {networkInfo.contracts?.marketplace?.slice(-8)}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Token Contract</p>
                <p className="font-mono text-xs">
                  {networkInfo.contracts?.token?.slice(0, 10)}...
                  {networkInfo.contracts?.token?.slice(-8)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
