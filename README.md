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

## Simple estimate planner (October 21, 2026)

The sidebar calls this **Plan estimates**. The client only needs three steps:

1. Type the starting street address and choose the day.
2. Click **Add** beside up to four customers. If a lead only has a ZIP code, click **Add street address** and save the real address directly from the list.
3. Click **Open route in Google Maps**. The selected order is used for driving directions. Opening the route attempts to save the day's plan to the private database. **Save for later** stores it without opening Maps.

The saved starting location appears again for new days. Existing saved itineraries remain stored in `public.epoxy_estimate_routes`. The controls are mobile-friendly; `Change order` is hidden until it is needed. The client does not need Google Cloud credentials.

**Important:** Google Maps displays the chosen stop order, not necessarily the fastest possible order. ZIP-only leads route to their general postal area, so collect street addresses before visiting. A server-side Google Routes optimization endpoint exists in the repository but is **not connected to the simplified user interface**, and automatic drive-time optimization is not active.

Migration: `supabase/estimate-route-plans.sql` was applied to the Ignite Supabase project. Original imported leads remain intact.
