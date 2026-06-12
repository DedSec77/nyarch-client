-- ╔══════════════════════════════════════════════════════════════╗
-- ║  nyarch migration — admin roles, notifications, presence,     ║
-- ║  post editing, and the Flood (Offtop) category.               ║
-- ║  Run ONCE in the Supabase SQL Editor (after the earlier SQL). ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ════════════════════════════════════════════════════════════
--  1) ADMIN ROLES + ONLINE PRESENCE on profiles
-- ════════════════════════════════════════════════════════════
alter table public.profiles add column if not exists is_admin   boolean     not null default false;
alter table public.profiles add column if not exists last_seen  timestamptz;
-- presence: 'online' | 'offline' (user's chosen visibility while connected)
alter table public.profiles add column if not exists presence   text not null default 'offline'
  check (presence in ('online', 'offline'));

-- A user can update their own profile (already allowed), but must NOT be able to
-- grant themselves admin. Enforce with a trigger that blocks is_admin changes
-- unless performed by an existing admin.
create or replace function public.guard_admin_flag()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_admin is distinct from old.is_admin then
    if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
      -- silently keep the old value instead of erroring on normal profile saves
      new.is_admin := old.is_admin;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_admin_flag_trg on public.profiles;
create trigger guard_admin_flag_trg
  before update on public.profiles
  for each row execute function public.guard_admin_flag();

-- Heartbeat: a logged-in client calls this periodically to mark itself seen.
-- desired = 'online' | 'offline' (the user's chosen visibility).
create or replace function public.touch_presence(desired text default 'online')
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  update public.profiles
     set last_seen = now(),
         presence  = case when desired in ('online','offline') then desired else presence end
   where id = auth.uid();
end;
$$;

-- Mark the caller offline (called on sign-out / page unload).
create or replace function public.go_offline()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  update public.profiles set presence = 'offline', last_seen = now() where id = auth.uid();
end;
$$;

-- Effective online = chose 'online' AND seen within the last 70 seconds.
create or replace function public.is_user_online(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select presence = 'online' and last_seen > now() - interval '70 seconds'
       from public.profiles where id = p_id),
    false);
$$;

-- ════════════════════════════════════════════════════════════
--  2) ADMIN MODERATION: delete any post / comment
-- ════════════════════════════════════════════════════════════
drop policy if exists "admins delete any post" on public.posts;
create policy "admins delete any post" on public.posts
  for delete using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

drop policy if exists "admins update any post" on public.posts;
create policy "admins update any post" on public.posts
  for update using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

drop policy if exists "admins delete any comment" on public.comments;
create policy "admins delete any comment" on public.comments
  for delete using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- Admins may toggle another user's admin flag (used by the admin panel).
create or replace function public.set_admin(target uuid, value boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'not an admin';
  end if;
  update public.profiles set is_admin = value where id = target;
end;
$$;

-- ════════════════════════════════════════════════════════════
--  3) POST EDITING — track edits
-- ════════════════════════════════════════════════════════════
alter table public.posts    add column if not exists edited_at timestamptz;
alter table public.comments add column if not exists edited_at timestamptz;

