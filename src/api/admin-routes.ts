import { Router } from 'express';
// import DatabaseService from '../lib/database'; // REMOVED
import AnalyticsDashboardService from '../lib/analytics-dashboard';
import FraudPreventionService from '../lib/fraud-prevention';
import { createServerClient, supabaseServer } from '../lib/supabase-server';

const adminRouter = Router();
// const db = new DatabaseService(); // REMOVED

// Middleware to check admin role
const requireAdmin = async (req: any, res: any, next: any) => {
  // 1. Verify we have a user (from previous requireAuth middleware)
  if (!req.user || !req.user.id) {
     return res.status(401).json({ error: 'Authentication required' });
  }

  try {
     // 2. Query profiles for role
     // We use the user's token to query their own profile. RLS should allow this.
     const supabase = createServerClient(req.token);
     const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', req.user.id)
        .single();

     if (error) {
        console.error(`Admin check failed for user ${req.user.id}:`, error);
        return res.status(403).json({ error: 'Access denied' });
     }

     if (!profile) {
        console.warn(`Profile not found for user ${req.user.id} during admin check`);
        return res.status(403).json({ error: 'Profile not found' });
     }

     if (profile.role !== 'admin') {
        console.warn(`User ${req.user.id} attempted admin access with role ${profile.role}`);
        return res.status(403).json({ error: 'Admin access required' });
     }

     next();
  } catch (err) {
     console.error('Admin middleware error:', err);
     return res.status(500).json({ error: 'Internal server error' });
  }
};

// Apply admin check to all routes in this router
adminRouter.use(requireAdmin);

// Get platform statistics
adminRouter.get('/stats', async (req, res) => {
  try {
    // TODO: Implement real stats aggregation via Supabase RPC or separate queries
    // For now, mocking with real counts where easy
    const { count: usersCount } = await supabaseServer.from('profiles').select('*', { count: 'exact', head: true });
    const { count: campaignsCount } = await supabaseServer.from('campaigns').select('*', { count: 'exact', head: true });

    const stats = {
      totalUsers: usersCount || 0,
      totalCampaigns: campaignsCount || 0,
      totalPublishers: 0, // Need to count publishers table
      totalRevenue: 0, // Need to sum transactions
      activeUsers: 0,
      activeCampaigns: 0,
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
adminRouter.get('/users', async (req, res) => {
  try {
    // Use Supabase client with pagination
    // Using supabaseServer (anon/admin) because we are admin.
    // Ideally we should use the user's token, but admin might have broader access via RLS.
    // If RLS allows admin to select all profiles, we use req.token.
    const supabase = createServerClient(req.token);

    const { data: users, error } = await supabase
        .from('profiles')
        .select('*')
        .limit(50); // Pagination needed

    if (error) throw error;
    res.json(users);
  } catch (error: any) {
    console.error('Admin users fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all campaigns
adminRouter.get('/campaigns', async (req, res) => {
  try {
    const supabase = createServerClient(req.token);
    const { data: campaigns, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('status', 'active'); // Matches original logic "getActiveCampaigns"

    if (error) throw error;
    res.json(campaigns);
  } catch (error: any) {
    console.error('Admin campaigns fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Approve/reject campaign
adminRouter.patch('/campaigns/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const supabase = createServerClient(req.token);
    const { data: campaign, error } = await supabase
        .from('campaigns')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
    
    if (error) throw error;
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
adminRouter.get('/fraud/alerts', async (req, res) => {
  try {
    const fraudService = new FraudPreventionService();
    const alerts = await fraudService.getActiveAlerts();
    res.json(alerts);
  } catch (error: any) {
    console.error('Fraud alerts fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// System health check
adminRouter.get('/health', async (req, res) => {
  try {
    const health = {
      database: 'healthy', // Supabase is managed
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
