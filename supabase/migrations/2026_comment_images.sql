-- ╔══════════════════════════════════════════════════════════════╗
-- ║  nyarch migration — add image support to comments             ║
-- ║  Run this ONCE in the Supabase SQL Editor.                     ║
-- ║  (Dashboard → SQL Editor → paste → Run)                        ║
-- ╚══════════════════════════════════════════════════════════════╝

-- 1) add image column + make body optional ----------------------------------
alter table public.comments add column if not exists image_url text;
alter table public.comments alter column body drop not null;

-- drop every existing CHECK constraint on comments (names are auto-generated,
-- so we discover them dynamically instead of guessing)
do $$
declare r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.comments'::regclass and contype = 'c'
  loop
    execute format('alter table public.comments drop constraint %I', r.conname);
  end loop;
end$$;

-- re-add: keep the length cap, and require text and/or an image
alter table public.comments
  add constraint comments_body_len check (body is null or char_length(body) <= 5000);
alter table public.comments
  add constraint comments_has_content
  check (nullif(btrim(body), '') is not null or image_url is not null);

-- 2) update get_comments to return image_url --------------------------------
-- the return type changes (adds image_url), so the old function must be dropped
drop function if exists public.get_comments(uuid);
create or replace function public.get_comments(p_post uuid)
returns table (
  id uuid, post_id uuid, author_id uuid, parent_id uuid, body text, image_url text, created_at timestamptz,
  author_username text, author_display_name text, author_avatar_url text,
  score bigint, my_vote int
)
language sql stable security definer set search_path = public as $$
  select
    cm.id, cm.post_id, cm.author_id, cm.parent_id, cm.body, cm.image_url, cm.created_at,
    pr.username, pr.display_name, pr.avatar_url,
    coalesce((select sum(v.value) from votes v where v.comment_id = cm.id), 0),
    coalesce((select v.value from votes v where v.comment_id = cm.id and v.user_id = auth.uid()), 0)
  from comments cm
  join profiles pr on pr.id = cm.author_id
  where cm.post_id = p_post
  order by cm.created_at asc;
$$;

-- 3) comment-images storage bucket + policies -------------------------------
insert into storage.buckets (id, name, public)
values ('comment-images', 'comment-images', true)
on conflict (id) do nothing;

drop policy if exists "public read nyarch buckets" on storage.objects;
create policy "public read nyarch buckets"
on storage.objects for select
using (bucket_id in ('avatars','banners','post-images','message-images','comment-images'));

drop policy if exists "auth upload own folder" on storage.objects;
create policy "auth upload own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id in ('avatars','banners','post-images','message-images','comment-images')
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- 4) English category descriptions + slug-based icon keys (UI maps key->SVG) -
update public.categories set description = 'Languages, algorithms, patterns, code review', icon = 'code'     where slug = 'programming';
update public.categories set description = 'Distros, kernel, configs, dotfiles',           icon = 'terminal' where slug = 'linux';
update public.categories set description = 'Microcontrollers, circuits, soldering, PCB',   icon = 'chip'     where slug = 'electronics';
update public.categories set description = 'CI/CD, containers, k8s, infrastructure',        icon = 'gear'     where slug = 'devops';
update public.categories set description = 'Pentest, cryptography, OSINT, CTF',            icon = 'shield'   where slug = 'security';
update public.categories set description = 'Hardware, builds, overclocking, repair',        icon = 'wrench'   where slug = 'hardware';
update public.categories set description = 'Frontend, backend, API, frameworks',           icon = 'globe'    where slug = 'web';
update public.categories set description = 'Neural nets, LLMs, datasets, inference',        icon = 'cpu'      where slug = 'ai-ml';
