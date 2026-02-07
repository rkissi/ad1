import { supabase } from './supabase';

// Use relative path for API calls to support Tempo/Vite integrated environment
const API_BASE_URL = '/api';

export async function authenticatedFetch(endpoint: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    throw new Error('No active session');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Ensure endpoint starts with / if not present
  const safeEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  // Construct URL
  // If we are in local dev (Vite), /api proxies to localhost:3001
  // If we are in production (Vercel), /api rewrites to serverless function
  const url = `${API_BASE_URL}${safeEndpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`API request failed: ${url}`, {
      status: response.status,
      body: errorBody
    });

    let errorMessage = response.statusText;
    try {
        const json = JSON.parse(errorBody);
        errorMessage = json.error || json.message || errorMessage;
    } catch (e) {}
    throw new Error(errorMessage);
  }

  return response.json();
}
