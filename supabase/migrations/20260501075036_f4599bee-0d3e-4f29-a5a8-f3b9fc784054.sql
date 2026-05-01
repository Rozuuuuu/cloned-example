
-- Profile preferences (hulas_level)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  hulas_level text not null default 'pawisin',
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "Profiles select own" on public.profiles for select using (auth.uid() = id);
create policy "Profiles insert own" on public.profiles for insert with check (auth.uid() = id);
create policy "Profiles update own" on public.profiles for update using (auth.uid() = id);

-- Scans
create table public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fabric_name text not null,
  grade text not null,
  fiber_type text not null,
  image_path text,
  scanned_at timestamptz not null default now()
);
alter table public.scans enable row level security;
create policy "Scans select own" on public.scans for select using (auth.uid() = user_id);
create policy "Scans insert own" on public.scans for insert with check (auth.uid() = user_id);
create policy "Scans delete own" on public.scans for delete using (auth.uid() = user_id);
create index scans_user_scanned_idx on public.scans(user_id, scanned_at desc);

-- Auto create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Storage bucket for scan images
insert into storage.buckets (id, name, public) values ('scan-images', 'scan-images', true) on conflict do nothing;

create policy "Scan images public read"
on storage.objects for select
using (bucket_id = 'scan-images');

create policy "Users upload own scan images"
on storage.objects for insert
with check (bucket_id = 'scan-images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users delete own scan images"
on storage.objects for delete
using (bucket_id = 'scan-images' and auth.uid()::text = (storage.foldername(name))[1]);
