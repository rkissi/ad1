import { Router } from 'express';
import { OnboardingService } from '../services';

const router = Router();
const onboardingService = new OnboardingService();

// Helper to get user ID from request (assuming auth middleware populates req.user)
const getUserId = (req: any) => {
  if (!req.user || !req.user.sub) {
    throw new Error('User not authenticated');
  }
  return req.user.sub;
};

router.get('/status', async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const data = await onboardingService.getStatus(userId);
    res.json(data);
  } catch (error: any) {
    console.error('Onboarding status error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/start', async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const data = await onboardingService.start(userId);
    res.json(data);
  } catch (error: any) {
    console.error('Onboarding start error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/step', async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const { step, data } = req.body;

    // We need the role to know which table to update.
    // Ideally this comes from the user token or profile.
    // Assuming req.user.role is populated by AuthService.verifyToken
    const role = req.user.role;

    if (!role) {
       throw new Error('User role not found in session');
    }

    const result = await onboardingService.updateStep(userId, step, data, role);
    res.json(result);
  } catch (error: any) {
    console.error('Onboarding step error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/complete', async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const data = await onboardingService.complete(userId);
    res.json(data);
  } catch (error: any) {
    console.error('Onboarding complete error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
