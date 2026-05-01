
-- Replace overly broad SELECT with owner-only listing
drop policy if exists "Scan images public read" on storage.objects;
create policy "Users list own scan images"
on storage.objects for select
using (bucket_id = 'scan-images' and auth.uid()::text = (storage.foldername(name))[1]);

-- Revoke execute on the trigger function so only the trigger uses it
revoke execute on function public.handle_new_user() from public, anon, authenticated;
