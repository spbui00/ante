CREATE TABLE public.analytics_session (
  owner_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  narrative TEXT,
  context_id TEXT,
  window_days INTEGER NOT NULL DEFAULT 60,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analytics_session TO authenticated;
GRANT ALL ON public.analytics_session TO service_role;
ALTER TABLE public.analytics_session ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage their own analytics session" ON public.analytics_session FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());