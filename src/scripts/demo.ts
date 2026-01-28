// End-to-End Demo Script for Metaverse Advertising Platform
// This script demonstrates the complete flow from user registration to ad serving and payouts

import { 
  AuthService, 
  UserService, 
  CampaignService, 
  MatchingService, 
  EventService, 
  PublisherService 
} from '../lib/backend-services';
import SmartContractService, { DEFAULT_CONTRACT_CONFIG, ContractUtils } from '../lib/smart-contracts';
import MetaverseAdSDK from '../lib/publisher-sdk';

class PlatformDemo {
  private authService: AuthService;
  private userService: UserService;
  private campaignService: CampaignService;
  private matchingService: MatchingService;
  private eventService: EventService;
  private publisherService: PublisherService;
  private contractService: SmartContractService;

  constructor() {
    this.authService = new AuthService();
    this.userService = new UserService();
    this.campaignService = new CampaignService();
    this.matchingService = new MatchingService();
    this.eventService = new EventService();
    this.publisherService = new PublisherService();
    this.contractService = new SmartContractService(DEFAULT_CONTRACT_CONFIG);
  }

  async runCompleteDemo() {
    console.log('🚀 Starting Metaverse Advertising Platform Demo');
    console.log('=' .repeat(60));

    try {
      // Step 1: Setup and Registration
      await this.step1_Setup();
      
      // Step 2: User Registration and Profile Setup
      const user = await this.step2_UserRegistration();
      
      // Step 3: Advertiser Registration and Campaign Creation
      const { advertiser, campaign } = await this.step3_AdvertiserSetup();
      
      // Step 4: Publisher Registration and SDK Setup
      const publisher = await this.step4_PublisherSetup();
      
      // Step 5: Smart Contract Integration
      await this.step5_SmartContractSetup(campaign.id);
      
      // Step 6: Ad Matching and Serving
      const adResponse = await this.step6_AdMatching(publisher, campaign);
      
      // Step 7: Event Tracking
      await this.step7_EventTracking(adResponse, user.did, publisher.did);
      
      // Step 8: Analytics and Reporting
      await this.step8_Analytics(campaign.id);
      
      // Step 9: Automated Payouts
      await this.step9_Payouts(campaign);
      
      console.log('✅ Demo completed successfully!');
      console.log('🎉 All platform features demonstrated');
      
    } catch (error) {
      console.error('❌ Demo failed:', error);
    }
  }

  private async step1_Setup() {
    console.log('\n📋 Step 1: Platform Setup');
    console.log('-'.repeat(30));
    
    // Check smart contract connectivity
    const networkInfo = await this.contractService.getNetworkInfo();
    console.log('🔗 Connected to blockchain:', networkInfo);
    
    // Setup event listeners
    this.contractService.setupEventListeners();
    console.log('👂 Event listeners configured');
  }

  private async step2_UserRegistration() {
    console.log('\n👤 Step 2: User Registration');
    console.log('-'.repeat(30));
    
    const { user, token } = await this.authService.register(
      'alice@example.com',
      'password123',
      'user'
    );
    
    console.log('✅ User registered:', {
      did: user.did,
      email: user.email,
      interests: user.interests
    });
    
    // Update user preferences
    const updatedUser = await this.userService.updatePreferences(user.did, {
      interests: ['sailing', 'travel', 'sustainable-fashion'],
      rewardPreferences: {
        type: 'token',
        ratePerImpression: 0.001,
        ratePerClick: 0.01,
        ratePerConversion: 0.1
      }
    });
    
    console.log('🎯 User preferences updated:', updatedUser.interests);
    
    // Create consent
    const consent = await this.userService.createConsent(user.did, 'marketplace');
    console.log('📝 Marketplace consent granted:', consent.id);
    
    return updatedUser;
  }

