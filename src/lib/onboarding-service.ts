import { supabase } from './supabase';

// Determine if we're in production or development
const isProduction = import.meta.env.PROD;

interface OnboardingResponse {
  success?: boolean;
  status?: string;
  step?: string;
  message?: string;
  error?: string;
  role?: string;
  onboarding_status?: string;
  onboarding_step?: string;
}

async function getAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    throw new Error('No active session');
  }
  return token;
}

// Call onboarding via Edge Function
async function callEdgeFunction(action: string, data?: Record<string, any>): Promise<OnboardingResponse> {
  const token = await getAuthToken();
  
  const { data: response, error } = await supabase.functions.invoke('supabase-functions-onboarding', {
    body: { action, ...data },
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (error) {
    console.error('Edge function error:', error);
    throw new Error(error.message || 'Onboarding request failed');
  }

  return response;
}

// Call onboarding via Express API (for local dev)
async function callExpressApi(endpoint: string, options: RequestInit = {}): Promise<OnboardingResponse> {
  const token = await getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers as Record<string, string>,
  };

  const response = await fetch(`/api/onboarding${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let errorMessage = response.statusText;
    try {
      const json = JSON.parse(errorBody);
      errorMessage = json.error || json.message || errorMessage;
    } catch (e) {}
    throw new Error(errorMessage);
  }

  return response.json();
}

export const onboardingService = {
  async getStatus(): Promise<OnboardingResponse> {
    if (isProduction) {
      return callEdgeFunction('status');
    }
    return callExpressApi('/status');
  },

  async start(): Promise<OnboardingResponse> {
    if (isProduction) {
      return callEdgeFunction('start');
    }
    return callExpressApi('/start', { method: 'POST' });
  },

  async saveStep(step: string, data: Record<string, any>): Promise<OnboardingResponse> {
    if (isProduction) {
      return callEdgeFunction('step', { step, data });
    }
    return callExpressApi('/step', {
      method: 'POST',
      body: JSON.stringify({ step, data }),
    });
  },

  async complete(): Promise<OnboardingResponse> {
    if (isProduction) {
      return callEdgeFunction('complete');
    }
    return callExpressApi('/complete', { method: 'POST' });
  },
};
