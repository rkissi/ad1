-- Fraud Prevention Schema Extension
-- Supabase Migration

-- Fraud sessions table for rate limiting
CREATE TABLE IF NOT EXISTS public.fraud_sessions (
  session_id VARCHAR(255) PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id),
  click_count INTEGER DEFAULT 0,
  impression_count INTEGER DEFAULT 0,
  last_event_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blocked entities table
CREATE TABLE IF NOT EXISTS public.blocked_entities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(20) NOT NULL, -- 'ip', 'user', 'publisher', 'device'
  value VARCHAR(255) NOT NULL,
  reason TEXT,
  blocked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.fraud_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_entities ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Service role only for these internal tables)
CREATE POLICY "Service role only access fraud_sessions" ON public.fraud_sessions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role only access blocked_entities" ON public.blocked_entities
  FOR ALL USING (auth.role() = 'service_role');

-- Function to cleanup old fraud sessions
CREATE OR REPLACE FUNCTION public.cleanup_old_fraud_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM public.fraud_sessions
  WHERE last_event_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
