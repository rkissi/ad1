// Express.js REST API Server for Metaverse Advertising Platform
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { 
  AuthService, 
  UserService, 
  CampaignService, 
  MatchingService, 
  EventService, 
  PublisherService 
} from './services';
import onboardingRoutes from './routes/onboarding';
import BlockchainIntegrationService from '../lib/blockchain-integration';
import DatabaseService from '../lib/database';
import { eventTracker } from '../lib/event-tracker';

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize services
const db = new DatabaseService();
const authService = new AuthService();
const userService = new UserService();
const campaignService = new CampaignService();
const matchingService = new MatchingService();
const eventService = new EventService();
const publisherService = new PublisherService();
const blockchainService = new BlockchainIntegrationService();

// Initialize database and blockchain
async function initializeServices() {
  try {
    // db.initialize() creates tables if using the custom DatabaseService.
    // Since we are moving towards Supabase, we might not strictly need this
    // but it's good for health checks and legacy support.
    await db.initialize();
    await blockchainService.initialize();
    console.log('✅ All services initialized successfully');
  } catch (error) {
    console.error('❌ Service initialization failed:', error);
  }
}

initializeServices();

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later'
    }
  }
});
app.use('/api/', limiter);

// Auth middleware
const authenticateToken = async (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      error: { code: 'NO_TOKEN', message: 'Access token required' } 
    });
  }

  try {
    const payload = await authService.verifyToken(token);
    if (!payload) {
      return res.status(403).json({ 
        success: false, 
        error: { code: 'INVALID_TOKEN', message: 'Invalid token' } 
      });
    }
    req.user = payload;
    next();
  } catch (error) {
    return res.status(403).json({ 
      success: false, 
      error: { code: 'TOKEN_ERROR', message: 'Token verification failed' } 
    });
  }
};

// Health check with service status
app.get('/health', async (req, res) => {
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      database: db.isHealthy(),
      blockchain: blockchainService.isBlockchainConnected(),
      eventTracker: eventTracker.isHealthy(),
      redis: eventTracker.isHealthy()
    }
  };

  const allHealthy = Object.values(healthStatus.services).every(status => status);
  
  res.status(allHealthy ? 200 : 503).json({ 
    success: allHealthy, 
    data: healthStatus 
  });
});

// ==================== ONBOARDING ROUTES ====================
// Mount onboarding routes protected by auth
app.use('/api/onboarding', authenticateToken, onboardingRoutes);

// ==================== AUTHENTICATION ROUTES ====================

app.post('/api/v1/auth/register', async (req, res) => {
  try {
    const { email, password, role, name } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'Email and password are required' }
      });
    }

    const result = await authService.register(email, password, role);
    
    // Track registration event
    await eventTracker.trackEvent({
      type: 'engagement',
      adId: 'registration',
      campaignId: 'platform_onboarding',
      userDid: result.user.did,
      publisherDid: 'platform',
      slotId: 'registration_form',
      metadata: { action: 'user_registered', role: role || 'user' }
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(400).json({ 
      success: false, 
      error: { 
        code: 'REGISTRATION_FAILED', 
        message: error.message 
      } 
    });
  }
});

app.post('/api/v1/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'Email and password are required' }
      });
    }

    const result = await authService.login(email, password);
    
    // Track login event
    await eventTracker.trackEvent({
      type: 'engagement',
      adId: 'login',
      campaignId: 'platform_engagement',
      userDid: result.user.did,
      publisherDid: 'platform',
      slotId: 'login_form',
      metadata: { action: 'user_login' }
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(400).json({ 
      success: false, 
      error: { 
        code: 'LOGIN_FAILED', 
        message: error.message 
      } 
    });
  }
});

// ==================== USER ROUTES ====================

app.get('/api/v1/users/profile', authenticateToken, async (req: any, res) => {
  try {
    const profile = await userService.getProfile(req.user.sub);
    res.json({ success: true, data: profile });
  } catch (error: any) {
    console.error('Profile fetch error:', error);
    res.status(404).json({ 
      success: false, 
      error: { 
        code: 'USER_NOT_FOUND', 
        message: error.message 
      } 
    });
  }
});

app.put('/api/v1/users/profile', authenticateToken, async (req: any, res) => {
  try {
    const updatedProfile = await userService.updatePreferences(req.user.sub, req.body);
    res.json({ success: true, data: updatedProfile });
  } catch (error: any) {
    console.error('Profile update error:', error);
    res.status(400).json({ 
      success: false, 
      error: { 
        code: 'UPDATE_FAILED', 
        message: error.message 
      } 
    });
  }
});

