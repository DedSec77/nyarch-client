-- ╔══════════════════════════════════════════════════════════════╗
-- ║  nyarch migration — DM read state & unread counters            ║
-- ║                                                                ║
-- ║  Adds per-user "last read" timestamps to conversations so the  ║
-- ║  UI can show an unread badge (the "1" next to the messages     ║
-- ║  icon and next to the sender in the conversation list).        ║
-- ║                                                                ║
-- ║  Safe to run multiple times. Run AFTER schema.sql.             ║
-- ╚══════════════════════════════════════════════════════════════╝

-- 1) Track when each participant last read the conversation.
alter table public.conversations
  add column if not exists last_read_a timestamptz not null default now();
alter table public.conversations
  add column if not exists last_read_b timestamptz not null default now();

-- 2) Mark the current user's side of a conversation as read (call when the
--    chat is opened / a new message arrives while it's open).
create or replace function public.mark_conversation_read(p_conv uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  update public.conversations
     set last_read_a = case when user_a = auth.uid() then now() else last_read_a end,
         last_read_b = case when user_b = auth.uid() then now() else last_read_b end
   where id = p_conv
     and (user_a = auth.uid() or user_b = auth.uid());
end;
$$;

-- 3) Unread count per conversation for the current user (messages from the
--    OTHER person newer than my last_read). Returns one row per conversation
--    that has at least one unread message.
create or replace function public.dm_unread_by_conversation()
returns table(conversation_id uuid, unread bigint)
language sql stable security definer set search_path = public as $$
  select m.conversation_id, count(*) as unread
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  where (c.user_a = auth.uid() or c.user_b = auth.uid())
    and m.sender_id <> auth.uid()
    and m.created_at > case
          when c.user_a = auth.uid() then c.last_read_a
          else c.last_read_b
        end
  group by m.conversation_id;
$$;

-- 4) Total unread DM messages for the current user (for the navbar badge).
create or replace function public.dm_unread_total()
returns bigint
language sql stable security definer set search_path = public as $$
  select coalesce(sum(unread), 0)::bigint
  from public.dm_unread_by_conversation();
$$;

-- 5) Make sure conversations is in the realtime publication so the unread
--    counters update live when last_read changes elsewhere. (messages is
--    already published in schema.sql.)
do $$
begin
  begin
    alter publication supabase_realtime add table public.conversations;
  exception when duplicate_object then
    null; -- already added
  end;
end $$;
