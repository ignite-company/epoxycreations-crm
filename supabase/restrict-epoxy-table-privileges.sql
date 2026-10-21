-- Do not allow authenticated users to bypass RLS through TRUNCATE or other table-level privileges.
revoke all on table
 public.epoxy_workspaces,
 public.epoxy_workspace_members,
 public.epoxy_contacts,
 public.epoxy_jobs,
 public.epoxy_tasks,
 public.epoxy_service_areas,
 public.epoxy_estimate_routes
from authenticated;
grant select on public.epoxy_workspaces to authenticated;
grant update (name,review_link) on public.epoxy_workspaces to authenticated;
grant select on public.epoxy_workspace_members to authenticated;
grant select,insert,update,delete on
 public.epoxy_contacts,public.epoxy_jobs,public.epoxy_tasks,
 public.epoxy_service_areas,public.epoxy_estimate_routes
to authenticated;
revoke all on table
 public.epoxy_workspaces,public.epoxy_workspace_members,
 public.epoxy_contacts,public.epoxy_jobs,public.epoxy_tasks,
 public.epoxy_service_areas,public.epoxy_estimate_routes
from anon;
