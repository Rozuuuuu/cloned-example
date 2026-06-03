
-- Restrict storage policies on scan-images to authenticated only
DROP POLICY IF EXISTS "Users list own scan images" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own scan images" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own scan images" ON storage.objects;

CREATE POLICY "Users list own scan images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'scan-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own scan images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'scan-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own scan images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'scan-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add missing UPDATE policy on scans
CREATE POLICY "Scans update own"
ON public.scans FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