app.post('/api/v1/users/consent', authenticateToken, async (req: any, res) => {
  try {
    const { scope, campaignId } = req.body;
    const consent = await userService.createConsent(req.user.sub, scope, campaignId);
    
    // Track consent event
    await eventTracker.trackEvent({
      type: 'engagement',
      adId: 'consent',
      campaignId: campaignId || 'platform_consent',
      userDid: req.user.sub,
      publisherDid: 'platform',
      slotId: 'consent_form',
      metadata: { action: 'consent_granted', scope }
    });

    res.json({ success: true, data: consent });
  } catch (error: any) {
    console.error('Consent creation error:', error);
    res.status(400).json({ 
      success: false, 
      error: { 
        code: 'CONSENT_FAILED', 
        message: error.message 
      } 
    });
  }
});

app.get('/api/v1/users/consents', authenticateToken, async (req: any, res) => {
  try {
    const consents = await userService.getUserConsents(req.user.sub);
    res.json({ success: true, data: consents });
  } catch (error: any) {
    console.error('Consents fetch error:', error);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'FETCH_FAILED', 
        message: error.message 
      } 
    });
  }
});

app.get('/api/v1/users/events', authenticateToken, async (req: any, res) => {
  try {
    const events = await userService.getUserEvents(req.user.sub);
    res.json({ success: true, data: events });
  } catch (error: any) {
    console.error('User events fetch error:', error);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'FETCH_FAILED', 
        message: error.message 
      } 
    });
  }
});

// ==================== CAMPAIGN ROUTES ====================

app.post('/api/v1/campaigns', authenticateToken, async (req: any, res) => {
  try {
    const campaign = await campaignService.createCampaign(req.user.sub, req.body);
    
    // Track campaign creation
    await eventTracker.trackEvent({
      type: 'engagement',
      adId: 'campaign_creation',
      campaignId: campaign.id,
      userDid: req.user.sub,
      publisherDid: 'platform',
      slotId: 'campaign_form',
      metadata: { action: 'campaign_created', budget: campaign.budget }
    });

    res.json({ success: true, data: campaign });
  } catch (error: any) {
    console.error('Campaign creation error:', error);
    res.status(400).json({ 
      success: false, 
      error: { 
        code: 'CAMPAIGN_CREATION_FAILED', 
        message: error.message 
      } 
    });
  }
});

app.get('/api/v1/campaigns/:id', authenticateToken, async (req, res) => {
  try {
    const campaign = await campaignService.getCampaign(req.params.id);
    res.json({ success: true, data: campaign });
  } catch (error: any) {
    console.error('Campaign fetch error:', error);
    res.status(404).json({ 
      success: false, 
      error: { 
        code: 'CAMPAIGN_NOT_FOUND', 
        message: error.message 
      } 
    });
  }
});

app.get('/api/v1/campaigns', authenticateToken, async (req: any, res) => {
  try {
    const campaigns = await campaignService.getCampaignsByAdvertiser(req.user.sub);
    res.json({ success: true, data: campaigns });
  } catch (error: any) {
    console.error('Campaigns fetch error:', error);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'FETCH_FAILED', 
        message: error.message 
      } 
    });
  }
});

app.put('/api/v1/campaigns/:id', authenticateToken, async (req, res) => {
  try {
    const campaign = await campaignService.updateCampaign(req.params.id, req.body);
    res.json({ success: true, data: campaign });
  } catch (error: any) {
    console.error('Campaign update error:', error);
    res.status(400).json({ 
      success: false, 
      error: { 
        code: 'UPDATE_FAILED', 
        message: error.message 
      } 
    });
  }
});

// ==================== MARKETPLACE ROUTES ====================

app.post('/api/v1/marketplace/match', async (req, res) => {
  try {
    const { slot, publisherDid, userDid, sessionId, timestamp } = req.body;
    
    const adRequest = {
      slotId: slot.slotId,
      publisherDid,
      userDid,
      context: slot.context,
      timestamp,
      sessionId
    };

    const ad = await matchingService.findMatchingAds(adRequest);
    
    if (ad) {
      // Track ad request
      await eventTracker.trackEvent({
        type: 'impression',
        adId: ad.adId,
        campaignId: ad.campaignId,
        userDid,
        publisherDid,
        slotId: slot.slotId,
        metadata: { 
          bid: ad.bid,
          currency: ad.currency,
          sessionId,
          context: slot.context
        }
      });
    }

    res.json({ success: true, data: ad });
  } catch (error: any) {
    console.error('Ad matching error:', error);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'MATCHING_FAILED', 
        message: error.message 
      } 
    });
  }
});

