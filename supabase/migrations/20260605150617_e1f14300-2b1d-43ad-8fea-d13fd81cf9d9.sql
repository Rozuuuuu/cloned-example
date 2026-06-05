
-- =========== scan_findings ===========
CREATE TABLE public.scan_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  severity text NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  affected_field text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
  title text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scan_findings TO authenticated;
GRANT ALL ON public.scan_findings TO service_role;

ALTER TABLE public.scan_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Findings select own"
  ON public.scan_findings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.scans s WHERE s.id = scan_id AND s.user_id = auth.uid()));

CREATE POLICY "Findings insert own"
  ON public.scan_findings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.scans s WHERE s.id = scan_id AND s.user_id = auth.uid()));

CREATE POLICY "Findings update own"
  ON public.scan_findings FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.scans s WHERE s.id = scan_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.scans s WHERE s.id = scan_id AND s.user_id = auth.uid()));

CREATE POLICY "Findings delete own"
  ON public.scan_findings FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.scans s WHERE s.id = scan_id AND s.user_id = auth.uid()));

CREATE INDEX scan_findings_scan_id_idx ON public.scan_findings(scan_id);

-- Auto-seed sample findings when a scan is inserted (best-effort demo data).
CREATE OR REPLACE FUNCTION public.seed_scan_findings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.scan_findings (scan_id, severity, affected_field, status, title, description)
  VALUES
    (NEW.id,
     CASE WHEN NEW.grade ILIKE 'A%' THEN 'low' ELSE 'high' END,
     'fiber_type',
     'open',
     'Fiber composition review',
     'Auto-generated check on declared fiber composition vs. grade.'),
    (NEW.id,
     CASE WHEN NEW.image_path IS NULL THEN 'medium' ELSE 'low' END,
     'image_path',
     CASE WHEN NEW.image_path IS NULL THEN 'open' ELSE 'resolved' END,
     'Scan image evidence',
     'Verifies a captured scan image is attached for traceability.');
  RETURN NEW;
END;
$$;

CREATE TRIGGER scans_seed_findings
  AFTER INSERT ON public.scans
  FOR EACH ROW EXECUTE FUNCTION public.seed_scan_findings();

-- =========== audit_log ===========
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  success boolean NOT NULL DEFAULT true,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Users may only see their own audit rows.
CREATE POLICY "Audit select own"
  ON public.audit_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users may only insert rows attributed to themselves (or anonymous denials with null user_id are inserted via the RPC below).
CREATE POLICY "Audit insert own"
  ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX audit_log_user_id_created_idx ON public.audit_log(user_id, created_at DESC);

-- RPC that always succeeds (even for unauthenticated callers) so client-side denial events can be recorded.
CREATE OR REPLACE FUNCTION public.log_audit_event(
  _action text,
  _resource_type text,
  _resource_id text DEFAULT NULL,
  _success boolean DEFAULT true,
  _metadata jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_log (user_id, action, resource_type, resource_id, success, metadata)
  VALUES (auth.uid(), _action, _resource_type, _resource_id, COALESCE(_success, true), _metadata);
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, text, boolean, jsonb) TO authenticated, anon;
