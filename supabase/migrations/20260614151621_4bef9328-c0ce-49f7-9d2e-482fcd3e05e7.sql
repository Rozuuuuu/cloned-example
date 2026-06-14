
-- Workspace-wide connector findings (Wiz, etc.)
CREATE TABLE public.connector_findings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source text NOT NULL,
  external_id text NOT NULL,
  severity text NOT NULL,
  affected_field text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  title text NOT NULL,
  description text,
  storage_object_path text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);

GRANT SELECT ON public.connector_findings TO authenticated;
GRANT ALL  ON public.connector_findings TO service_role;

ALTER TABLE public.connector_findings ENABLE ROW LEVEL SECURITY;

-- Signed-in users may read all workspace-level connector findings; only service_role writes.
CREATE POLICY "Connector findings select authenticated"
  ON public.connector_findings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.touch_connector_findings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.touch_connector_findings_updated_at() FROM anon, authenticated, PUBLIC;

CREATE TRIGGER trg_connector_findings_updated_at
  BEFORE UPDATE ON public.connector_findings
  FOR EACH ROW EXECUTE FUNCTION public.touch_connector_findings_updated_at();

-- Re-run scan_findings seed for a single scan (owner-only).
CREATE OR REPLACE FUNCTION public.rescan_scan_findings(_scan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.scans%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.scans WHERE id = _scan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'scan not found';
  END IF;
  IF s.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  DELETE FROM public.scan_findings WHERE scan_id = _scan_id;

  INSERT INTO public.scan_findings (scan_id, severity, affected_field, status, title, description)
  VALUES
    (s.id,
     CASE WHEN s.grade ILIKE 'A%' THEN 'low' ELSE 'high' END,
     'fiber_type', 'open',
     'Fiber composition review',
     'Auto-generated check on declared fiber composition vs. grade.'),
    (s.id,
     CASE WHEN s.image_path IS NULL THEN 'medium' ELSE 'low' END,
     'image_path',
     CASE WHEN s.image_path IS NULL THEN 'open' ELSE 'resolved' END,
     'Scan image evidence',
     'Verifies a captured scan image is attached for traceability.');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rescan_scan_findings(uuid) FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.rescan_scan_findings(uuid) TO authenticated;
