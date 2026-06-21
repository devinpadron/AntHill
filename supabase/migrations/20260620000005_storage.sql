-- AntHill — storage buckets + RLS (DB_SCHEMA_DESIGN.md §6.3)
-- Buckets are private; clients request signed URLs. Access is gated by the
-- first path segment:
--   event-attachments      {company_id}/{event_id}/{filename}
--   time-entry-attachments  {company_id}/{time_entry_id}/{filename}
--   avatars                 {user_id}/{filename}

insert into storage.buckets (id, name, public)
values
  ('event-attachments', 'event-attachments', false),
  ('time-entry-attachments', 'time-entry-attachments', false),
  ('avatars', 'avatars', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- event-attachments — members read; admins write/delete (company_id = folder 1)
-- ---------------------------------------------------------------------------
create policy event_attachments_read on storage.objects
  for select using (
    bucket_id = 'event-attachments'
    and public.is_company_member((storage.foldername(name))[1]::uuid)
  );
create policy event_attachments_write on storage.objects
  for insert with check (
    bucket_id = 'event-attachments'
    and public.is_company_admin((storage.foldername(name))[1]::uuid)
  );
create policy event_attachments_delete on storage.objects
  for delete using (
    bucket_id = 'event-attachments'
    and public.is_company_admin((storage.foldername(name))[1]::uuid)
  );

-- ---------------------------------------------------------------------------
-- time-entry-attachments — members read; members write/delete their company's
-- (time-entry ownership is enforced at the row layer)
-- ---------------------------------------------------------------------------
create policy time_entry_attachments_read on storage.objects
  for select using (
    bucket_id = 'time-entry-attachments'
    and public.is_company_member((storage.foldername(name))[1]::uuid)
  );
create policy time_entry_attachments_write on storage.objects
  for insert with check (
    bucket_id = 'time-entry-attachments'
    and public.is_company_member((storage.foldername(name))[1]::uuid)
  );
create policy time_entry_attachments_delete on storage.objects
  for delete using (
    bucket_id = 'time-entry-attachments'
    and public.is_company_member((storage.foldername(name))[1]::uuid)
  );

-- ---------------------------------------------------------------------------
-- avatars — any authenticated user can read (teammate avatars); owner writes
-- their own folder (user_id = folder 1)
-- ---------------------------------------------------------------------------
create policy avatars_read on storage.objects
  for select using (
    bucket_id = 'avatars' and auth.uid() is not null
  );
create policy avatars_write_own on storage.objects
  for insert with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy avatars_update_own on storage.objects
  for update using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy avatars_delete_own on storage.objects
  for delete using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );
