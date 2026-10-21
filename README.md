# Epoxy Creations | Command Center

Custom navy-and-white CRM for Epoxy Creations LLC, modeled on Jamrock's workflows with added service territory planning.

## October 21, 2026 demo

- **Live environment:** https://epoxycreations-crm.vercel.app
- **Storage:** Existing Ignite Supabase project, `ujvuqbgheewbyvfusqvz`, within Ignite's Supabase organization.
- **Data isolation:** Dedicated `public.epoxy_*` tables, separate from Ignite's existing CRM/finance tables and from Jamrock.
- **Authorized accounts:** The existing verified Ignite owner and Epoxy client portal accounts are added to the Epoxy workspace. Supabase Auth login is required. Row Level Security limits reads/writes to Epoxy workspace members; anonymous access is revoked.
- **Imported content:** 10 genuine Epoxy Creations Facebook ad inquiries, received Oct 8 to Oct 21, 2026. Saved directly into private database as `Imported · review`, with original submission timestamps, names, contact information, ZIP codes, requested flooring type/finish/size/timeline and Gmail source message references. **No demo data is committed to the public Git repository.**
- **No fictional sample leads or zones.** Leads have ZIPs only where full street addresses were not provided. CRM never invents street addresses, quotes, contact status or bookings.
- **Not automatic email sync:** Additional leads require an authorized import through the Settings CSV workflow.

## Features

- Overview with new and imported inquiries, open estimates, booked jobs, completed revenue
- Stage-based pipeline, contacts, jobs, quotes, reminders and calendar
- Custom service areas matched to lead ZIPs, with editable per-job assignment
- Manual date/territory planning, stop order and Google Maps multi-stop route links
- Editable notes, project details, lead intake date and original source email

## Running locally

```bash
npm install
npm run dev
```

Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (a public publishable key) for authenticated storage. These variables are set only for the Vercel production environment. Do not expose service-role keys or database passwords to the browser. Deploy using Vite with build `npm run build` and output `dist`.

## Access and limitations

Use your **existing Ignite portal account** on the CRM login screen. If the account password is unavailable, it must be recovered through Supabase's supported password recovery flow. Existing Ignite portal authentication users are reused, but CRM records are separate.

This is a private operational demo, not a fully tested production system. Google Calendar two-way sync, automatic distance/time optimization, and inbox-based new-lead synchronization are not connected yet. Google Maps opens externally for live driving estimates.

## Estimate route planner (October 21, 2026)

Use **Estimate routes** in the sidebar. Choose a date, enter a **street address where the crew is starting**, choose whether to finish back at that location, and select up to eight existing leads/estimates. Move selected stops up/down, click **Save route plan** to persist this day's itinerary in the private `epoxy_estimate_routes` Supabase table, and use **Open directions in Google Maps** to review roads and driving time. Plans are shared across the approved Ignite and Epoxy accounts by date.

Most of the first ten Epoxy ad leads only submitted **ZIP codes**. The route preview marks those as *approximate*: Google Maps directs to the ZIP area, not the homeowner's address. Collect and save full addresses before routing an actual visit.

**Automatic ordering** uses a server-only Vercel endpoint `/api/optimize-estimate-route`. It checks the signed-in Supabase user and workspace membership, reads only permitted job addresses, then calls Google Routes API Compute Routes with `optimizeWaypointOrder`. To activate automatic driving-order optimization, enable Routes API billing in Google Cloud and add the secret **`GOOGLE_MAPS_ROUTES_API_KEY`** to Vercel's project environment variables (do not prefix it with `VITE_`). Requests to Google Routes API may incur charges. Until configured, route plan saving and Google Maps directions work; the automatic optimization button reports that configuration is needed. Directions URLs can be limited to three intermediate waypoints in mobile browsers; validate each route in the Google Maps app.

Migration: `supabase/estimate-route-plans.sql` was applied to the existing Ignite Supabase project under the protected Epoxy workspace. Original imported records were not changed.
