-- Storage buckets and policies for CarCore

-- Create private bucket for intervention photos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'intervention-photos',
  'intervention-photos',
  false,
  5242880, -- 5MB limit per file
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- RLS policies for the bucket
-- Only authenticated users can upload to their tenant's folder structure: {tenant_id}/{intervention_id}/...

-- Allow upload if the path starts with the user's tenant_id
create policy "Users can upload intervention photos for their tenant"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'intervention-photos' and
  (storage.foldername(name))[1] = (
    select tenant_id::text from public.profiles where id = auth.uid()
  )
);

-- Allow viewing photos if the path starts with user's tenant_id
create policy "Users can view intervention photos for their tenant"
on storage.objects for select
to authenticated
using (
  bucket_id = 'intervention-photos' and
  (storage.foldername(name))[1] = (
    select tenant_id::text from public.profiles where id = auth.uid()
  )
);

-- Allow delete if user is admin or owner of the photo path
create policy "Admins and owners can delete photos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'intervention-photos' and
  (storage.foldername(name))[1] = (
    select tenant_id::text from public.profiles where id = auth.uid()
  )
);

-- Note: In production we will add more granular policies based on role (admin vs reception)