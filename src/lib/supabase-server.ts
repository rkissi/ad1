import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables for server. Onboarding routes may fail.');
}

// Create a single supabase client for server-side operations
// Note: Requests should typically create a new client with the user's access token
// using createsClient(..., { global: { headers: { Authorization: ... } } })
// or we can use this client for admin/anon operations.
export const supabaseServer = createClient<Database>(
  supabaseUrl || '',
  supabaseAnonKey || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export const createServerClient = (accessToken?: string) => {
  return createClient<Database>(
    supabaseUrl || '',
    supabaseAnonKey || '',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: accessToken ? {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      } : undefined,
    }
  );
};
