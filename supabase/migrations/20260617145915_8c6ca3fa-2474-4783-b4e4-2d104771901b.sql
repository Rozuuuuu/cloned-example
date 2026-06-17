DROP POLICY IF EXISTS "Connector findings select authenticated" ON public.connector_findings;
CREATE POLICY "Connector findings select non-anonymous"
  ON public.connector_findings FOR SELECT
  TO authenticated
  USING (COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);