-- ╔══════════════════════════════════════════════════════════════╗
-- ║  nyarch migration — Web Push (server-sent push notifications)  ║
-- ║                                                                ║
-- ║  Delivers notifications even when the site/app is CLOSED, via  ║
-- ║  a Service Worker push subscription + a Supabase Edge Function ║
-- ║  ("send-push") that signs and sends the Web Push message.      ║
-- ║                                                                ║
-- ║  Run AFTER 2026_admin_notifications_presence.sql.              ║
-- ║                                                                ║
-- ║  PREREQUISITES (configure once in the Supabase dashboard):     ║
-- ║   1. Database -> Extensions -> enable "pg_net" and "pg_cron".  ║
-- ║   2. Deploy the Edge Function:  supabase functions deploy      ║
-- ║         send-push --no-verify-jwt                              ║
-- ║   3. Set the two GUCs below to your project values (replace):  ║
-- ║        select set_config('app.edge_url',                       ║
-- ║          'https://<PROJECT-REF>.functions.supabase.co', false);║
-- ║        select set_config('app.service_role_key',               ║
-- ║          '<YOUR-SERVICE-ROLE-KEY>', false);                    ║
-- ║      (or set them permanently with ALTER DATABASE ... SET ...) ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ════════════════════════════════════════════════════════════
--  1) PUSH SUBSCRIPTION STORAGE
-- ════════════════════════════════════════════════════════════
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,          -- client public key (base64url)
  auth        text not null,          -- client auth secret (base64url)
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists push_subs_user_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "see own push subs" on public.push_subscriptions;
create policy "see own push subs" on public.push_subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "insert own push subs" on public.push_subscriptions;
create policy "insert own push subs" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);

drop policy if exists "delete own push subs" on public.push_subscriptions;
create policy "delete own push subs" on public.push_subscriptions
  for delete using (auth.uid() = user_id);

-- Upsert a subscription for the current user (called from the browser after
-- the Service Worker registers a PushManager subscription).
create or replace function public.save_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.push_subscriptions(user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, p_user_agent)
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh  = excluded.p256dh,
        auth    = excluded.auth,
        user_agent = excluded.user_agent;
end;
$$;

create or replace function public.delete_push_subscription(p_endpoint text)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.push_subscriptions
   where endpoint = p_endpoint and (user_id = auth.uid() or auth.uid() is null);
end;
$$;

-- ════════════════════════════════════════════════════════════
--  2) SERVER-SIDE SENDER GLUE
--     A DB trigger calls the "send-push" Edge Function over HTTP
--     (via pg_net) whenever a notification row is inserted. The
--     Edge Function looks up the recipient's subscriptions and
--     sends the encrypted Web Push.
-- ════════════════════════════════════════════════════════════

-- Helper: POST {user_id, title, body, url, tag} to the Edge Function.
create or replace function public.send_web_push(
  p_user uuid, p_title text, p_body text, p_url text default '/', p_tag text default null
)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_url  text := current_setting('app.edge_url', true);
  v_key  text := current_setting('app.service_role_key', true);
begin
  -- If the project hasn't been configured yet, do nothing (no error).
  if v_url is null or v_key is null then return; end if;

  perform net.http_post(
    url     := v_url || '/send-push',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || v_key
               ),
    body    := jsonb_build_object(
                 'user_id', p_user,
                 'title',   p_title,
                 'body',    p_body,
                 'url',     p_url,
                 'tag',     p_tag
               )
  );
exception when others then
  -- pg_net not installed / misconfigured — never block the originating write.
  return;
end;
$$;

-- Map a notification row to a human-readable push payload, then send it.
create or replace function public.on_notification_push()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  actor   record;
  who     text;
  title   text := 'nyarch';
  body    text;
  url     text := '/notifications';
begin
  select username, display_name into actor from public.profiles where id = new.actor_id;
  who := coalesce(actor.display_name, '@' || actor.username, 'someone');

  body := case new.kind
    when 'vote_post'      then who || ' upvoted your post'
    when 'vote_comment'   then who || ' upvoted your comment'
    when 'comment'        then who || ' commented on your post'
    when 'reply'          then who || ' replied to your comment'
    when 'friend_request' then who || ' sent you a friend request'
    when 'friend_accept'  then who || ' accepted your friend request'
    when 'unread_dm'      then 'You have unread messages from ' || who
    else 'New activity'
  end;

  if new.post_id is not null then
    url := '/post/' || new.post_id;
  elsif new.conversation_id is not null then
    url := '/messages/' || new.conversation_id;
  end if;

  perform public.send_web_push(new.user_id, title, body, url, new.kind);
  return new;
end;
$$;

drop trigger if exists on_notification_push_trg on public.notifications;
create trigger on_notification_push_trg
  after insert on public.notifications
  for each row execute function public.on_notification_push();

-- Direct-message pushes don't create a notifications row (only the 6h digest
-- does), so send those straight from the messages insert.
create or replace function public.on_message_push()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  conv      record;
  recipient uuid;
  sender    record;
  who       text;
  preview   text;
begin
  select user_a, user_b into conv from public.conversations where id = new.conversation_id;
  if conv is null then return new; end if;

  recipient := case when conv.user_a = new.sender_id then conv.user_b else conv.user_a end;
  if recipient is null or recipient = new.sender_id then return new; end if;

  select username, display_name into sender from public.profiles where id = new.sender_id;
  who := coalesce(sender.display_name, '@' || sender.username, 'someone');

  preview := case
    when new.body is not null and length(new.body) > 0 then new.body
    when new.is_gif then 'sent a GIF'
    when new.image_url is not null then 'sent a photo'
    else 'new message'
  end;

  perform public.send_web_push(
    recipient,
    'nyarch — ' || who,
    preview,
    '/messages/' || new.conversation_id,
    'dm:' || new.conversation_id
  );
  return new;
end;
$$;

drop trigger if exists on_message_push_trg on public.messages;
create trigger on_message_push_trg
  after insert on public.messages
  for each row execute function public.on_message_push();

-- ════════════════════════════════════════════════════════════
--  3) SCHEDULE THE 6-HOUR DM DIGEST (server-side, no client needed)
--     Requires the pg_cron extension (enable it in the dashboard).
-- ════════════════════════════════════════════════════════════
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- (re)create the schedule idempotently
    perform cron.unschedule('nyarch-dm-digest')
      where exists (select 1 from cron.job where jobname = 'nyarch-dm-digest');
    perform cron.schedule('nyarch-dm-digest', '*/30 * * * *',
      $cron$ select public.digest_unread_dms(); $cron$);
  end if;
exception when others then
  -- pg_cron not available on this plan — the client-side fallback still runs.
  null;
end;
$$;