  private async step3_AdvertiserSetup() {
    console.log('\n📢 Step 3: Advertiser Setup');
    console.log('-'.repeat(30));
    
    const { user: advertiser, token } = await this.authService.register(
      'advertiser@sailingco.com',
      'password123',
      'advertiser'
    );
    
    console.log('✅ Advertiser registered:', advertiser.did);
    
    // Create campaign
    const campaign = await this.campaignService.createCampaign(advertiser.did, {
      name: 'Premium Sailing Adventures',
      description: 'Luxury sailing experiences for adventure seekers',
      audienceSpec: {
        interests: ['sailing', 'travel'],
        verifiableClaims: ['age>21'],
        demographics: {
          ageRange: [21, 65],
          locations: ['US', 'CA', 'AU'],
          languages: ['en']
        }
      },
      budget: 1000,
      deliveryConstraints: {
        maxImpressionsPerUser: 3,
        maxClicksPerUser: 1,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      }
    });
    
    console.log('🎯 Campaign created:', {
      id: campaign.id,
      name: campaign.name,
      budget: campaign.budget,
      status: campaign.status
    });
    
    // Activate campaign
    const activeCampaign = await this.campaignService.updateCampaign(campaign.id, {
      status: 'active'
    });
    
    console.log('🟢 Campaign activated');
    
    return { advertiser, campaign: activeCampaign };
  }

  private async step4_PublisherSetup() {
    console.log('\n🌐 Step 4: Publisher Setup');
    console.log('-'.repeat(30));
    
    const publisherId = 'did:local:publisher_demo';
    
    // Verify/create publisher
    const { verified, publisher } = await this.publisherService.verifyPublisher(publisherId);
    
    console.log('✅ Publisher verified:', {
      did: publisher!.did,
      name: publisher!.name,
      domain: publisher!.domain
    });
    
    // Initialize SDK
    const sdk = new MetaverseAdSDK({
      publisherId,
      apiUrl: 'http://localhost:3001',
      debug: true
    });
    
    console.log('🔧 Publisher SDK initialized');
    
    return publisher!;
  }

  private async step5_SmartContractSetup(campaignId: string) {
    console.log('\n⛓️  Step 5: Smart Contract Setup');
    console.log('-'.repeat(30));
    
    try {
      // Mint demo tokens for advertiser
      const advertiserAddress = ContractUtils.didToAddress('did:local:advertiser');
      await this.contractService.mintTokens(advertiserAddress, '1000');
      console.log('💰 Demo tokens minted for advertiser');
      
      // Deposit campaign funds
      const txHash = await this.contractService.depositCampaignFunds(campaignId, '1000');
      console.log('🏦 Campaign funds deposited:', txHash);
      
      // Check balance
      const balance = await this.contractService.getCampaignBalance(campaignId);
      console.log('💳 Campaign balance:', balance, 'tokens');
      
    } catch (error) {
      console.log('⚠️  Smart contract demo skipped (requires local blockchain)');
      console.log('   Run `npx hardhat node` to enable blockchain features');
    }
  }

  private async step6_AdMatching(publisher: any, campaign: any) {
    console.log('\n🎯 Step 6: Ad Matching');
    console.log('-'.repeat(30));
    
    const adRequest = {
      slotId: 'header-banner',
      publisherDid: publisher.did,
      context: {
        url: 'https://demo-news.com/sailing-article',
        title: 'Best Sailing Destinations 2025',
        content: 'Discover the world\'s most beautiful sailing locations...',
        categories: ['travel', 'sailing'],
        keywords: ['sailing', 'travel', 'adventure', 'ocean']
      },
      timestamp: new Date().toISOString(),
      sessionId: `session_${Date.now()}`
    };
    
    const adResponse = await this.matchingService.findMatchingAds(adRequest);
    
    if (adResponse) {
      console.log('✅ Ad matched:', {
        adId: adResponse.adId,
        campaignId: adResponse.campaignId,
        bid: adResponse.bid,
        currency: adResponse.currency
      });
      
      console.log('🎨 Creative preview:', adResponse.creative.content.substring(0, 100) + '...');
    } else {
      console.log('❌ No ads matched');
    }
    
    return adResponse;
  }

