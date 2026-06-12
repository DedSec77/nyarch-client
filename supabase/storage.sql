-- ╔══════════════════════════════════════════════════════════════╗
-- ║  nyarch — storage buckets + policies                          ║
-- ║  Run AFTER schema.sql in the Supabase SQL Editor.             ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Create public buckets (idempotent)
insert into storage.buckets (id, name, public)
values
  ('avatars',        'avatars',        true),
  ('banners',        'banners',        true),
  ('post-images',    'post-images',    true),
  ('message-images', 'message-images', true),
  ('comment-images', 'comment-images', true)
on conflict (id) do nothing;

-- Anyone can read public bucket objects
create policy "public read nyarch buckets"
on storage.objects for select
using (bucket_id in ('avatars','banners','post-images','message-images','comment-images'));

-- Authenticated users can upload to their own folder (first path segment = uid)
create policy "auth upload own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id in ('avatars','banners','post-images','message-images','comment-images')
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "auth update own files"
on storage.objects for update to authenticated
using (
  bucket_id in ('avatars','banners','post-images','message-images','comment-images')
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "auth delete own files"
on storage.objects for delete to authenticated
using (
  bucket_id in ('avatars','banners','post-images','message-images','comment-images')
  and (storage.foldername(name))[1] = auth.uid()::text
);
