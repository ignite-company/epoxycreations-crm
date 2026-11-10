-- Eight-stage Epoxy Creations sales pipeline, applied November 10, 2026.
-- Existing booked/completed stage IDs remain unchanged.
alter table public.epoxy_jobs drop constraint epoxy_jobs_stage_check;
alter table public.epoxy_jobs add constraint epoxy_jobs_stage_check
 check (stage in ('imported','new','contacted','estimate_booked','estimate_sent','follow_up','booked','completed','lost'));
