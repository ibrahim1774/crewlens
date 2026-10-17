# Onboarding v2 and Documents — addendum to the Crew Lens design

Date: 2026-10-17. Extends `2026-10-17-crew-lens-design.md`. Requested by Ibrahim after reviewing
CompanyCam's onboarding: follow its structure (welcome with animated activity cards, account, about
you, tailor, guided first steps, home checklist), be precise about the problem each step fixes, drop
anything about collecting payments, and add a Documents feature on the Pro plan.

## 1. Onboarding flow (ten screens, one progress language)

1. **Welcome** — wordmark, headline "EVERY JOB. STAMPED, FILED, SHARED.", one-line sub. A card deck
   animates vertically (each card rises in, holds ~2.4 s, drops out): "Added 4 photos" (stamped thumbs),
   "Shared the job link" (live-link row), "Sent an invoice" (document with SENT · TEXT badge). No payment
   card. Buttons: Get started (primary), Sign in (ghost). "See how it works" opens the product tour.
2. **Sign in** — unchanged (Apple, or email + 6-digit code).
3. **About you** — full name (unchanged screen, copy sharpened).
4. **Your company** — company name + trade chips (unchanged).
5. **Tailor** — new: role chips (Owner, Field, Office, Project manager, Other), crew size chips
   (Just me, 2–5, 6–15, 16+), "How did you hear about us" chips. Stored in local meta + sent to PostHog
   as person properties. Skippable.
6. **Permissions** — unchanged.
7. **Plan** — new native plan picker: Solo $9.99, **Pro $19.99 (highlighted, 3-day free trial, includes
   Documents & invoices)**, Crew $49.99; yearly toggle ($79.99 / $159.99 / $399.99). Feature matrix rows:
   active jobs, photos per job, video, live links (expire / never), **Documents & invoices (Pro+)**, seats.
   With Superwall active the CTA registers `onboarding_complete`; otherwise it continues on Pro limits.
8. **First job** — guided: "Stamp a photo of the job you are on today." Job card preview + "Open camera"
   (creates "First job" if none) or "Create a job first". Skippable.
9. **Crew** — "Who is working on this job with you?" Invite by text/email (Crew plan; otherwise explains
   seats) or Skip.
10. **Share & documents** — "Send the client one link. Attach the paperwork." Buttons: Copy live link
    (if a job exists), Upload a document (Pro). Finish → Jobs tab.

Home (Jobs tab) gets a **Start here** card with progress: Create a job · Take a stamped photo · Share a
live link · Upload a document. Hidden once complete or dismissed.

## 2. Documents (Pro and Crew)

Problem it fixes: paperwork lives in email threads and the truck. Contractors need the invoice, the
change order, the signed proposal next to the photos of the same job, and a one-tap way to send it.

- **Upload** any PDF or image per job (document picker, photos). Stored locally (Documents/docs/<job>/)
  and in Supabase bucket `documents` (`<company>/<job>/<doc>.pdf`), table `documents`
  (id, company_id, project_id, name, kind, storage_path, size, pages, sent_to, sent_via, sent_at,
  created_by, created_at, updated_at, version).
- **Edit** in the app: pages render through pdf.js in a WebView; tools: text, checkmark, highlight,
  signature (draw), date stamp, the Crew Lens evidence stamp. Save exports a flattened PDF via
  expo-print (page image + overlays) as a new version; the original is kept.
- **Send**: text message (expo-sms with attachment), email (expo-mail-composer), or the share sheet.
  Every send is logged on the document (to, via, when).
- Entitlement: `documents` gate = tier is pro or crew. Solo sees the section with an upgrade row.

## 3. Out of scope now
Template-based invoice generation, e-signature requests to the customer, payments.
