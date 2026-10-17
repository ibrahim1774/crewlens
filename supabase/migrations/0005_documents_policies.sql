-- Tighten documents: any member reads; only the creator inserts as themselves; the creator or a
-- company owner updates or deletes. Storage objects are write-once (no update policy), one per version.

drop policy if exists documents_rw on public.documents;
create policy documents_select on public.documents for select to authenticated
  using (company_id in (select my_company_ids()));
create policy documents_insert on public.documents for insert to authenticated
  with check (company_id in (select my_company_ids()) and created_by = auth.uid());
create policy documents_update on public.documents for update to authenticated
  using (company_id in (select my_company_ids()) and (created_by = auth.uid() or exists (
    select 1 from public.members m where m.company_id = documents.company_id and m.user_id = auth.uid() and m.role = 'owner')))
  with check (company_id in (select my_company_ids()) and (created_by = auth.uid() or exists (
    select 1 from public.members m where m.company_id = documents.company_id and m.user_id = auth.uid() and m.role = 'owner')));
create policy documents_delete on public.documents for delete to authenticated
  using (company_id in (select my_company_ids()) and (created_by = auth.uid() or exists (
    select 1 from public.members m where m.company_id = documents.company_id and m.user_id = auth.uid() and m.role = 'owner')));

drop policy if exists documents_media_rw on storage.objects;
create policy documents_media_select on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1]::uuid in (select my_company_ids()));
create policy documents_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1]::uuid in (select my_company_ids()));
create policy documents_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1]::uuid in (select my_company_ids()));
