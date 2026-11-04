-- Catalog changes are restricted to Supabase Auth users with app_metadata.role = 'admin'.
grant insert, update, delete on public.classes, public.events to authenticated;

create policy "Admins manage classes" on public.classes
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admins manage events" on public.events
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
