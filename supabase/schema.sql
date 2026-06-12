-- ╔══════════════════════════════════════════════════════════════╗
-- ║  nyarch — database schema (PostgreSQL / Supabase)              ║
-- ║  Run this in the Supabase SQL Editor on a fresh project.      ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ── Extensions ───────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ════════════════════════════════════════════════════════════
--  PROFILES
-- ════════════════════════════════════════════════════════════
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text unique not null check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null default 'anon',
  avatar_url   text,
  banner_url   text,
  bio          text check (char_length(bio) <= 500),
  is_admin     boolean not null default false,
  last_seen    timestamptz,
  presence     text not null default 'offline' check (presence in ('online','offline')),
  created_at   timestamptz not null default now()
);

-- in case profiles already existed
alter table public.profiles add column if not exists is_admin  boolean not null default false;
alter table public.profiles add column if not exists last_seen timestamptz;
alter table public.profiles add column if not exists presence text not null default 'offline'
  check (presence in ('online','offline'));

alter table public.profiles enable row level security;

drop policy if exists "profiles are public" on public.profiles;
create policy "profiles are public" on public.profiles
  for select using (true);
drop policy if exists "users insert own profile" on public.profiles;
create policy "users insert own profile" on public.profiles
  for insert with check (auth.uid() = id);
drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Auto-create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base_username text;
  final_username text;
  suffix int := 0;
begin
  base_username := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9_]', '', 'g'));
  if char_length(base_username) < 3 then
    base_username := 'user' || base_username;
  end if;
  base_username := left(base_username, 16);
  final_username := base_username;
  while exists (select 1 from public.profiles where username = final_username) loop
    suffix := suffix + 1;
    final_username := left(base_username, 14) || suffix::text;
  end loop;

  insert into public.profiles (id, username, display_name)
  values (new.id, final_username, coalesce(new.raw_user_meta_data->>'display_name', final_username));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Prevent users from granting themselves admin via a normal profile update.
create or replace function public.guard_admin_flag()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_admin is distinct from old.is_admin then
    if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
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

-- ── Presence (online/offline) ──
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

create or replace function public.go_offline()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  update public.profiles set presence = 'offline', last_seen = now() where id = auth.uid();
end;
$$;

create or replace function public.is_user_online(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select presence = 'online' and last_seen > now() - interval '70 seconds'
       from public.profiles where id = p_id),
    false);
$$;

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
--  CATEGORIES
-- ════════════════════════════════════════════════════════════
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  description text,
  icon        text not null default '#',
  color       text not null default '#00ff9c',
  created_at  timestamptz not null default now()
);

alter table public.categories enable row level security;
drop policy if exists "categories are public" on public.categories;
create policy "categories are public" on public.categories for select using (true);

-- ════════════════════════════════════════════════════════════
--  POSTS
-- ════════════════════════════════════════════════════════════
create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references public.profiles(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 300),
  body        text not null default '',
  image_url   text,
  edited_at   timestamptz,
  created_at  timestamptz not null default now()
);
alter table public.posts add column if not exists edited_at timestamptz;

alter table public.posts enable row level security;
drop policy if exists "posts are public" on public.posts;
create policy "posts are public" on public.posts for select using (true);
drop policy if exists "auth users create posts" on public.posts;
create policy "auth users create posts" on public.posts
  for insert with check (auth.uid() = author_id);
drop policy if exists "authors update own posts" on public.posts;
create policy "authors update own posts" on public.posts
  for update using (auth.uid() = author_id);
drop policy if exists "authors delete own posts" on public.posts;
create policy "authors delete own posts" on public.posts
  for delete using (auth.uid() = author_id);
drop policy if exists "admins delete any post" on public.posts;
create policy "admins delete any post" on public.posts
  for delete using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
drop policy if exists "admins update any post" on public.posts;
create policy "admins update any post" on public.posts
  for update using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create index if not exists posts_category_idx on public.posts(category_id);
create index if not exists posts_author_idx on public.posts(author_id);
create index if not exists posts_created_idx on public.posts(created_at desc);

-- ════════════════════════════════════════════════════════════
--  COMMENTS
-- ════════════════════════════════════════════════════════════
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  parent_id  uuid references public.comments(id) on delete cascade,
  body       text check (char_length(body) <= 5000),
  image_url  text,
  edited_at  timestamptz,
  created_at timestamptz not null default now(),
  -- a comment must have text and/or an image
  check (coalesce(nullif(btrim(body), ''), null) is not null or image_url is not null)
);

