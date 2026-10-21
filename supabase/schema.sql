-- Epoxy Creations Command Center, v1.
-- Run ONLY in a newly provisioned, dedicated Epoxy Creations Supabase project.
-- Run in a NEW Supabase project dedicated to Epoxy Creations, not Ignite's client hub.
-- Supabase Auth sign-ups should be invite/admin-only before handling customer data.
create extension if not exists pgcrypto;

create table if not exists public.workspaces (
 id uuid primary key default gen_random_uuid(),
 name text not null default 'Epoxy Creations Command Center',
 review_link text,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now()
);
create table if not exists public.workspace_members (
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null default 'owner' check(role in ('owner','admin','staff')),
 created_at timestamptz not null default now(),
 primary key(workspace_id,user_id)
);
create index if not exists workspace_members_user_idx on public.workspace_members(user_id);

create table if not exists public.contacts (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 name text not null check(char_length(trim(name))>0),
 phone text not null default '',
 email text not null default '',
 address text not null default '',
 notes text not null default '',
 created_at timestamptz not null default now(),
 unique(id,workspace_id)
);
create index if not exists contacts_workspace_created_idx on public.contacts(workspace_id,created_at desc);

create table if not exists public.jobs (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 contact_id uuid not null,
 service text not null default 'Epoxy flooring',
 source text not null default 'Other',
 pickup_address text not null default '',
 route_zone text not null default '',
 visit_order integer check(visit_order > 0),
 stage text not null default 'new' check(stage in ('imported','new','contacted','estimate_sent','booked','completed','lost')),
 estimate_amount numeric(12,2) check(estimate_amount>=0),
 final_amount numeric(12,2) check(final_amount>=0),
 scheduled_at timestamptz,
 notes text not null default '',
 lead_details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 constraint job_contact_same_workspace foreign key(contact_id,workspace_id) references public.contacts(id,workspace_id) on delete cascade,
 unique(id,workspace_id)
);
create index if not exists jobs_workspace_created_idx on public.jobs(workspace_id,created_at desc);
create index if not exists jobs_workspace_schedule_idx on public.jobs(workspace_id,scheduled_at);

create table if not exists public.service_areas (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 name text not null check(char_length(trim(name))>0),
 zip_codes text not null default '',
 base_address text not null default '',
 created_at timestamptz not null default now(),
 unique(id,workspace_id)
);
create index if not exists service_areas_workspace_idx on public.service_areas(workspace_id,created_at desc);

create table if not exists public.tasks (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 contact_id uuid,
 job_id uuid,
 title text not null check(char_length(trim(title))>0),
 category text not null default 'follow_up' check (category in ('follow_up','no_answer','unresponsive','waiting_on_customer')),
 notes text not null default '',
 due_at timestamptz not null default now(),
 completed boolean not null default false,
 created_at timestamptz not null default now(),
 constraint task_contact_same_workspace foreign key(contact_id,workspace_id) references public.contacts(id,workspace_id) on delete set null (contact_id),
 constraint task_job_same_workspace foreign key(job_id,workspace_id) references public.jobs(id,workspace_id) on delete set null (job_id)
);
create index if not exists tasks_workspace_due_idx on public.tasks(workspace_id,completed,due_at);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.contacts enable row level security;
alter table public.jobs enable row level security;
alter table public.service_areas enable row level security;
alter table public.tasks enable row level security;

-- Explicit API privileges. New-table auto exposure can safely remain disabled.
-- RLS continues to restrict every authenticated user to their own workspace.
grant usage on schema public to authenticated;
grant select on public.workspaces to authenticated;
grant update (name, review_link) on public.workspaces to authenticated;
grant select on public.workspace_members to authenticated;
grant select, insert, update, delete on public.contacts to authenticated;
grant select, insert, update, delete on public.jobs to authenticated;
grant select, insert, update, delete on public.service_areas to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;

-- Membership policy is deliberately non-recursive.
create policy "Members read own memberships" on public.workspace_members
 for select to authenticated using (user_id=auth.uid());

create policy "Workspace members read workspace" on public.workspaces
 for select to authenticated using (
  exists(select 1 from public.workspace_members m where m.workspace_id=id and m.user_id=auth.uid())
 );
create policy "Owners edit workspace" on public.workspaces
 for update to authenticated using (
  exists(select 1 from public.workspace_members m where m.workspace_id=id and m.user_id=auth.uid() and m.role='owner')
 ) with check (
  exists(select 1 from public.workspace_members m where m.workspace_id=id and m.user_id=auth.uid() and m.role='owner')
 );

create policy "Members manage contacts" on public.contacts for all to authenticated
 using (exists(select 1 from public.workspace_members m where m.workspace_id=contacts.workspace_id and m.user_id=auth.uid()))
 with check (exists(select 1 from public.workspace_members m where m.workspace_id=contacts.workspace_id and m.user_id=auth.uid()));

create policy "Members manage jobs" on public.jobs for all to authenticated
 using (exists(select 1 from public.workspace_members m where m.workspace_id=jobs.workspace_id and m.user_id=auth.uid()))
 with check (exists(select 1 from public.workspace_members m where m.workspace_id=jobs.workspace_id and m.user_id=auth.uid()));

create policy "Members manage service areas" on public.service_areas for all to authenticated
 using (exists(select 1 from public.workspace_members m where m.workspace_id=service_areas.workspace_id and m.user_id=(select auth.uid())))
 with check (exists(select 1 from public.workspace_members m where m.workspace_id=service_areas.workspace_id and m.user_id=(select auth.uid())));

create policy "Members manage tasks" on public.tasks for all to authenticated
 using (exists(select 1 from public.workspace_members m where m.workspace_id=tasks.workspace_id and m.user_id=auth.uid()))
 with check (exists(select 1 from public.workspace_members m where m.workspace_id=tasks.workspace_id and m.user_id=auth.uid()));

-- Creates a private workspace for a NEW provisioned authentication user.
-- For teammates, grant membership in the owner's existing workspace instead of creating independent workspaces.
create or replace function public.epoxy_create_workspace_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare new_workspace uuid;
begin
 insert into public.workspaces(name,created_by) values ('Epoxy Creations Command Center',new.id) returning id into new_workspace;
 insert into public.workspace_members(workspace_id,user_id,role) values(new_workspace,new.id,'owner');
 return new;
end;
$$;

drop trigger if exists epoxy_on_auth_user_created on auth.users;
create trigger epoxy_on_auth_user_created
after insert on auth.users
for each row execute procedure public.epoxy_create_workspace_for_auth_user();

-- Privacy note: no automatic imports or real client data are created in this migration.