// ==================== EVENT TRACKING ROUTES ====================

app.post('/api/v1/events/impression', async (req, res) => {
  try {
    const { adId, campaignId, userDid, publisherDid, slotId, metadata } = req.body;
    
    // Record in database
    const event = await eventService.recordEvent('impression', {
      adId,
      campaignId,
      userDid,
      publisherDid,
      slotId,
      metadata
    });

    // Track in real-time system
    await eventTracker.trackEvent({
      type: 'impression',
      adId,
      campaignId,
      userDid,
      publisherDid,
      slotId,
      metadata: metadata || {}
    });

    res.json({ success: true, data: event });
  } catch (error: any) {
    console.error('Impression tracking error:', error);
    res.status(400).json({ 
      success: false, 
      error: { 
        code: 'EVENT_RECORDING_FAILED', 
        message: error.message 
      } 
    });
  }
});

app.post('/api/v1/events/click', async (req, res) => {
  try {
    const { adId, campaignId, userDid, publisherDid, slotId, metadata } = req.body;
    
    const event = await eventService.recordEvent('click', {
      adId,
      campaignId,
      userDid,
      publisherDid,
      slotId,
      metadata
    });

    await eventTracker.trackEvent({
      type: 'click',
      adId,
      campaignId,
      userDid,
      publisherDid,
      slotId,
      metadata: metadata || {}
    });

    res.json({ success: true, data: event });
  } catch (error: any) {
    console.error('Click tracking error:', error);
    res.status(400).json({ 
      success: false, 
      error: { 
        code: 'EVENT_RECORDING_FAILED', 
        message: error.message 
      } 
    });
  }
});

app.post('/api/v1/events/conversion', async (req, res) => {
  try {
    const { adId, campaignId, userDid, publisherDid, slotId, metadata } = req.body;
    
    const event = await eventService.recordEvent('conversion', {
      adId,
      campaignId,
      userDid,
      publisherDid,
      slotId,
      metadata
    });

    await eventTracker.trackEvent({
      type: 'conversion',
      adId,
      campaignId,
      userDid,
      publisherDid,
      slotId,
      metadata: metadata || {}
    });

    res.json({ success: true, data: event });
  } catch (error: any) {
    console.error('Conversion tracking error:', error);
    res.status(400).json({ 
      success: false, 
      error: { 
        code: 'EVENT_RECORDING_FAILED', 
        message: error.message 
      } 
    });
  }
});

app.post('/api/v1/events/batch', async (req, res) => {
  try {
    const { events, publisherId, sessionId } = req.body;
    
    const processedEvents = events.map((event: any) => ({
      type: event.metadata.eventType,
      adId: event.adId,
      campaignId: event.metadata.campaignId || 'unknown',
      userDid: event.metadata.userDid,
      publisherDid: publisherId,
      slotId: event.slotId,
      metadata: { ...event.metadata, sessionId }
    }));

    const results = await eventService.batchRecordEvents(processedEvents);
    
    // Track in real-time system
    await eventTracker.trackEventBatch(processedEvents.map(event => ({
      type: event.type,
      adId: event.adId,
      campaignId: event.campaignId,
      userDid: event.userDid,
      publisherDid: event.publisherDid,
      slotId: event.slotId,
      metadata: event.metadata
    })));

    res.json({ success: true, data: results });
  } catch (error: any) {
    console.error('Batch event tracking error:', error);
    res.status(400).json({ 
      success: false, 
      error: { 
        code: 'BATCH_EVENT_FAILED', 
        message: error.message 
      } 
    });
  }
});

// ==================== ANALYTICS ROUTES ====================

app.get('/api/v1/campaigns/:id/events', authenticateToken, async (req, res) => {
  try {
    const events = await eventService.getEventsByCampaign(req.params.id);
    res.json({ success: true, data: events });
  } catch (error: any) {
    console.error('Campaign events fetch error:', error);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'FETCH_FAILED', 
        message: error.message 
      } 
    });
  }
});

app.get('/api/v1/campaigns/:id/metrics', authenticateToken, async (req, res) => {
  try {
    const metrics = await eventTracker.getCampaignMetrics(req.params.id);
    res.json({ success: true, data: metrics });
  } catch (error: any) {
    console.error('Campaign metrics fetch error:', error);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'METRICS_FETCH_FAILED', 
        message: error.message 
      } 
    });
  }
});