alter table public.comments enable row level security;
drop policy if exists "comments are public" on public.comments;
create policy "comments are public" on public.comments for select using (true);
drop policy if exists "auth users create comments" on public.comments;
create policy "auth users create comments" on public.comments
  for insert with check (auth.uid() = author_id);
drop policy if exists "authors update own comments" on public.comments;
create policy "authors update own comments" on public.comments
  for update using (auth.uid() = author_id);
drop policy if exists "authors delete own comments" on public.comments;
create policy "authors delete own comments" on public.comments
  for delete using (auth.uid() = author_id);
drop policy if exists "admins delete any comment" on public.comments;
create policy "admins delete any comment" on public.comments
  for delete using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
alter table public.comments add column if not exists edited_at timestamptz;

create index if not exists comments_post_idx on public.comments(post_id);

-- ════════════════════════════════════════════════════════════
--  VOTES  (reddit-style up/down on posts & comments)
-- ════════════════════════════════════════════════════════════
create table if not exists public.votes (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  post_id    uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  value      smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  -- exactly one target
  check ((post_id is not null) <> (comment_id is not null))
);

create unique index if not exists votes_post_uniq
  on public.votes(user_id, post_id) where post_id is not null;
create unique index if not exists votes_comment_uniq
  on public.votes(user_id, comment_id) where comment_id is not null;

alter table public.votes enable row level security;
drop policy if exists "votes are public" on public.votes;
create policy "votes are public" on public.votes for select using (true);
drop policy if exists "users manage own votes" on public.votes;
create policy "users manage own votes" on public.votes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════
--  FRIENDSHIPS
-- ════════════════════════════════════════════════════════════
create table if not exists public.friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending','accepted')),
  created_at   timestamptz not null default now(),
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

alter table public.friendships enable row level security;
drop policy if exists "see own friendships" on public.friendships;
create policy "see own friendships" on public.friendships
  for select using (auth.uid() = requester_id or auth.uid() = addressee_id);
drop policy if exists "send friend requests" on public.friendships;
create policy "send friend requests" on public.friendships
  for insert with check (auth.uid() = requester_id);
drop policy if exists "respond to requests" on public.friendships;
create policy "respond to requests" on public.friendships
  for update using (auth.uid() = addressee_id or auth.uid() = requester_id);
drop policy if exists "remove friendship" on public.friendships;
create policy "remove friendship" on public.friendships
  for delete using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- ════════════════════════════════════════════════════════════
--  CONVERSATIONS + MESSAGES (DMs)
-- ════════════════════════════════════════════════════════════
create table if not exists public.conversations (
  id         uuid primary key default gen_random_uuid(),
  user_a     uuid not null references public.profiles(id) on delete cascade,
  user_b     uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- normalize so (a,b) and (b,a) collapse to one row
  unique (user_a, user_b),
  check (user_a < user_b)
);

alter table public.conversations enable row level security;
drop policy if exists "see own conversations" on public.conversations;
create policy "see own conversations" on public.conversations
  for select using (auth.uid() = user_a or auth.uid() = user_b);
drop policy if exists "create conversations" on public.conversations;
create policy "create conversations" on public.conversations
  for insert with check (auth.uid() = user_a or auth.uid() = user_b);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  body            text,
  image_url       text,
  is_gif          boolean not null default false,
  created_at      timestamptz not null default now(),
  check (body is not null or image_url is not null)
);

alter table public.messages enable row level security;
drop policy if exists "see messages in own conversations" on public.messages;
create policy "see messages in own conversations" on public.messages
  for select using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.user_a = auth.uid() or c.user_b = auth.uid())
    )
  );
drop policy if exists "send messages in own conversations" on public.messages;
create policy "send messages in own conversations" on public.messages
  for insert with check (
    auth.uid() = sender_id and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.user_a = auth.uid() or c.user_b = auth.uid())
    )
  );

create index if not exists messages_conv_idx on public.messages(conversation_id, created_at);

