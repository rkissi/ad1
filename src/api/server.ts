// Production API Server for Metaverse Advertising Platform
import dotenv from 'dotenv';
dotenv.config();
import { fileURLToPath } from 'url';
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
// import DatabaseService from '../lib/database'; // DELETED
import { eventTracker } from '../lib/event-tracker';
import SmartContractService from '../lib/smart-contracts';
import TransactionManager from '../lib/transaction-manager';
import FraudPreventionService from '../lib/fraud-prevention';
import AnalyticsDashboardService from '../lib/analytics-dashboard';
import { environmentManager, logger } from '../lib/environment-manager';
import { paymentRouter } from './payment-routes';
import adminRouter from './admin-routes';
import { onboardingRouter } from './onboarding-routes';
import { createServerClient, supabaseServer } from '../lib/supabase-server';

// Extend Request type to include token
declare global {
  namespace Express {
    interface Request {
      token?: string;
      user?: any; // Supabase user object
    }
  }
}

export class ApiServer {
  private app: Express;
  // private db: DatabaseService;
  private contractService: SmartContractService;
  private transactionManager: TransactionManager;
  private fraudService: FraudPreventionService;
  private analyticsService: AnalyticsDashboardService;
  private port: number;

  constructor() {
    this.app = express();
    this.port = environmentManager.getApiConfig().port;
    
    // Initialize services
    this.contractService = new SmartContractService();

    this.transactionManager = new TransactionManager(this.contractService);
    this.fraudService = new FraudPreventionService();
    this.analyticsService = new AnalyticsDashboardService(
      this.transactionManager,
      this.fraudService
    );

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    
    // CORS configuration
    const corsOptions = {
      origin: environmentManager.getApiConfig().corsOrigins,
      credentials: true
    };
    this.app.use(cors(corsOptions));

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: environmentManager.getApiConfig().rateLimiting.windowMs,
      max: environmentManager.getApiConfig().rateLimiting.maxRequests,
      message: 'Too many requests from this IP, please try again later.'
    });
    this.app.use('/api/', limiter);

    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent')
      });
      next();
    });
  }

  // Middleware to extract and verify Supabase auth token
  private requireAuth = async (req: Request, res: Response, next: Function) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Invalid authorization header' });
    }

    try {
      const supabase = createServerClient(token);
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        console.error('Auth verification failed:', error);
        return res.status(401).json({ error: 'Invalid token' });
      }

      req.token = token;
      req.user = user;
      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', async (req, res) => {
      const health = await environmentManager.performHealthCheck();
      res.status(health.status === 'healthy' ? 200 : 503).json(health);
    });

    // API v1 routes
    const apiRouter = express.Router();

    // ==================== AUTHENTICATION (DEPRECATED) ====================
    apiRouter.all('/auth/*', (req, res) => {
      res.status(410).json({
        error: 'Legacy authentication endpoints are deprecated. Please use Supabase Auth.',
        code: 'AUTH_DEPRECATED'
      });
    });

    // Force Supabase Auth on all other API routes
    apiRouter.use(this.requireAuth);

    // ==================== CAMPAIGNS ====================
    apiRouter.post('/campaigns', async (req, res, next) => {
      try {
        const supabase = createServerClient(req.token);
        const { data, error } = await supabase
          .from('campaigns')
          .insert({
             ...req.body,
             advertiser_id: req.user.id
          })
          .select()
          .single();

        if (error) throw error;
        res.status(201).json(data);
      } catch (error) {
        next(error);
      }
    });

    apiRouter.get('/campaigns/:id', async (req, res, next) => {
      try {
        const supabase = createServerClient(req.token);
        const { data, error } = await supabase
          .from('campaigns')
          .select('*')
          .eq('id', req.params.id)
          .single();

        if (error) {
           if (error.code === 'PGRST116') return res.status(404).json({ error: 'Campaign not found' });
           throw error;
        }
        res.json(data);
      } catch (error) {
        next(error);
      }
    });

    apiRouter.get('/campaigns', async (req, res, next) => {
      try {
        const supabase = createServerClient(req.token);
        const { advertiser } = req.query;
        let query = supabase.from('campaigns').select('*').order('created_at', { ascending: false });

        // If filtering by advertiser (and user has permission to see it? RLS handles that)
        // If advertiser param is passed, we check if it matches current user OR if current user is admin?
        // For now, let's rely on RLS. If user asks for campaigns, they get theirs.
        // If admin, maybe they can see all?

        if (advertiser) {
           // We might want to verify if they can query this.
           // RLS: 'select' policy usually limits to owner or admin.
           // So just querying should be safe.
           query = query.eq('advertiser_id', advertiser as string);
        } else {
           // Get active campaigns?
           // Legacy behavior: 'getActiveCampaigns' implies status='active'
           // If no advertiser param, maybe return active campaigns for marketplace?
           // But this is a protected route.
           // If it's for the dashboard, usually filtering by advertiser_id is automatic via RLS for "my campaigns".
           // If I want "all active campaigns" (e.g. for matching), that might be different.
           // Let's assume this endpoint is for the user dashboard.
           // Supabase RLS will filter automatically.

           // However, if we want to filter by status explicitly:
           query = query.eq('status', 'active');
        }

        const { data, error } = await query;
        if (error) throw error;
        res.json(data);
      } catch (error) {
        next(error);
      }
    });

    apiRouter.patch('/campaigns/:id', async (req, res, next) => {
      try {
        const supabase = createServerClient(req.token);
        const { data, error } = await supabase
          .from('campaigns')
          .update(req.body)
          .eq('id', req.params.id)
          .select()
          .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Campaign not found' });
        res.json(data);
      } catch (error) {
        next(error);
      }
    });

    // ==================== BLOCKCHAIN ESCROW ====================
    apiRouter.post('/campaigns/:id/lock-funds', async (req, res, next) => {
      try {
        const supabase = createServerClient(req.token);
        const { data: campaign, error } = await supabase
            .from('campaigns')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error || !campaign) {
          return res.status(404).json({ error: 'Campaign not found' });
        }

        const transaction = await this.transactionManager.depositCampaignFunds(
          campaign.id,
          campaign.budget.toString(),
          campaign.advertiser_id || ''
        );

        res.json(transaction);
      } catch (error) {
        next(error);
      }
    });

    apiRouter.post('/campaigns/:id/release-funds', async (req, res, next) => {
      try {
        const { recipients } = req.body;
        
        const transaction = await this.transactionManager.executeBatchPayouts({
          campaignId: req.params.id,
          recipients,
          totalAmount: recipients.reduce((sum: number, r: any) => sum + parseFloat(r.amount), 0).toString(),
          eventIds: []
        });

        res.json(transaction);
      } catch (error) {
        next(error);
      }
    });

    // ==================== EVENT TRACKING ====================
    apiRouter.post('/events/impression', async (req, res, next) => {
      try {
        const event = req.body;
        
        // Fraud validation
        const validation = await this.fraudService.validateEvent({
          type: 'impression',
          sessionId: event.sessionId,
          userDid: event.userDid,
          publisherDid: event.publisherDid,
          campaignId: event.campaignId,
          ipAddress: req.ip || '0.0.0.0',
          userAgent: req.get('user-agent') || '',
          timestamp: new Date().toISOString()
        });

        if (!validation.isValid) {
          return res.status(403).json({ 
            error: 'Event blocked by fraud prevention',
            flags: validation.flags 
          });
        }

        await eventTracker.trackEvent({
          type: 'impression',
          adId: event.adId,
          campaignId: event.campaignId,
          userDid: event.userDid,
          publisherDid: event.publisherDid,
          slotId: event.slotId,
          metadata: event.metadata || {}
        });

        res.status(201).json({ success: true, riskScore: validation.riskScore });
      } catch (error) {
        next(error);
      }
    });

    apiRouter.post('/events/click', async (req, res, next) => {
      try {
        const event = req.body;
        
        const validation = await this.fraudService.validateEvent({
          type: 'click',
          sessionId: event.sessionId,
          userDid: event.userDid,
          publisherDid: event.publisherDid,
          campaignId: event.campaignId,
          ipAddress: req.ip || '0.0.0.0',
          userAgent: req.get('user-agent') || '',
          timestamp: new Date().toISOString()
        });

        if (!validation.isValid) {
          return res.status(403).json({ 
            error: 'Event blocked by fraud prevention',
            flags: validation.flags 
          });
        }

        await eventTracker.trackEvent({
          type: 'click',
          adId: event.adId,
          campaignId: event.campaignId,
          userDid: event.userDid,
          publisherDid: event.publisherDid,
          slotId: event.slotId,
          metadata: event.metadata || {}
        });

        res.status(201).json({ success: true, riskScore: validation.riskScore });
      } catch (error) {
        next(error);
      }
    });

    apiRouter.post('/events/batch', async (req, res, next) => {
      try {
        const { events } = req.body;
        await eventTracker.trackEventBatch(events);
        res.status(201).json({ success: true, count: events.length });
      } catch (error) {
        next(error);
      }
    });

    // ==================== ANALYTICS ====================
    apiRouter.get('/analytics/dashboard', async (req, res, next) => {
      try {
        const metrics = await this.analyticsService.getDashboardMetrics();
        res.json(metrics);
      } catch (error) {
        next(error);
      }
    });

    apiRouter.get('/analytics/campaigns/:id', async (req, res, next) => {
      try {
        const performance = await this.analyticsService.getCampaignPerformance(req.params.id);
        res.json(performance);
      } catch (error) {
        next(error);
      }
    });

    apiRouter.get('/analytics/publishers/:did', async (req, res, next) => {
      try {
        const performance = await this.analyticsService.getPublisherPerformance(req.params.did);
        res.json(performance);
      } catch (error) {
        next(error);
      }
    });

    apiRouter.get('/analytics/fraud/alerts', async (req, res, next) => {
      try {
        const alerts = await this.fraudService.getActiveAlerts();
        res.json(alerts);
      } catch (error) {
        next(error);
      }
    });

    apiRouter.get('/analytics/fraud/stats', async (req, res, next) => {
      try {
        const stats = await this.fraudService.getFraudStats();
        res.json(stats);
      } catch (error) {
        next(error);
      }
    });

    // ==================== MARKETPLACE ====================
    apiRouter.post('/marketplace/match', async (req, res, next) => {
      try {
        const { slot, publisherDid, userDid } = req.body;
        
        // Use Supabase Admin Client to find active campaigns to match
        const { data: campaigns } = await supabaseServer
            .from('campaigns')
            .select('*')
            .eq('status', 'active');
        
        // Simple matching logic
        const matchedCampaign = campaigns?.find(c =>
          c.audience_spec && typeof c.audience_spec === 'object' && 'interests' in c.audience_spec &&
          Array.isArray((c.audience_spec as any).interests) &&
          (c.audience_spec as any).interests.some((interest: string) =>
            slot.context?.keywords?.includes(interest)
          )
        );

        if (!matchedCampaign) {
          return res.json({ matched: false });
        }

        res.json({
          matched: true,
          ad: {
            id: `ad_${matchedCampaign.id}_${Date.now()}`,
            campaignId: matchedCampaign.id,
            creative: matchedCampaign.creative_manifest,
            bidAmount: 0.01
          }
        });
      } catch (error) {
        next(error);
      }
    });

    // ==================== CONSENT ====================
    apiRouter.post('/consent/record', async (req, res, next) => {
      try {
        const { userDid, scope, campaignId } = req.body;
        
        const transaction = await this.transactionManager.recordConsent(
          userDid,
          scope,
          campaignId
        );

        res.status(201).json(transaction);
      } catch (error) {
        next(error);
      }
    });

    apiRouter.get('/consent/:userDid', async (req, res, next) => {
      try {
        const supabase = createServerClient(req.token);
        // Note: userDid might not be profile ID. But we are moving to profile ID.
        // Assuming userDid == profile ID for now, or we lookup.
        // The prompt says "All user references -> profiles.id".
        const { data: consents, error } = await supabase
            .from('consents')
            .select('*')
            .eq('user_id', req.params.userDid) // Migrated column name
            .eq('is_active', true);

        if (error) throw error;
        res.json(consents);
      } catch (error) {
        next(error);
      }
    });

    // Mount API router
    this.app.use('/api/v1', apiRouter);

    // Mount routers
    this.app.use('/api/v1/payments', this.requireAuth, paymentRouter);
    this.app.use('/api/v1/admin', this.requireAuth, adminRouter);
    this.app.use('/api/onboarding', onboardingRouter);

    // Metrics endpoint
    this.app.get('/metrics', async (req, res) => {
      // Prometheus-compatible metrics
      const metrics = await this.analyticsService.getDashboardMetrics();
      res.set('Content-Type', 'text/plain');
      res.send(`
# HELP metaverse_ads_impressions_total Total number of ad impressions
# TYPE metaverse_ads_impressions_total counter
metaverse_ads_impressions_total ${metrics.performance.impressions}

# HELP metaverse_ads_clicks_total Total number of ad clicks
# TYPE metaverse_ads_clicks_total counter
metaverse_ads_clicks_total ${metrics.performance.clicks}

# HELP metaverse_ads_conversions_total Total number of conversions
# TYPE metaverse_ads_conversions_total counter
metaverse_ads_conversions_total ${metrics.performance.conversions}

# HELP metaverse_ads_active_campaigns Number of active campaigns
# TYPE metaverse_ads_active_campaigns gauge
metaverse_ads_active_campaigns ${metrics.overview.activeCampaigns}

# HELP metaverse_ads_fraud_alerts_total Total fraud alerts
# TYPE metaverse_ads_fraud_alerts_total counter
metaverse_ads_fraud_alerts_total ${metrics.fraud.totalAlerts}
      `);
    });
  }

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({ error: 'Not found' });
    });

    // Global error handler
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      logger.error('API Error:', err);
      
      res.status(500).json({
        error: environmentManager.isProduction() 
          ? 'Internal server error' 
          : err.message,
        stack: environmentManager.isDevelopment() ? err.stack : undefined
      });
    });
  }

  async start(): Promise<void> {
    try {
      // Initialize services
      // await this.db.initialize(); // REMOVED
      await this.transactionManager.initialize();
      await this.fraudService.initialize();

      // Start server
      this.app.listen(this.port, () => {
        logger.info(`🚀 API Server running on port ${this.port}`);
        logger.info(`📊 Environment: ${environmentManager.getCurrentEnvironment()}`);
        logger.info(`🔗 Health check: http://localhost:${this.port}/health`);
        logger.info(`📈 Metrics: http://localhost:${this.port}/metrics`);
      });
    } catch (error) {
      logger.error('Failed to start API server:', error);
      process.exit(1);
    }
  }

  async stop(): Promise<void> {
    logger.info('Shutting down API server...');
    
    await this.transactionManager.close();
    await eventTracker.close();
    // await this.db.close(); // REMOVED
    
    logger.info('API server stopped');
  }
}

export default ApiServer;