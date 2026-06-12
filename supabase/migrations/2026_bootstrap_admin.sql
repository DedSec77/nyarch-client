-- ╔══════════════════════════════════════════════════════════════╗
-- ║  nyarch migration — bootstrap the FIRST admin                  ║
-- ║                                                                ║
-- ║  The guard_admin_flag trigger blocks anyone from setting       ║
-- ║  is_admin unless they are ALREADY an admin — which makes the   ║
-- ║  very first admin impossible to set with a plain UPDATE.       ║
-- ║                                                                ║
-- ║  This function bypasses the guard, but ONLY while there are    ║
-- ║  zero admins, so it is safe to leave in place.                 ║
-- ║                                                                ║
-- ║  USAGE (run once in the SQL editor, your nick WITHOUT @):      ║
-- ║      select public.bootstrap_first_admin('your_nick');         ║
-- ╚══════════════════════════════════════════════════════════════╝

create or replace function public.bootstrap_first_admin(p_username text)
returns text
language plpgsql
security definer
set search_path = public as $$
declare
  v_count int;
  v_id    uuid;
begin
  select count(*) into v_count from public.profiles where is_admin;
  if v_count > 0 then
    return 'refused: an admin already exists — use set_admin() as that admin';
  end if;

  select id into v_id from public.profiles where username = p_username;
  if v_id is null then
    return 'not found: no profile with username ' || p_username;
  end if;

  -- Temporarily disable the guard trigger to seed the first admin.
  alter table public.profiles disable trigger guard_admin_flag_trg;
  update public.profiles set is_admin = true where id = v_id;
  alter table public.profiles enable trigger guard_admin_flag_trg;

  return 'ok: ' || p_username || ' is now an admin';
end;
$$;

-- ── Convenience: bootstrap the first admin by EMAIL ──────────────
-- The username is auto-generated from the email at signup, so you may not know
-- it. This variant looks the profile up via auth.users by email, which you DO
-- know. Same safety rule: refuses once any admin exists.
-- USAGE:  select public.bootstrap_first_admin_email('you@example.com');
create or replace function public.bootstrap_first_admin_email(p_email text)
returns text
language plpgsql
security definer
set search_path = public as $$
declare
  v_count int;
  v_id    uuid;
begin
  select count(*) into v_count from public.profiles where is_admin;
  if v_count > 0 then
    return 'refused: an admin already exists — use set_admin() as that admin';
  end if;

  select id into v_id from auth.users where lower(email) = lower(p_email);
  if v_id is null then
    return 'not found: no user with email ' || p_email;
  end if;

  alter table public.profiles disable trigger guard_admin_flag_trg;
  update public.profiles set is_admin = true where id = v_id;
  alter table public.profiles enable trigger guard_admin_flag_trg;

  return 'ok: ' || p_email || ' is now an admin';
end;
$$;