-- ════════════════════════════════════════════════════════════
--  HELPER: a conversation getter that normalizes participant order
-- ════════════════════════════════════════════════════════════
create or replace function public.get_or_create_conversation(other_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  lo uuid;
  hi uuid;
  conv_id uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if me = other_id then raise exception 'cannot DM yourself'; end if;
  if me < other_id then lo := me; hi := other_id; else lo := other_id; hi := me; end if;

  select id into conv_id from public.conversations where user_a = lo and user_b = hi;
  if conv_id is null then
    insert into public.conversations(user_a, user_b) values (lo, hi) returning id into conv_id;
  end if;
  return conv_id;
end;
$$;

-- Enable realtime for messages
alter publication supabase_realtime add table public.messages;

-- ════════════════════════════════════════════════════════════
--  NOTIFICATIONS
-- ════════════════════════════════════════════════════════════
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  actor_id    uuid references public.profiles(id) on delete cascade,
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
create policy "see own notifications" on public.notifications for select using (auth.uid() = user_id);
drop policy if exists "update own notifications" on public.notifications;
create policy "update own notifications" on public.notifications for update using (auth.uid() = user_id);
drop policy if exists "delete own notifications" on public.notifications;
create policy "delete own notifications" on public.notifications for delete using (auth.uid() = user_id);

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

create or replace function public.on_new_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare post_author uuid; parent_author uuid;
begin
  select author_id into post_author from public.posts where id = new.post_id;
  if new.parent_id is not null then
    select author_id into parent_author from public.comments where id = new.parent_id;
    perform public.notify(parent_author, new.author_id, 'reply', new.post_id, new.id, null);
  end if;
  if post_author is distinct from new.author_id
     and (parent_author is null or parent_author is distinct from post_author) then
    perform public.notify(post_author, new.author_id, 'comment', new.post_id, new.id, null);
  end if;
  return new;
end;
$$;
drop trigger if exists on_new_comment_trg on public.comments;
create trigger on_new_comment_trg after insert on public.comments
  for each row execute function public.on_new_comment();

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
create trigger on_new_vote_trg after insert on public.votes
  for each row execute function public.on_new_vote();

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
create trigger on_friendship_change_trg after insert or update on public.friendships
  for each row execute function public.on_friendship_change();

create or replace function public.get_notifications(p_limit int default 50)
returns table (
  id uuid, kind text, read boolean, created_at timestamptz,
  post_id uuid, comment_id uuid, conversation_id uuid,
  actor_id uuid, actor_username text, actor_display_name text, actor_avatar_url text,
  post_title text
)
language sql stable security definer set search_path = public as $$
  select n.id, n.kind, n.read, n.created_at, n.post_id, n.comment_id, n.conversation_id,
         n.actor_id, a.username, a.display_name, a.avatar_url, p.title
  from public.notifications n
  left join public.profiles a on a.id = n.actor_id
  left join public.posts p on p.id = n.post_id
  where n.user_id = auth.uid()
  order by n.created_at desc limit p_limit;
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

alter publication supabase_realtime add table public.notifications;

-- ════════════════════════════════════════════════════════════
--  SEED CATEGORIES
-- ════════════════════════════════════════════════════════════
-- icon column stores a slug-based key; the UI maps it to an SVG icon
insert into public.categories (slug, name, description, icon, color) values
  ('programming', 'Programming',  'Languages, algorithms, patterns, code review',  'code',     '#00ff9c'),
  ('linux',       'Linux',        'Distros, kernel, configs, dotfiles',            'terminal', '#ffb000'),
  ('electronics', 'Electronics',  'Microcontrollers, circuits, soldering, PCB',    'chip',     '#22d3ee'),
  ('devops',      'DevOps',       'CI/CD, containers, k8s, infrastructure',        'gear',     '#ff2fb9'),
  ('security',    'Security',     'Pentest, cryptography, OSINT, CTF',             'shield',   '#ff3b5c'),
  ('hardware',    'Hardware',     'Hardware, builds, overclocking, repair',        'wrench',   '#9a9aa3'),
  ('web',         'Web Dev',      'Frontend, backend, API, frameworks',            'globe',    '#00ff9c'),
  ('ai-ml',       'AI / ML',      'Neural nets, LLMs, datasets, inference',        'cpu',      '#22d3ee'),
  ('flood',       'Flood (Offtop)','Anything goes — offtopic, memes, random chatter','wave',     '#ff2fb9')
on conflict (slug) do nothing;
