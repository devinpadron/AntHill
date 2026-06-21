-- AntHill — realtime (DB_SCHEMA_DESIGN.md §9)
-- Publish only the tables the UI subscribes to. Combined with RLS + a
-- server-side company_id filter, clients never receive rows they can't read.
-- Reads on everything else are on-demand.

-- Supabase ships the supabase_realtime publication; create it if absent so the
-- migration is also runnable on a bare Postgres.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.event_workers;
alter publication supabase_realtime add table public.event_checklist_item_states;
alter publication supabase_realtime add table public.time_entries;
alter publication supabase_realtime add table public.company_members;
alter publication supabase_realtime add table public.company_settings;
