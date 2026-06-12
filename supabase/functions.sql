-- ╔══════════════════════════════════════════════════════════════╗
-- ║  nyarch — RPC helpers for feed queries                        ║
-- ║  Run AFTER schema.sql. These power the Reddit-style feed.     ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Feed of posts with author, category, score, comment count and the
-- caller's own vote. Supports sorting by 'hot' | 'new' | 'top'.
drop function if exists public.get_posts(text, text, int, int);
create or replace function public.get_posts(
  p_category text default null,
  p_sort     text default 'hot',
  p_limit    int  default 30,
  p_offset   int  default 0
)
returns table (
  id uuid, author_id uuid, category_id uuid, title text, body text,
  image_url text, created_at timestamptz, edited_at timestamptz,
  author_username text, author_display_name text, author_avatar_url text, author_is_admin boolean,
  category_slug text, category_name text, category_icon text, category_color text,
  score bigint, comment_count bigint, my_vote int
)
language sql stable security definer set search_path = public as $$
  select
    p.id, p.author_id, p.category_id, p.title, p.body, p.image_url, p.created_at, p.edited_at,
    pr.username, pr.display_name, pr.avatar_url, pr.is_admin,
    c.slug, c.name, c.icon, c.color,
    coalesce((select sum(v.value) from votes v where v.post_id = p.id), 0) as score,
    (select count(*) from comments cm where cm.post_id = p.id) as comment_count,
    coalesce((select v.value from votes v where v.post_id = p.id and v.user_id = auth.uid()), 0) as my_vote
  from posts p
  join profiles pr on pr.id = p.author_id
  join categories c on c.id = p.category_id
  where p_category is null or c.slug = p_category
  order by
    case when p_sort = 'new' then extract(epoch from p.created_at) end desc nulls last,
    case when p_sort = 'top' then coalesce((select sum(v.value) from votes v where v.post_id = p.id), 0) end desc nulls last,
    -- hot = score / age decay
    case when p_sort = 'hot' then
      coalesce((select sum(v.value) from votes v where v.post_id = p.id), 0)
      - (extract(epoch from (now() - p.created_at)) / 45000.0)
    end desc nulls last,
    p.created_at desc
  limit p_limit offset p_offset;
$$;

-- Single post detail
drop function if exists public.get_post(uuid);
create or replace function public.get_post(p_id uuid)
returns table (
  id uuid, author_id uuid, category_id uuid, title text, body text,
  image_url text, created_at timestamptz, edited_at timestamptz,
  author_username text, author_display_name text, author_avatar_url text, author_is_admin boolean,
  category_slug text, category_name text, category_icon text, category_color text,
  score bigint, comment_count bigint, my_vote int
)
language sql stable security definer set search_path = public as $$
  select
    p.id, p.author_id, p.category_id, p.title, p.body, p.image_url, p.created_at, p.edited_at,
    pr.username, pr.display_name, pr.avatar_url, pr.is_admin,
    c.slug, c.name, c.icon, c.color,
    coalesce((select sum(v.value) from votes v where v.post_id = p.id), 0),
    (select count(*) from comments cm where cm.post_id = p.id),
    coalesce((select v.value from votes v where v.post_id = p.id and v.user_id = auth.uid()), 0)
  from posts p
  join profiles pr on pr.id = p.author_id
  join categories c on c.id = p.category_id
  where p.id = p_id;
$$;

-- Comments for a post with author + score + my vote
drop function if exists public.get_comments(uuid);
create or replace function public.get_comments(p_post uuid)
returns table (
  id uuid, post_id uuid, author_id uuid, parent_id uuid, body text, image_url text,
  created_at timestamptz, edited_at timestamptz,
  author_username text, author_display_name text, author_avatar_url text, author_is_admin boolean,
  score bigint, my_vote int
)
language sql stable security definer set search_path = public as $$
  select
    cm.id, cm.post_id, cm.author_id, cm.parent_id, cm.body, cm.image_url, cm.created_at, cm.edited_at,
    pr.username, pr.display_name, pr.avatar_url, pr.is_admin,
    coalesce((select sum(v.value) from votes v where v.comment_id = cm.id), 0),
    coalesce((select v.value from votes v where v.comment_id = cm.id and v.user_id = auth.uid()), 0)
  from comments cm
  join profiles pr on pr.id = cm.author_id
  where cm.post_id = p_post
  order by cm.created_at asc;
$$;

-- Posts authored by a given username (for profile pages)
drop function if exists public.get_user_posts(text);
create or replace function public.get_user_posts(p_username text)
returns table (
  id uuid, author_id uuid, category_id uuid, title text, body text,
  image_url text, created_at timestamptz, edited_at timestamptz,
  author_username text, author_display_name text, author_avatar_url text, author_is_admin boolean,
  category_slug text, category_name text, category_icon text, category_color text,
  score bigint, comment_count bigint, my_vote int
)
language sql stable security definer set search_path = public as $$
  select
    p.id, p.author_id, p.category_id, p.title, p.body, p.image_url, p.created_at, p.edited_at,
    pr.username, pr.display_name, pr.avatar_url, pr.is_admin,
    c.slug, c.name, c.icon, c.color,
    coalesce((select sum(v.value) from votes v where v.post_id = p.id), 0),
    (select count(*) from comments cm where cm.post_id = p.id),
    coalesce((select v.value from votes v where v.post_id = p.id and v.user_id = auth.uid()), 0)
  from posts p
  join profiles pr on pr.id = p.author_id
  join categories c on c.id = p.category_id
  where pr.username = p_username
  order by p.created_at desc;
$$;

-- Toggle a vote (insert / flip / remove). target_type = 'post' | 'comment'
create or replace function public.cast_vote(
  target_type text,
  target_id uuid,
  v int
)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not authenticated'; end if;
  if v not in (-1, 1) then raise exception 'invalid vote'; end if;

  if target_type = 'post' then
    if exists (select 1 from votes where user_id = me and post_id = target_id and value = v) then
      delete from votes where user_id = me and post_id = target_id; -- toggle off
    else
      insert into votes(user_id, post_id, value) values (me, target_id, v)
      on conflict (user_id, post_id) where post_id is not null
      do update set value = excluded.value;
    end if;
  elsif target_type = 'comment' then
    if exists (select 1 from votes where user_id = me and comment_id = target_id and value = v) then
      delete from votes where user_id = me and comment_id = target_id;
    else
      insert into votes(user_id, comment_id, value) values (me, target_id, v)
      on conflict (user_id, comment_id) where comment_id is not null
      do update set value = excluded.value;
    end if;
  else
    raise exception 'invalid target_type';
  end if;
end;
$$;

-- Category list with post counts
create or replace function public.get_categories()
returns table (
  id uuid, slug text, name text, description text, icon text, color text, post_count bigint
)
language sql stable security definer set search_path = public as $$
  select c.id, c.slug, c.name, c.description, c.icon, c.color,
    (select count(*) from posts p where p.category_id = c.id) as post_count
  from categories c
  order by c.name;
$$;
