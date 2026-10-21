# Epoxy Creations | Command Center

A custom navy-and-white CRM for **Epoxy Creations LLC**, adapted from the Jamrock CRM structure and expanded around service territories and routing.

## What is built

- Overview with new leads, open estimates, booked jobs and completed revenue.
- Lead pipeline, contacts, estimates, jobs and tasks.
- Calendar with clickable days, job-site addresses and individual appointments.
- Dedicated **Service Areas** page for configurable regions. Define a name, comma-separated ZIP codes and optional starting address.
- Automatic ZIP matching of job addresses to service areas, plus manual per-job override.
- Daily stop planner filtered by date and territory. Reorder stops manually and save the order.
- Direct Google Maps links to check actual driving distance/time from a saved starting address to a job site.
- Multi-stop Google Maps directions with up to 9 addressable stops in the selected territory.
- CSV export, mobile-responsive design and Epoxy Creations branding derived from supplied logo.

### Routing limitations

The app organizes leads by ZIP and saved manual stop order. It **does not automatically optimize travel time**, calculate live mileage, or integrate a paid routing API. Google Maps links are used for actual traffic-aware route checking. ZIP groups are suggestions, not guaranteed nearby travel time.

## Current environment

The Vercel app works as a **sample-only preview** when no Supabase public browser configuration is provided. Preview data is kept in browser storage and is not shared across devices. **Do not enter genuine customer data in preview mode.**

For production, use a **dedicated Epoxy Creations Supabase project**, never the existing Jamrock or Ignite database. Run `supabase/schema.sql` in the new project after review, disable public signup, provision the owner in Supabase Auth, and configure these Vercel variables for the production environment:

- `VITE_SUPABASE_URL`: Epoxy project's HTTPS URL.
- `VITE_SUPABASE_ANON_KEY`: its public publishable key only.

**Never paste a Supabase secret key, service role key or database password into `VITE_` variables or the repo.**

After setting up Auth and the schema, verify login, permissions, create/edit lead, add/edit service area, ZIP auto-match, override area, schedule, reorder, refresh persistence, and test an unauthorized second user before introducing real client records.

## Design

Deep navy, white canvas, restrained cyan accent matching the client's logo. Original vector-derived logo and compact mark are stored in `public/`.

## Integrations not yet connected

- Google Calendar two-way sync (CRM calendar is local to app).
- Automated website lead webhook/inbox imports.
- Traffic-distance APIs and automatic multi-stop optimization.
- SMS, call tracking and other paid external services.

The planned multi-stop Google Maps feature opens externally, with the limitations Google Maps imposes on shared waypoint URLs.
