import { Router } from 'express';
import DatabaseService from '../lib/database';
import AnalyticsDashboardService from '../lib/analytics-dashboard';
import FraudPreventionService from '../lib/fraud-prevention';

const adminRouter = Router();
const db = new DatabaseService();

// Middleware to check admin role (simplified for MVP)
const requireAdmin = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  
  // In production, verify JWT and check role
  if (!authHeader || !authHeader.includes('admin')) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  next();
};

// Get platform statistics
adminRouter.get('/stats', requireAdmin, async (req, res) => {
  try {
    const stats = {
      totalUsers: 1250,
      totalCampaigns: 45,
      totalPublishers: 23,
      totalRevenue: 125000,
      activeUsers: 890,
      activeCampaigns: 12,
      platformHealth: 'healthy',
      timestamp: new Date().toISOString()
    };

    res.json(stats);
  } catch (error: any) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all users
adminRouter.get('/users', requireAdmin, async (req, res) => {
  try {
    // In production, implement pagination
    const users = [
      {
        did: 'did:user:1',
        email: 'user1@example.com',
        displayName: 'User One',
        role: 'user',
        status: 'active',
        createdAt: new Date().toISOString()
      }
    ];

    res.json(users);
  } catch (error: any) {
    console.error('Admin users fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all campaigns
adminRouter.get('/campaigns', requireAdmin, async (req, res) => {
  try {
    const campaigns = await db.getActiveCampaigns();
    res.json(campaigns);
  } catch (error: any) {
    console.error('Admin campaigns fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Approve/reject campaign
adminRouter.patch('/campaigns/:id/status', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const campaign = await db.updateCampaign(id, { status });
    
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json(campaign);
  } catch (error: any) {
    console.error('Campaign status update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get fraud alerts
adminRouter.get('/fraud/alerts', requireAdmin, async (req, res) => {
  try {
    const fraudService = new FraudPreventionService(db);
    const alerts = await fraudService.getActiveAlerts();
    res.json(alerts);
  } catch (error: any) {
    console.error('Fraud alerts fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// System health check
adminRouter.get('/health', requireAdmin, async (req, res) => {
  try {
    const health = {
      database: db.isHealthy() ? 'healthy' : 'unhealthy',
      api: 'healthy',
      blockchain: 'healthy',
      redis: 'healthy',
      timestamp: new Date().toISOString()
    };

    res.json(health);
  } catch (error: any) {
    console.error('Health check error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default adminRouter;
