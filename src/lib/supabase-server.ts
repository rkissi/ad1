import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'placeholder-key';

if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
  console.warn(
    '⚠️ Missing Supabase credentials in environment variables. Using placeholders.\n' +
    'Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file.\n' +
    'Real database operations will fail.'
  );
}

// Create a single supabase client for server-side operations
// Note: Requests should typically create a new client with the user's access token
// using createsClient(..., { global: { headers: { Authorization: ... } } })
// or we can use this client for admin/anon operations.
export const supabaseServer = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export const createServerClient = (accessToken?: string) => {
  if (!supabaseUrl || !supabaseAnonKey) {
     throw new Error('Server misconfiguration: Missing Supabase credentials');
  }

  return createClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
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
