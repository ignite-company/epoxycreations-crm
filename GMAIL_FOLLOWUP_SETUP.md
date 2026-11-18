# Epoxy Creations Gmail follow-up setup

CRM: https://epoxycreations-crm.vercel.app/
Backend: https://ujvuqbgheewbyvfusqvz.supabase.co/functions/v1/epoxy-gmail

## Implemented

- Secure Gmail OAuth authorization with per-workspace state and verified CRM membership.
- Gmail refresh token encrypted at rest; it is never returned to the browser.
- Three messages: first check-in, day 2 reminder, day 5 last check-in.
- New leads entering Follow Up are queued only after an authorized Gmail is connected and sending is explicitly enabled.
- Existing Follow Up leads are not auto-enrolled; an owner can separately choose Queue 3 emails for each.
- Gmail sends the email. Reply detection is checked before later messages. Booking or leaving Follow Up stops subsequent sends.
- Cron runs every 15 minutes. Emails send only on weekdays between 9 AM and 6 PM Eastern, up to 15 per 24 hours.
- Sending starts OFF. No production send or OAuth integration has been tested with the business mailbox yet.

## Complete Google Cloud OAuth configuration

1. Create or select a Google Cloud project for Epoxy Creations. Enable the Gmail API.
2. In Google Auth Platform configure an External OAuth app with app name, support email, privacy policy information and the client's Gmail as an allowed Test User if in Testing.
3. Request these OAuth scopes: openid, email, https://www.googleapis.com/auth/gmail.send and https://www.googleapis.com/auth/gmail.readonly. The read permission detects replies and automatically halts the sequence.
4. Create an OAuth client ID of type Web application with this exact authorized redirect URI:
   https://ujvuqbgheewbyvfusqvz.supabase.co/functions/v1/epoxy-gmail
5. In Ignite's Supabase project ujvuqbgheewbyvfusqvz, set Edge Function secrets EPOXY_GOOGLE_CLIENT_ID and EPOXY_GOOGLE_CLIENT_SECRET with values from the Google Cloud Console.
6. In the CRM, sign in as an Epoxy workspace owner/admin, navigate to Settings > Email follow-ups, select Connect Gmail, then authorize the owner's real gmail.com account.
7. Verify the connected email in the CRM and review all email copy. Then select Enable follow-up emails. Existing Follow Up leads need separate approval.
8. Test with an owner-controlled email address. Check the received message, threading, Sent folder, reply detection, stop rules, and CRM delivery status before using with actual leads.

## Production considerations

- Gmail read access is a restricted OAuth scope. Google may require app verification and a security assessment for production. OAuth apps in External Testing generally have refresh tokens that expire after seven days. Do not assume test consent is suitable for unattended production sending.
- No client Gmail password is needed, and client Gmail tokens must never be sent to the agency in plain text.
- Credential encryption uses an AES-GCM key derived from the Supabase service-role secret, which must remain server-only. A service-role key rotation requires Gmail reconnection.
- OAuth credentials must be configured as server-side Edge Function secrets. Never use VITE_ variables or commit them.
- The production Vercel project is not visible to the currently connected Vercel account. Repository changes were committed to ignite-company/epoxycreations-crm, but independently verify that the site's deployment picked them up.

## Database

Migration applied: epoxy_gmail_automation_secure_queue. The new secure credential/state/worker tables are RLS-protected and inaccessible to anonymous and authenticated browser roles. Email message statuses include sending, provider thread ID, and RFC Message-ID. Trigger epoxy_queue_follow_up_trigger queues new leads once sending is activated.

Worker Cron job: epoxy-gmail-followup-worker (*/15 * * * *). The worker secret is stored only in an RLS-protected database table and read by a privileged cron invocation. No Gmail sends happen while the account is disconnected or sending is off.