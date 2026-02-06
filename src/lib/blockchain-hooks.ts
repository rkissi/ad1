import { useAccount, useWriteContract, usePublicClient } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { MARKETPLACE_ABI, TOKEN_ABI } from './smart-contracts';
import { Campaign, EventReceipt } from '@/types/platform';

const MARKETPLACE_ADDRESS = (import.meta.env.VITE_MARKETPLACE_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`;
const TOKEN_ADDRESS = (import.meta.env.VITE_TOKEN_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`;

/**
 * React hook for blockchain integration using Wagmi
 */
export function useBlockchainIntegration() {
  const { address, isConnected, chain } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const lockCampaignFunds = async (campaign: Campaign) => {
    if (!isConnected || !address) throw new Error("Wallet not connected");
    if (!publicClient) throw new Error("Public client not ready");

    try {
        const amountWei = parseEther(campaign.budget.toString());

        // 1. Approve
        const approveTx = await writeContractAsync({
          address: TOKEN_ADDRESS,
          abi: TOKEN_ABI,
          functionName: 'approve',
          args: [MARKETPLACE_ADDRESS, amountWei],
        });

        await publicClient.waitForTransactionReceipt({ hash: approveTx });

        // 2. Deposit
        const depositTx = await writeContractAsync({
          address: MARKETPLACE_ADDRESS,
          abi: MARKETPLACE_ABI,
          functionName: 'depositCampaignFunds',
          args: [campaign.id, amountWei],
        });

        return { hash: depositTx, status: 'pending' };
    } catch (error) {
        console.error("Lock funds failed:", error);
        throw error;
    }
  };

  const getCampaignEscrow = async (campaignId: string) => {
    if (!publicClient) return { lockedAmount: '0' };
    try {
        const data = await publicClient.readContract({
            address: MARKETPLACE_ADDRESS,
            abi: MARKETPLACE_ABI,
            functionName: 'getCampaignBalance',
            args: [campaignId]
        });
        return { lockedAmount: formatEther(data as bigint) };
    } catch (error) {
        console.error("Get escrow failed:", error);
        return { lockedAmount: '0' };
    }
  };

  const recordConsent = async (userDid: string, scope: string, campaignId?: string) => {
    if (!isConnected) throw new Error("Wallet not connected");

    try {
        const tx = await writeContractAsync({
            address: MARKETPLACE_ADDRESS,
            abi: MARKETPLACE_ABI,
            functionName: 'recordConsent',
            args: [userDid, scope, campaignId || ''],
        });
        return { hash: tx, status: 'pending' };
    } catch (error) {
        console.error("Record consent failed:", error);
        throw error;
    }
  };

  const verifyConsent = async (userDid: string, scope: string, campaignId?: string) => {
    if (!publicClient) return false;
    try {
        const data = await publicClient.readContract({
            address: MARKETPLACE_ADDRESS,
            abi: MARKETPLACE_ABI,
            functionName: 'verifyConsent',
            args: [userDid, scope, campaignId || '']
        });
        return data as boolean;
    } catch (error) {
        return false;
    }
  };

  const getTokenBalance = async (userDid: string) => {
      // Assuming userDid maps to an address or is an address.
      // If userDid is 'did:metaverse:uuid', we can't easily map it to address without a lookup.
      // But usually frontend knows the connected wallet address.
      if (!publicClient || !address) return '0';

      try {
          const data = await publicClient.readContract({
              address: TOKEN_ADDRESS,
              abi: TOKEN_ABI,
              functionName: 'balanceOf',
              args: [address] // Use connected address
          });
          return formatEther(data as bigint);
      } catch (error) {
          return '0';
      }
  };

  const mintDemoTokens = async (userDid: string, amount: string) => {
      if (!isConnected) throw new Error("Wallet not connected");
      try {
          const tx = await writeContractAsync({
              address: TOKEN_ADDRESS,
              abi: TOKEN_ABI,
              functionName: 'mint',
              args: [address, parseEther(amount)]
          });
          return { hash: tx, status: 'pending' };
      } catch (error) {
          console.error("Mint failed:", error);
          throw error;
      }
  };

  return {
    isConnected,
    networkInfo: chain,
    lockCampaignFunds,
    getCampaignEscrow,
    releaseCampaignFunds: async () => { throw new Error("Use backend for payouts"); }, // Payouts are backend
    recordConsent,
    verifyConsent,
    revokeConsent: async () => {}, // TODO
    getTokenBalance,
    transferTokens: async () => {}, // TODO
    mintDemoTokens,
    executePayouts: async () => { throw new Error("Use backend for payouts"); }
  };
}
