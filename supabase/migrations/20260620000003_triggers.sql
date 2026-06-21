-- AntHill — triggers (DB_SCHEMA_DESIGN.md §8)

-- ---------------------------------------------------------------------------
-- 8.1 updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger companies_touch        before update on public.companies        for each row execute function public.touch_updated_at();
create trigger users_touch            before update on public.users            for each row execute function public.touch_updated_at();
create trigger company_settings_touch before update on public.company_settings for each row execute function public.touch_updated_at();
create trigger packages_touch         before update on public.packages         for each row execute function public.touch_updated_at();
create trigger checklists_touch       before update on public.checklists       for each row execute function public.touch_updated_at();
create trigger events_touch           before update on public.events           for each row execute function public.touch_updated_at();
create trigger time_entries_touch     before update on public.time_entries     for each row execute function public.touch_updated_at();
create trigger user_preferences_touch before update on public.user_preferences for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 8.2 Auth -> profile sync
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public as $$
begin
  insert into public.users (id, first_name, last_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    new.email
  );
  insert into public.user_preferences (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Trigger-only function: never callable via the API. The trigger fires
-- regardless of caller EXECUTE grants; Supabase default-grants EXECUTE to
-- anon/authenticated, so revoke from them explicitly.
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8.3 Polymorphic attachment validation
-- ---------------------------------------------------------------------------
create or replace function public.validate_attachment_target()
returns trigger
language plpgsql
set search_path = public as $$
declare ok boolean;
begin
  if new.target_type = 'event' then
    select exists (select 1 from public.events
                   where id = new.target_id and company_id = new.company_id) into ok;
  elsif new.target_type = 'time_entry' then
    select exists (select 1 from public.time_entries
                   where id = new.target_id and company_id = new.company_id) into ok;
  elsif new.target_type = 'user_avatar' then
    select exists (select 1 from public.users where id = new.target_id) into ok;
  end if;

  if not ok then
    raise exception 'attachment target % % not found in company %',
      new.target_type, new.target_id, new.company_id;
  end if;
  return new;
end;
$$;

create trigger attachments_validate
  before insert on public.attachments
  for each row execute function public.validate_attachment_target();

-- ---------------------------------------------------------------------------
-- 8.4 Time-entry edits -> audit row
-- When a finalized entry's times or form responses change, snapshot the
-- previous state. Skipped when there is no authenticated actor (migrations).
-- ---------------------------------------------------------------------------
create or replace function public.log_time_entry_edit()
returns trigger
language plpgsql
set search_path = public as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if old.status not in ('active', 'paused')
     and (old.clock_in_at    is distinct from new.clock_in_at
       or old.clock_out_at   is distinct from new.clock_out_at
       or old.form_responses is distinct from new.form_responses
       or old.notes          is distinct from new.notes) then
    insert into public.time_entry_edits (
      time_entry_id, edited_by,
      previous_clock_in_at, previous_clock_out_at,
      previous_duration_seconds, previous_form_responses, previous_notes
    ) values (
      old.id, auth.uid(),
      old.clock_in_at, old.clock_out_at,
      old.duration_seconds, old.form_responses, old.notes
    );
  end if;
  return new;
end;
$$;

create trigger time_entries_audit
  before update on public.time_entries
  for each row execute function public.log_time_entry_edit();
