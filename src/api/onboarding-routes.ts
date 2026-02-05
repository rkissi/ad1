import { Router, Request, Response } from 'express';
import { createServerClient } from '../lib/supabase-server';
import { UserRole } from '../types/supabase';

export const onboardingRouter = Router();

// Extend Request type to include token
declare global {
  namespace Express {
    interface Request {
      token?: string;
      user?: any; // Supabase user object
    }
  }
}

// Middleware to extract and verify auth token
const requireAuth = async (req: Request, res: Response, next: Function) => {
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

onboardingRouter.use(requireAuth);

// Helper to format error
const formatError = (error: any) => {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null) {
    if (error.code === 'PGRST116') return 'Profile not found';
    return error.message || error.error || JSON.stringify(error);
  }
  return 'Unknown error';
};

// GET /status
onboardingRouter.get('/status', async (req: Request, res: Response) => {
  try {
    const supabase = createServerClient(req.token);
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('onboarding_status, onboarding_step, role')
      .eq('id', req.user.id)
      .single();

    if (error) throw error;

    res.json(profile);
  } catch (error: any) {
    console.error('Get status error:', error);
    const status = error?.code === 'PGRST116' ? 404 : 500;
    res.status(status).json({ error: formatError(error) });
  }
});

// POST /start
onboardingRouter.post('/start', async (req: Request, res: Response) => {
  try {
    const supabase = createServerClient(req.token);
    const userId = req.user.id;

    // 1. Get current profile to know the role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, onboarding_status')
      .eq('id', userId)
      .single();

    if (profileError) throw profileError;

    // 2. If already completed, just return
    if (profile.onboarding_status === 'completed') {
      return res.json({ message: 'Onboarding already completed' });
    }

    // 3. Set status to in_progress
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ onboarding_status: 'in_progress' })
      .eq('id', userId);

    if (updateError) throw updateError;

    res.json({ success: true, status: 'in_progress' });
  } catch (error: any) {
    console.error('Start onboarding error:', error);
    const status = error?.code === 'PGRST116' ? 404 : 500;
    res.status(status).json({ error: formatError(error) });
  }
});

// POST /step
// Body: { step: string, data: any }
onboardingRouter.post('/step', async (req: Request, res: Response) => {
  try {
    const { step, data } = req.body;
    const supabase = createServerClient(req.token);
    const userId = req.user.id;

    if (!step) return res.status(400).json({ error: 'Step is required' });

    // 1. Get role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profileError) throw profileError;
    const role = profile.role;

    // 2. Update role-specific table if data provided
    if (data && Object.keys(data).length > 0) {
      let table = '';
      if (role === 'user') table = 'user_onboarding';
      else if (role === 'advertiser') table = 'advertiser_onboarding';
      else if (role === 'publisher') table = 'publisher_onboarding';
      else if (role === 'admin') {
         // Admins might not have specific onboarding data, or use user_onboarding?
         // Assuming admin skips or just updates profile.
      }

      if (table) {
        // We use upsert to create or update
        // We need the PK. PK is user_id / advertiser_id / publisher_id which matches profile.id
        const updateData = { ...data };
        if (role === 'user') updateData.user_id = userId;
        else if (role === 'advertiser') updateData.advertiser_id = userId;
        else if (role === 'publisher') updateData.publisher_id = userId;

        const { error: tableError } = await supabase
          .from(table as any)
          .upsert(updateData);

        if (tableError) throw tableError;
      }
    }

    // 3. Update profile step and status (ensure in_progress)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        onboarding_step: step,
        onboarding_status: 'in_progress'
      })
      .eq('id', userId);

    if (updateError) throw updateError;

    res.json({ success: true, step });
  } catch (error: any) {
    console.error('Update step error:', error);
    const status = error?.code === 'PGRST116' ? 404 : 500;
    res.status(status).json({ error: formatError(error) });
  }
});

// POST /complete
onboardingRouter.post('/complete', async (req: Request, res: Response) => {
  try {
    const supabase = createServerClient(req.token);
    const userId = req.user.id;

    const { error } = await supabase
      .from('profiles')
      .update({
        onboarding_status: 'completed',
        onboarding_completed_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) throw error;

    res.json({ success: true, status: 'completed' });
  } catch (error: any) {
    console.error('Complete onboarding error:', error);
    res.status(500).json({ error: formatError(error) });
  }
});

// Role specific endpoints (wrappers around logic similar to /step)

// POST /user
onboardingRouter.post('/user', async (req: Request, res: Response) => {
   // Implementation would be similar to /step but specific to user_onboarding
   // For now, we rely on /step for incremental updates.
   // Or this could be the endpoint to dump the whole form.
   // Given the prompt asks for these specific endpoints, I'll implement them as
   // full updates for that role's onboarding data.
   try {
     const data = req.body;
     const supabase = createServerClient(req.token);
     const userId = req.user.id;

     const { error } = await supabase
       .from('user_onboarding')
       .upsert({ ...data, user_id: userId });

     if (error) throw error;

     // Also ensure status is in_progress
      await supabase
      .from('profiles')
      .update({ onboarding_status: 'in_progress' })
      .eq('id', userId);

     res.json({ success: true });
   } catch (error: any) {
    res.status(500).json({ error: formatError(error) });
   }
});

onboardingRouter.post('/advertiser', async (req: Request, res: Response) => {
   try {
     const data = req.body;
     const supabase = createServerClient(req.token);
     const userId = req.user.id;

     const { error } = await supabase
       .from('advertiser_onboarding')
       .upsert({ ...data, advertiser_id: userId });

     if (error) throw error;

      await supabase
      .from('profiles')
      .update({ onboarding_status: 'in_progress' })
      .eq('id', userId);

     res.json({ success: true });
   } catch (error: any) {
    res.status(500).json({ error: formatError(error) });
   }
});

onboardingRouter.post('/publisher', async (req: Request, res: Response) => {
   try {
     const data = req.body;
     const supabase = createServerClient(req.token);
     const userId = req.user.id;

     const { error } = await supabase
       .from('publisher_onboarding')
       .upsert({ ...data, publisher_id: userId });

     if (error) throw error;

      await supabase
      .from('profiles')
      .update({ onboarding_status: 'in_progress' })
      .eq('id', userId);

     res.json({ success: true });
   } catch (error: any) {
    res.status(500).json({ error: formatError(error) });
   }
});
