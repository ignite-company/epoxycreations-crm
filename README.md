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
