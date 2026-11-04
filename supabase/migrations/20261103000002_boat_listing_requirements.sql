-- Boat listing fields requested in the owner listing flow.
alter table public.boats
  add column if not exists condition text not null default 'Good',
  add column if not exists cancellation_policy text not null default 'Contact the owner to discuss cancellation terms.';

alter table public.boats drop constraint if exists boats_condition_check;
alter table public.boats add constraint boats_condition_check
  check (condition in ('Like new', 'Excellent', 'Very good', 'Good', 'Fair', 'Needs repair'));

-- Listing photos are public because they are displayed on public boat adverts.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('boat-photos', 'boat-photos', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update set public = true, file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

drop policy if exists "Public can view listing photos" on storage.objects;
create policy "Public can view listing photos" on storage.objects
  for select using (bucket_id = 'boat-photos');

drop policy if exists "Owners upload listing photos" on storage.objects;
create policy "Owners upload listing photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'boat-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Owners update listing photos" on storage.objects;
create policy "Owners update listing photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'boat-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'boat-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Owners delete listing photos" on storage.objects;
create policy "Owners delete listing photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'boat-photos' and (storage.foldername(name))[1] = auth.uid()::text);
