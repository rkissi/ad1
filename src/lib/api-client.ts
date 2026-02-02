import { supabase } from './supabase';

// Use relative path for API calls to support Tempo/Vite integrated environment
const API_BASE_URL = '/api';

export async function authenticatedFetch(endpoint: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  if (!token) {
    // throw new Error('No active session');
    console.warn('Making request without auth token');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
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
