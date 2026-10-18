-- Deleting an account must not be blocked by records the person created in a company that stays.
-- Documents and invites keep their history with the creator cleared.
alter table public.documents alter column created_by drop not null;
alter table public.documents drop constraint if exists documents_created_by_fkey;
alter table public.documents add constraint documents_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;

alter table public.invites alter column created_by drop not null;
alter table public.invites drop constraint if exists invites_created_by_fkey;
alter table public.invites add constraint invites_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;
alter table public.invites drop constraint if exists invites_used_by_fkey;
alter table public.invites add constraint invites_used_by_fkey foreign key (used_by) references auth.users(id) on delete set null;
