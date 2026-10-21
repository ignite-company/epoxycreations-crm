-- Estimate route plans are private to Epoxy workspace members.
create table if not exists public.epoxy_estimate_routes (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.epoxy_workspaces(id) on delete cascade,
 plan_date date not null,
 start_address text not null default '',
 return_to_start boolean not null default true,
 stop_ids uuid[] not null default '{}'::uuid[],
 total_distance_meters integer check (total_distance_meters >= 0),
 total_duration_seconds integer check (total_duration_seconds >= 0),
 optimized_at timestamptz,
 updated_at timestamptz not null default now(),
 unique (workspace_id,plan_date)
);
create index if not exists epoxy_estimate_routes_workspace_idx
 on public.epoxy_estimate_routes (workspace_id,plan_date desc);
alter table public.epoxy_estimate_routes enable row level security;
grant select, insert, update, delete on public.epoxy_estimate_routes to authenticated;
revoke all on public.epoxy_estimate_routes from anon;
create policy "Epoxy members manage estimate routes" on public.epoxy_estimate_routes
 for all to authenticated
 using (exists(select 1 from public.epoxy_workspace_members m
    where m.workspace_id=epoxy_estimate_routes.workspace_id and m.user_id=(select auth.uid())))
 with check (exists(select 1 from public.epoxy_workspace_members m
    where m.workspace_id=epoxy_estimate_routes.workspace_id and m.user_id=(select auth.uid())));
