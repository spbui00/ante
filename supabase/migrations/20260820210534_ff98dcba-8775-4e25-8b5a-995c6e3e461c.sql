ALTER TABLE public.visit
  ADD COLUMN IF NOT EXISTS arrived_at timestamptz,
  ADD COLUMN IF NOT EXISTS taken_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE TABLE IF NOT EXISTS public.queue_priority (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id uuid NOT NULL REFERENCES public.practitioner(id) ON DELETE CASCADE,
  visit_id uuid NOT NULL REFERENCES public.visit(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  pinned boolean NOT NULL DEFAULT false,
  rationale text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (practitioner_id, visit_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.queue_priority TO authenticated;
GRANT ALL ON public.queue_priority TO service_role;

ALTER TABLE public.queue_priority ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "queue readable by owning practitioner" ON public.queue_priority;
CREATE POLICY "queue readable by owning practitioner" ON public.queue_priority
  FOR SELECT TO authenticated
  USING (practitioner_id = public.current_practitioner_id());

DROP POLICY IF EXISTS "queue writable by owning practitioner" ON public.queue_priority;
CREATE POLICY "queue writable by owning practitioner" ON public.queue_priority
  FOR INSERT TO authenticated
  WITH CHECK (practitioner_id = public.current_practitioner_id());

DROP POLICY IF EXISTS "queue updatable by owning practitioner" ON public.queue_priority;
CREATE POLICY "queue updatable by owning practitioner" ON public.queue_priority
  FOR UPDATE TO authenticated
  USING (practitioner_id = public.current_practitioner_id())
  WITH CHECK (practitioner_id = public.current_practitioner_id());

DROP POLICY IF EXISTS "queue deletable by owning practitioner" ON public.queue_priority;
CREATE POLICY "queue deletable by owning practitioner" ON public.queue_priority
  FOR DELETE TO authenticated
  USING (practitioner_id = public.current_practitioner_id());