import { useState, useEffect } from 'react';
import BlockchainIntegrationService from './blockchain-integration';
import { Campaign, EventReceipt } from '@/types/platform';

/**
 * React hook for blockchain integration
 */
export function useBlockchainIntegration() {
  const [service] = useState(() => new BlockchainIntegrationService());
  const [isConnected, setIsConnected] = useState(false);
  const [networkInfo, setNetworkInfo] = useState(null);

  useEffect(() => {
    const initializeBlockchain = async () => {
      await service.initialize();
      setIsConnected(service.isBlockchainConnected());
      setNetworkInfo(service.getNetworkInfo());
    };

    initializeBlockchain();
  }, [service]);

  return {
    service,
    isConnected,
    networkInfo,
    // Campaign escrow functions
    lockCampaignFunds: (campaign: Campaign) => service.lockCampaignFunds(campaign),
    getCampaignEscrow: (campaignId: string) => service.getCampaignEscrow(campaignId),
    releaseCampaignFunds: (campaignId: string, payouts: any) => service.releaseCampaignFunds(campaignId, payouts),
    // Consent functions
    recordConsent: (userDid: string, scope: string, campaignId?: string) =>
      service.recordUserConsent(userDid, scope, campaignId),
    verifyConsent: (userDid: string, scope: string, campaignId?: string) =>
      service.verifyUserConsent(userDid, scope, campaignId),
    revokeConsent: (userDid: string, scope: string, campaignId?: string) =>
      service.revokeUserConsent(userDid, scope, campaignId),
    // Token functions
    getTokenBalance: (userDid: string) => service.getUserTokenBalance(userDid),
    transferTokens: (fromDid: string, toDid: string, amount: string) =>
      service.transferTokens(fromDid, toDid, amount),
    mintDemoTokens: (userDid: string, amount: string) => service.mintDemoTokens(userDid, amount),
    // Automated payouts
    executePayouts: (campaign: Campaign, events: EventReceipt[]) =>
      service.executeAutomatedPayouts(campaign, events)
  };
}
