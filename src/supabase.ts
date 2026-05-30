import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { RealtimeClientOptions } from '@supabase/realtime-js';
import WebSocket from 'ws';

/**
 * Get Supabase client with service role key
 * This bypasses Row Level Security (RLS) policies and allows full database access
 */
export function getSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.'
    );
  }

  const websocketTransport =
    WebSocket as unknown as RealtimeClientOptions['transport'];

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    realtime: {
      transport: websocketTransport,
    },
  });
}