app.get('/api/v1/publishers/:id/metrics', async (req, res) => {
  try {
    const metrics = await eventTracker.getPublisherMetrics(req.params.id);
    res.json({ success: true, data: metrics });
  } catch (error: any) {
    console.error('Publisher metrics fetch error:', error);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'METRICS_FETCH_FAILED', 
        message: error.message 
      } 
    });
  }
});

app.get('/api/v1/analytics/global', authenticateToken, async (req, res) => {
  try {
    const metrics = await eventTracker.getGlobalMetrics();
    res.json({ success: true, data: metrics });
  } catch (error: any) {
    console.error('Global metrics fetch error:', error);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'METRICS_FETCH_FAILED', 
        message: error.message 
      } 
    });
  }
});

// ==================== PUBLISHER ROUTES ====================

app.post('/api/v1/publishers/verify', async (req, res) => {
  try {
    const { publisherId } = req.body;
    const result = await publisherService.verifyPublisher(publisherId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Publisher verification error:', error);
    res.status(400).json({ 
      success: false, 
      error: { 
        code: 'VERIFICATION_FAILED', 
        message: error.message 
      } 
    });
  }
});

app.get('/api/v1/publishers/:id', async (req, res) => {
  try {
    const publisher = await publisherService.getPublisher(req.params.id);
    res.json({ success: true, data: publisher });
  } catch (error: any) {
    console.error('Publisher fetch error:', error);
    res.status(404).json({ 
      success: false, 
      error: { 
        code: 'PUBLISHER_NOT_FOUND', 
        message: error.message 
      } 
    });
  }
});

// ==================== BLOCKCHAIN INTEGRATION ROUTES ====================

app.post('/api/v1/blockchain/campaigns/:id/escrow/lock', authenticateToken, async (req, res) => {
  try {
    const campaign = await campaignService.getCampaign(req.params.id);
    const transaction = await blockchainService.lockCampaignFunds(campaign);
    res.json({ success: true, data: transaction });
  } catch (error: any) {
    console.error('Escrow lock error:', error);
    res.status(400).json({ 
      success: false, 
      error: { 
        code: 'ESCROW_LOCK_FAILED', 
        message: error.message 
      } 
    });
  }
});

app.get('/api/v1/blockchain/campaigns/:id/escrow', authenticateToken, async (req, res) => {
  try {
    const escrowDetails = await blockchainService.getCampaignEscrow(req.params.id);
    res.json({ success: true, data: escrowDetails });
  } catch (error: any) {
    console.error('Escrow query error:', error);
    res.status(400).json({ 
      success: false, 
      error: { 
        code: 'ESCROW_QUERY_FAILED', 
        message: error.message 
      } 
    });
  }
});

app.get('/api/v1/blockchain/tokens/balance', authenticateToken, async (req: any, res) => {
  try {
    const balance = await blockchainService.getUserTokenBalance(req.user.sub);
    res.json({ success: true, data: { balance, userDid: req.user.sub } });
  } catch (error: any) {
    console.error('Balance query error:', error);
    res.status(400).json({ 
      success: false, 
      error: { 
        code: 'BALANCE_QUERY_FAILED', 
        message: error.message 
      } 
    });
  }
});

app.get('/api/v1/blockchain/status', async (req, res) => {
  try {
    const status = {
      isConnected: blockchainService.isBlockchainConnected(),
      networkInfo: blockchainService.getNetworkInfo()
    };
    res.json({ success: true, data: status });
  } catch (error: any) {
    console.error('Blockchain status error:', error);
    res.status(500).json({ 
      success: false, 
      error: { 
        code: 'BLOCKCHAIN_STATUS_FAILED', 
        message: error.message 
      } 
    });
  }
});

// ==================== ERROR HANDLING ====================

app.use((error: any, req: any, res: any, next: any) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    success: false, 
    error: { 
      code: 'INTERNAL_SERVER_ERROR', 
      message: 'An unexpected error occurred' 
    } 
  });
});

app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    error: { 
      code: 'NOT_FOUND', 
      message: 'Endpoint not found' 
    } 
  });
});

// ==================== SERVER STARTUP ====================

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await eventTracker.close();
  await db.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await eventTracker.close();
  await db.close();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 Metaverse Advertising API Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📖 API Base URL: http://localhost:${PORT}/api/v1`);
  console.log(`🔐 Authentication: Bearer token required for protected routes`);
  console.log(`📈 Real-time analytics: Event tracking enabled`);
  console.log(`🔗 Blockchain integration: ${blockchainService.isBlockchainConnected() ? 'Connected' : 'Mock mode'}`);
});

export default app;