-- ════════════════════════════════════════════════════════════
--  4) NOTIFICATIONS
--     kind: 'vote_post' | 'vote_comment' | 'comment' | 'reply'
--           | 'friend_request' | 'friend_accept' | 'unread_dm'
-- ════════════════════════════════════════════════════════════
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade, -- recipient
  actor_id    uuid references public.profiles(id) on delete cascade,          -- who triggered it
  kind        text not null,
  post_id     uuid references public.posts(id) on delete cascade,
  comment_id  uuid references public.comments(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications(user_id) where read = false;

alter table public.notifications enable row level security;
drop policy if exists "see own notifications" on public.notifications;
create policy "see own notifications" on public.notifications
  for select using (auth.uid() = user_id);
drop policy if exists "update own notifications" on public.notifications;
create policy "update own notifications" on public.notifications
  for update using (auth.uid() = user_id);
drop policy if exists "delete own notifications" on public.notifications;
create policy "delete own notifications" on public.notifications
  for delete using (auth.uid() = user_id);
-- inserts happen through SECURITY DEFINER triggers/functions only

-- helper: create a notification (skips self-notifications)
create or replace function public.notify(
  p_user uuid, p_actor uuid, p_kind text,
  p_post uuid default null, p_comment uuid default null, p_conv uuid default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is null or p_user = p_actor then return; end if;
  insert into public.notifications(user_id, actor_id, kind, post_id, comment_id, conversation_id)
  values (p_user, p_actor, p_kind, p_post, p_comment, p_conv);
end;
$$;

-- ── trigger: someone comments on your post / replies to your comment ──
create or replace function public.on_new_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  post_author uuid;
  parent_author uuid;
begin
  select author_id into post_author from public.posts where id = new.post_id;
  if new.parent_id is not null then
    select author_id into parent_author from public.comments where id = new.parent_id;
    perform public.notify(parent_author, new.author_id, 'reply', new.post_id, new.id, null);
  end if;
  -- notify post author (unless they're also the parent comment author already notified)
  if post_author is distinct from new.author_id
     and (parent_author is null or parent_author is distinct from post_author) then
    perform public.notify(post_author, new.author_id, 'comment', new.post_id, new.id, null);
  end if;
  return new;
end;
$$;

drop trigger if exists on_new_comment_trg on public.comments;
create trigger on_new_comment_trg
  after insert on public.comments
  for each row execute function public.on_new_comment();

-- ── trigger: someone upvotes your post / comment (only +1, only on insert/flip up) ──
create or replace function public.on_new_vote()
returns trigger language plpgsql security definer set search_path = public as $$
declare target_author uuid;
begin
  if new.value <> 1 then return new; end if;
  if new.post_id is not null then
    select author_id into target_author from public.posts where id = new.post_id;
    perform public.notify(target_author, new.user_id, 'vote_post', new.post_id, null, null);
  elsif new.comment_id is not null then
    select author_id into target_author from public.comments where id = new.comment_id;
    perform public.notify(target_author, new.user_id, 'vote_comment',
      (select post_id from public.comments where id = new.comment_id), new.comment_id, null);
  end if;
  return new;
end;
$$;

drop trigger if exists on_new_vote_trg on public.votes;
create trigger on_new_vote_trg
  after insert on public.votes
  for each row execute function public.on_new_vote();

-- ── trigger: friend request received / accepted ──
create or replace function public.on_friendship_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.notify(new.addressee_id, new.requester_id, 'friend_request', null, null, null);
  elsif tg_op = 'UPDATE' and new.status = 'accepted' and old.status = 'pending' then
    perform public.notify(new.requester_id, new.addressee_id, 'friend_accept', null, null, null);
  end if;
  return new;
end;
$$;

drop trigger if exists on_friendship_change_trg on public.friendships;
create trigger on_friendship_change_trg
  after insert or update on public.friendships
  for each row execute function public.on_friendship_change();

-- ── notifications feed for the current user (with actor profile joined) ──
create or replace function public.get_notifications(p_limit int default 50)
returns table (
  id uuid, kind text, read boolean, created_at timestamptz,
  post_id uuid, comment_id uuid, conversation_id uuid,
  actor_id uuid, actor_username text, actor_display_name text, actor_avatar_url text,
  post_title text
)
language sql stable security definer set search_path = public as $$
  select n.id, n.kind, n.read, n.created_at,
         n.post_id, n.comment_id, n.conversation_id,
         n.actor_id, a.username, a.display_name, a.avatar_url,
         p.title
  from public.notifications n
  left join public.profiles a on a.id = n.actor_id
  left join public.posts p on p.id = n.post_id
  where n.user_id = auth.uid()
  order by n.created_at desc
  limit p_limit;
$$;

create or replace function public.unread_notification_count()
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.notifications where user_id = auth.uid() and read = false;
$$;

create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_ids is null then
    update public.notifications set read = true where user_id = auth.uid() and read = false;
  else
    update public.notifications set read = true where user_id = auth.uid() and id = any(p_ids);
  end if;
end;
$$;

-- ── digest: if someone sent you DMs you haven't read in 6h, drop ONE notification ──
-- (Run periodically via a Supabase scheduled function / cron, or call manually.)
create or replace function public.digest_unread_dms()
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select c.id as conv_id,
           case when c.user_a = m.last_sender then c.user_b else c.user_a end as recipient,
           m.last_sender
    from public.conversations c
    join lateral (
      select sender_id as last_sender, max(created_at) as last_at
      from public.messages where conversation_id = c.id
      group by sender_id order by max(created_at) desc limit 1
    ) m on true
    where m.last_at < now() - interval '6 hours'
  loop
    -- only if there isn't already an unread_dm notification in the last 6h
    if not exists (
      select 1 from public.notifications
      where user_id = r.recipient and kind = 'unread_dm'
        and conversation_id = r.conv_id and created_at > now() - interval '6 hours'
    ) then
      perform public.notify(r.recipient, r.last_sender, 'unread_dm', null, null, r.conv_id);
    end if;
  end loop;
end;
$$;

alter publication supabase_realtime add table public.notifications;

-- Optional: schedule the DM digest every 30 min with pg_cron (if available).
-- Supabase: enable the "pg_cron" extension under Database -> Extensions first.
-- Then uncomment:
--   select cron.schedule('nyarch-dm-digest', '*/30 * * * *', $$select public.digest_unread_dms();$$);

-- ════════════════════════════════════════════════════════════
--  5) FLOOD (Offtop) CATEGORY
-- ════════════════════════════════════════════════════════════
insert into public.categories (slug, name, description, icon, color) values
  ('flood', 'Flood (Offtop)', 'Anything goes — offtopic, memes, random chatter', 'wave', '#ff2fb9')
on conflict (slug) do nothing;

-- ════════════════════════════════════════════════════════════
--  6) RPC UPDATES — surface is_admin / edited_at / presence
-- ════════════════════════════════════════════════════════════

-- get_posts: add author_is_admin + edited_at
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
    case when p_sort = 'hot' then
      coalesce((select sum(v.value) from votes v where v.post_id = p.id), 0)
      - (extract(epoch from (now() - p.created_at)) / 45000.0)
    end desc nulls last,
    p.created_at desc
  limit p_limit offset p_offset;
$$;

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

-- get_comments: add author_is_admin + edited_at
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