  private async step7_EventTracking(adResponse: any, userDid: string, publisherDid: string) {
    console.log('\n📊 Step 7: Event Tracking');
    console.log('-'.repeat(30));
    
    if (!adResponse) {
      console.log('⏭️  Skipping event tracking (no ad to track)');
      return;
    }
    
    // Track impression
    const impressionEvent = await this.eventService.recordEvent('impression', {
      adId: adResponse.adId,
      campaignId: adResponse.campaignId,
      userDid,
      publisherDid,
      slotId: 'header-banner',
      metadata: {
        viewportSize: '1920x1080',
        userAgent: 'Demo Browser',
        referrer: 'https://demo-news.com'
      }
    });
    
    console.log('👁️  Impression tracked:', impressionEvent.id);
    
    // Simulate user clicking the ad
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const clickEvent = await this.eventService.recordEvent('click', {
      adId: adResponse.adId,
      campaignId: adResponse.campaignId,
      userDid,
      publisherDid,
      slotId: 'header-banner',
      metadata: {
        clickPosition: { x: 364, y: 125 },
        timeOnPage: 15000
      }
    });
    
    console.log('🖱️  Click tracked:', clickEvent.id);
    
    // Simulate conversion after some time
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const conversionEvent = await this.eventService.recordEvent('conversion', {
      adId: adResponse.adId,
      campaignId: adResponse.campaignId,
      userDid,
      publisherDid,
      slotId: 'header-banner',
      metadata: {
        conversionType: 'signup',
        conversionValue: 50,
        timeToConversion: 300000
      }
    });
    
    console.log('🎯 Conversion tracked:', conversionEvent.id);
  }

  private async step8_Analytics(campaignId: string) {
    console.log('\n📈 Step 8: Analytics & Reporting');
    console.log('-'.repeat(30));
    
    const events = await this.eventService.getEventsByCampaign(campaignId);
    
    const analytics = {
      totalEvents: events.length,
      impressions: events.filter(e => e.type === 'impression').length,
      clicks: events.filter(e => e.type === 'click').length,
      conversions: events.filter(e => e.type === 'conversion').length
    };
    
    analytics['ctr'] = analytics.impressions > 0 
      ? ((analytics.clicks / analytics.impressions) * 100).toFixed(2) + '%'
      : '0%';
    
    analytics['conversionRate'] = analytics.clicks > 0 
      ? ((analytics.conversions / analytics.clicks) * 100).toFixed(2) + '%'
      : '0%';
    
    console.log('📊 Campaign Analytics:', analytics);
    
    // Get updated campaign metrics
    const campaign = await this.campaignService.getCampaign(campaignId);
    console.log('💰 Campaign Spend:', {
      spent: campaign.metrics.spent,
      budget: campaign.budget,
      remaining: campaign.budget - campaign.metrics.spent
    });
  }

  private async step9_Payouts(campaign: any) {
    console.log('\n💸 Step 9: Automated Payouts');
    console.log('-'.repeat(30));
    
    const totalSpent = campaign.metrics.spent;
    
    if (totalSpent === 0) {
      console.log('⏭️  No payouts needed (no spend recorded)');
      return;
    }
    
    // Calculate payout amounts
    const payouts = ContractUtils.calculatePayouts(totalSpent, campaign.payoutRules);
    
    console.log('💰 Payout Calculation:', {
      totalAmount: totalSpent,
      userShare: `${payouts.user} (${campaign.payoutRules.user * 100}%)`,
      publisherShare: `${payouts.publisher} (${campaign.payoutRules.publisher * 100}%)`,
      protocolShare: `${payouts.protocol} (${campaign.payoutRules.protocol * 100}%)`
    });
    
    try {
      // Prepare recipient addresses
      const userAddress = ContractUtils.didToAddress('did:local:user');
      const publisherAddress = ContractUtils.didToAddress('did:local:publisher');
      const protocolAddress = ContractUtils.didToAddress('did:local:protocol');
      
      const recipients = [userAddress, publisherAddress, protocolAddress];
      const amounts = [payouts.user, payouts.publisher, payouts.protocol];
      
      // Execute payout via smart contract
      const txHash = await this.contractService.releaseCampaignFunds(
        campaign.id,
        recipients,
        amounts
      );
      
      console.log('✅ Payouts executed:', txHash);
      console.log('🎉 All participants have been paid automatically!');
      
    } catch (error) {
      console.log('⚠️  Smart contract payout skipped (requires local blockchain)');
      console.log('   In production, payouts would be executed automatically');
    }
  }
}

// Demo execution
async function runDemo() {
  const demo = new PlatformDemo();
  await demo.runCompleteDemo();
}

// Export for use in other scripts
export default PlatformDemo;

// Run demo if this file is executed directly
if (require.main === module) {
  runDemo().catch(console.error);
}