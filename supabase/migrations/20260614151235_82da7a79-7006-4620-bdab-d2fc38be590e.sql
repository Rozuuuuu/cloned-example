
-- Revoke EXECUTE on trigger-only SECURITY DEFINER functions from API roles
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.seed_scan_findings() FROM anon, authenticated, PUBLIC;

-- log_audit_event is intended to be callable by signed-in users only
REVOKE EXECUTE ON FUNCTION public.log_audit_event(text, text, text, boolean, jsonb) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, text, boolean, jsonb) TO authenticated;

-- Add UPDATE policy to scan-images storage bucket mirroring INSERT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Scan images update own'
  ) THEN
    CREATE POLICY "Scan images update own"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'scan-images'
        AND (auth.uid())::text = (storage.foldername(name))[1]
      )
      WITH CHECK (
        bucket_id = 'scan-images'
        AND (auth.uid())::text = (storage.foldername(name))[1]
      );
  END IF;
END$$;
