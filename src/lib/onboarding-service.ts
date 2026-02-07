import { supabase } from './supabase';

// Always use the Express API since we deploy it to Vercel
// const isProduction = import.meta.env.PROD;

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
    throw new Error('No active session. Please log in again.');
  }
  return token;
}

// Call onboarding via Express API
async function callExpressApi(endpoint: string, options: RequestInit = {}): Promise<OnboardingResponse> {
  try {
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
      let errorMessage = `Request failed: ${response.status} ${response.statusText}`;
      try {
        const json = JSON.parse(errorBody);
        errorMessage = json.error || json.message || errorMessage;
      } catch (e) {
        // use raw text if json parse fails
        if (errorBody) errorMessage = errorBody;
      }
      throw new Error(errorMessage);
    }

    return response.json();
  } catch (error: any) {
    console.error('Onboarding API Error:', error);
    throw error;
  }
}

export const onboardingService = {
  async getStatus(): Promise<OnboardingResponse> {
    return callExpressApi('/status');
  },

  async start(): Promise<OnboardingResponse> {
    return callExpressApi('/start', { method: 'POST' });
  },

  async saveStep(step: string, data: Record<string, any>): Promise<OnboardingResponse> {
    return callExpressApi('/step', {
      method: 'POST',
      body: JSON.stringify({ step, data }),
    });
  },

  async complete(): Promise<OnboardingResponse> {
    return callExpressApi('/complete', { method: 'POST' });
  },
};
