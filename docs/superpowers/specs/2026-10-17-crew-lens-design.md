# Crew Lens — Design Spec

Date: 2026-10-17
Status: awaiting Ibrahim's review

## 1. Purpose

Crew Lens is an iOS app for contractors and field crews. It makes job-site photo
documentation automatic: open the camera, the nearest job is already selected,
every photo carries a stamp (time, GPS, who took it), and the whole job can be
shared with a client or office in one link.

It competes with CompanyCam on the core loop only. It does not do payments,
estimating, CRM integrations or AI in v1.

**Who it is for:** one-truck contractors and crews of 2 to 10 across any trade
(roofing, HVAC, plumbing, landscaping, restoration, painting, cleaning,
inspections). US first, English only.

**Success looks like:**

- A new user takes a stamped photo filed to a job within 60 seconds of finishing onboarding.
- Photos taken offline reach the cloud without the user doing anything.
- A client opens a share link on any phone and sees the job without installing anything.
- Infra cost per paying subscriber stays under 5 percent of revenue.

## 2. Business model

No free version. Hard paywall after onboarding. Monthly and yearly products.
The 3-day free trial is on Pro only.

| | Solo | Pro | Crew |
|---|---|---|---|
| Monthly | $9.99 | $19.99 | $49.99 |
| Yearly | $79.99 | $159.99 | $399.99 |
| Trial | none | 3 days free | none |
| Seats | 1 | 1 | 3 included, extra seat $9.99/mo |
| Active jobs | 25 | 100 | 500 |
| Photos per job | 100 | 250 | 500 |
| Video | none | 10 per job, 60 s max | 25 per job, 120 s max |
| Archived jobs | unlimited | unlimited | unlimited |
| Share links | expire after 30 days | never expire | never expire |
| PDF reports | no | yes (phase 3) | yes, with logo (phase 3) |
| Checklists | 3 templates (phase 3) | unlimited (phase 3) | unlimited (phase 3) |

Metering is on **active jobs**, never on storage. Archiving is free and keeps
every photo. Users are never asked to delete anything to make room.

Product identifiers (App Store Connect and Superwall):

```
com.ibrahim1774.crewlens.solo.monthly
com.ibrahim1774.crewlens.solo.yearly
com.ibrahim1774.crewlens.pro.monthly      (3-day free trial introductory offer)
com.ibrahim1774.crewlens.pro.yearly       (3-day free trial introductory offer)
com.ibrahim1774.crewlens.crew.monthly
com.ibrahim1774.crewlens.crew.yearly
com.ibrahim1774.crewlens.seat.monthly     (phase 2, add-on seat)
```

Entitlements: `solo`, `pro`, `crew`. Each higher tier includes the lower ones.

## 3. Design system

**Concept: the stamp.** CompanyCam's visual identity is paint strokes on cream.
Crew Lens's identity is the evidence stamp every photo carries. The look comes
from the product's function, not decoration.

### Colour (one job per colour)

| Token | Role | Value |
|---|---|---|
| `canvas` | screen background, light concrete | `#E9E7E1` |
| `surface` | cards, sheets | `#F7F6F2` |
| `ink` | primary text | `#15161A` |
| `ink2` | secondary text | `#5B5E66` |
| `hairline` | 1px borders | `#C9C7C0` |
| `flag` | the one action colour: capture button, primary CTA, unsynced badge | `#E8521E` |
| `slate` | data colour: stamps, links, pins | `#3D5A80` |
| `ok` | synced, success | `#2F7D4F` |
| `camera` | camera and viewer background | `#0B0B0D` |

No gradients, no glass blur, no shadows, no purple, nothing else orange.

### Type

- Headings, job names, tab labels: **Barlow Condensed** (600/700), tight tracking, sentence case. Never all-caps display slabs like CompanyCam.
- Body: **Inter** 400/500.
- Stamps, timestamps, coordinates, counts, link tokens: **JetBrains Mono** 400/500. The monospace stamp is the signature element.

### Shape and layout

- 6px corners on cards and buttons. 2px on chips and stamps. No pills.
- 1px hairline borders instead of elevation.
- 16px gutters, 8px grid.
- Photos are the largest thing on every screen that has them.
- Icons: SF Symbols through `expo-symbols`. No emoji in UI.
- Empty states: one line of plain text plus the action, no illustrations.

### The stamp component

A small block rendered on photos, in grids and in feeds:

```
┌───────────────────────────┐
│ 10:42  ·  OCT 17 2026     │
│ 40.7128N 74.0060W  ·  IBR │
└───────────────────────────┘
```

Monospace, `slate` on 80 percent `surface`, 2px corners. Tapping it opens the
photo's detail with the map pin. The stamp is also burned into the exported
image when a user shares or saves a photo outside the app, never into the
stored original.

## 4. App structure

Five-slot bottom bar. Camera is the centre slot, rendered as a round `flag`
button that overlaps the bar.

```
┌─────────┬──────────┬─────────┬─────────┬────────┐
│  Jobs   │ Activity │  (📷)   │ Shared  │  You   │
└─────────┴──────────┴─────────┴─────────┴────────┘
```

### Jobs tab

- Header: company name, search, list/map toggle.
- Section "Nearby" (jobs within 300 m of current location, sorted by distance), then "Recent" (by last photo), then "All".
- Row: 72px cover thumbnail, job name (condensed), address (body, `ink2`), stamp line with last-activity time and photo count. Unsynced count in `flag` if any.
- "New job" button in the header. Creating a job: name, address with autocomplete (Apple MapKit via `expo-location` reverse geocode as default, user can edit), optional client name. Location defaults to where the user is standing.
- Archived jobs under a collapsed "Archived" section at the bottom. Archived rows are greyed and have no camera affordance.
- Map toggle: pins for active jobs, tap pin to open job. Phase 3.

### Activity tab (phase 2)

- Stream grouped by day, then by job. Each group: job name, a 3-up photo strip, "Ibrahim · 4 photos · 10:42". Tap to open the job scrolled to that time.
- Only company members see this. Solo users see their own activity.

### Camera (centre)

- Opens directly to a full-screen viewfinder on `camera` background.
- Bottom strip: horizontally scrolling job chips. The nearest active job is pre-selected and highlighted in `flag`. A leading "+ New job here" chip creates a job at the current location.
- If no job is within 300 m, the strip shows "No job nearby" and "+ New job here" is pre-selected.
- Shutter: 72px `flag` circle. Long-press records video (Pro and Crew only; Solo sees a one-line upsell).
- After each shot the stamp appears bottom-left for 1.2 s and a small count badge increments on the selected job chip.
- Flash toggle, front/back toggle, close. Nothing else.
- Capture is fully offline. The photo is written to local storage and queued immediately.

### Job screen

- Hero: cover photo with the job name and address overlaid at the bottom in `surface` text with a dark scrim.
- Actions row: Camera, Share, Tag (phase 2), More (archive, edit, delete).
- Photo grid, 3 columns, grouped by day with a monospace day header "Fri Oct 17 · 12 photos". Each tile has a tiny stamp time in the corner. Unsynced tiles show a `flag` dot.
- Tap a tile: full-screen viewer, swipe between photos, stamp and taker at the bottom, actions: share this photo, save to camera roll, delete.
- Share sheet (bottom sheet):
  - **Live link to this job**: one link that always shows the current job. Creates or reuses the job's timeline link. Copies to clipboard and offers the iOS share sheet.
  - **Pick photos** (phase 2): enters selection mode with "Select all" per day header and a "Select all in job" button. Creates a fixed gallery link.
- Archive: moves the job to Archived, freezes its live link (link keeps working but stops updating), removes it from the camera strip and the active count.

### Shared tab (phase 2)

- Every link the company has created: job name, type (Live or Gallery), created, expires, opens count, last opened. Tap to copy, revoke or extend.

### You tab

- Profile: name, initials used in stamps.
- Company: name, trade, logo (phase 3).
- Team (Crew tier): members, invite by link, remove. Phase 2.
- Plan: current tier, usage bar "37 of 100 active jobs", manage subscription, restore purchases.
- Support: support@davoxa.com, privacy policy, terms.

### Onboarding (first launch)

1. Welcome: one screen, product promise, "Get started".
2. Sign in with Apple, or email code.
3. Your name (pre-filled from Apple if available). Initials preview in a stamp.
4. Company name and trade (chip picker, 12 common trades plus "Other").
5. Permissions: camera, location while using, photos (add-only), notifications. Each explained in one line, each requested in sequence.
6. App Tracking Transparency prompt (after attribution SDK is ready, before paywall, mirroring CostCook).
7. Paywall (Superwall placement `onboarding_complete`). Hard gate: no access without a product or an active trial.

Returning users with an inactive subscription see the paywall at launch (placement `subscription_lapsed`) and can only reach You > Plan and the share links they already created.

## 5. Architecture

### Client

- Expo SDK 55, expo-router (typed routes), React 19, React Native 0.83, TypeScript.
- `expo-camera` for capture, `expo-location` for GPS and reverse geocoding, `expo-image-manipulator` for compression and thumbnails, `expo-file-system` for local files, `expo-sqlite` for the local cache and upload queue, `expo-image` for rendering, `expo-symbols` for icons, `@expo-google-fonts` for Barlow Condensed, Inter and JetBrains Mono.
- `@supabase/supabase-js` with `expo-secure-store` for session storage.
- `expo-superwall` for paywall and entitlements.
- `posthog-react-native`, `react-native-appsflyer`, `expo-tracking-transparency` wired exactly as in CostCook's `analytics.ts`.
- State: a thin store over SQLite for offline-first reads, Supabase Realtime for live updates when online. No Redux.

### Backend (Supabase, project "crewlens", org IBRAHIM SAAS, region us-east-1)

Tables (all with `created_at`, `updated_at`, RLS on):

- `companies` (id, name, trade, tier, seats, logo_path)
- `members` (user_id, company_id, role owner|member, display_name, initials)
- `projects` (id, company_id, name, address, client_name, lat, lng, status active|archived, cover_photo_id, archived_at)
- `photos` (id, project_id, company_id, taker_id, kind photo|video, storage_path, thumb_path, width, height, duration_s, taken_at, lat, lng, accuracy_m, device_id, local_id)
- `tags`, `photo_tags` (phase 2)
- `share_links` (id, company_id, project_id, type live|gallery, token, expires_at, revoked_at, photo_ids uuid[] null for live)
- `link_views` (link_id, viewed_at, user_agent_hash)
- `plan_limits` (tier, active_projects, photos_per_project, videos_per_project, video_max_s, link_days) seeded with the table in section 2.

Storage buckets: `photos` (private, signed URLs, 2048px long edge, JPEG q82), `thumbs` (private, 320px), `videos` (private, 720p, phase 3).

Enforcement in Postgres, not the client:

- `before insert on projects`: count active projects for the company versus `plan_limits`; raise `limit_active_projects` if exceeded.
- `before insert on photos`: count photos in the project versus the limit; raise `limit_photos_per_project`.
- `share_links.expires_at` is set by a trigger from the company tier on insert.
- Company tier is written by the client after Superwall confirms entitlement, and is verified by a Superwall webhook to an Edge Function in phase 2. Until then the client write is trusted, which is acceptable for launch because the client is the only purchaser.

RLS: members read and write rows where `company_id` matches one of their memberships. `share_links` and the photos they expose are readable by anon only through a `security definer` function `get_shared_project(token)` that checks expiry and revocation and increments `link_views`.

### Offline queue and sync

1. Capture writes the full-res file and a thumb to the app's documents directory and inserts a row in local SQLite with `sync_state = pending`, a client-generated UUID and all stamp fields.
2. The uploader runs when the app is foregrounded and on network change. It uploads thumb first, then full, then inserts the `photos` row with the same UUID. Retries with exponential backoff, max 8 attempts, then `sync_state = failed` with a visible banner and a retry button.
3. If the project was created offline, the project row syncs first.
4. Background completion is best effort via `expo-background-task`; the UI never depends on it.
5. Reads come from SQLite. A pull on open refreshes from Supabase and reconciles by UUID.

### Share page

- Small static web app on Vercel at `crewlens.vercel.app/s/[token]` for now, custom domain later.
- Reads through `get_shared_project(token)` with the anon key. Shows job name, address, day-grouped photo grid with stamps, lightbox, "Powered by Crew Lens". No login.
- Expired or revoked links show a plain "This link has expired" page.

### Analytics and attribution

- PostHog events: `onboarding_step`, `paywall_shown`, `paywall_closed`, `subscription_status`, `job_created`, `photo_captured` (with `offline` flag), `photo_synced`, `sync_failed`, `link_created`, `link_opened` (from the web page), `job_archived`.
- AppsFlyer: install attribution and `trial` / `subscribe` conversion events via Superwall events, same wiring as CostCook.

### Secrets

All keys live in the gitignored `.env.local` at the repo root, mirroring CostCook.
Public client keys use the `EXPO_PUBLIC_` prefix. The App Store Connect `.p8`
lives at the repo root and is gitignored.

## 6. Testing

- **Unit** (Jest via `jest-expo`): nearby ranking, stamp formatting, upload queue state machine, plan limit messages, link expiry maths.
- **Database**: pgTAP-style SQL tests run through the Supabase MCP against the dev project for the two limit triggers and the shared-project function.
- **Maestro flows**: onboarding to paywall; sandbox purchase of Pro with the Apple tester account; create job, take photo, confirm it appears synced; create live link, open it in Safari; archive job and confirm it leaves the camera strip.
- **Manual on device**: airplane-mode capture then reconnect, GPS accuracy at a real address, share link on a non-iPhone browser.
- Lint and typecheck gate every commit.

## 7. Delivery phases

**Phase 1 (ships first, target one week):** scaffold, theme and components, onboarding, Superwall paywall with six products, Supabase schema with limits and RLS, Jobs tab with nearby sorting and archive, Camera with job strip and stamp, offline queue and upload, Job screen with grid and viewer, live job share link with the Vercel page, You tab with plan usage, analytics and attribution, unit and Maestro tests, ad hoc build installed on Ibrahim's phone over USB.

**Phase 2:** Pick-photos gallery links with select-all, tags, Activity tab, photo annotation (arrows, text, freehand), team invites and seats, Shared tab with view counts, Superwall webhook for tier verification.

**Phase 3:** video, PDF reports, checklists and templates, map view, company logo.

**Not planned:** payments and invoicing, AI captions or reports, CRM integrations, room measuring, Android, translation.

## 8. Setup to be done before code

1. Apple: register bundle ID `com.ibrahim1774.crewlens`, create the App Store Connect app "Crew Lens", create the six subscriptions in one group with the Pro trial as an introductory offer. Done through the Superwall CLI's ASC proxy or the ASC API key.
2. Superwall: new app "Crew Lens" in org IBRAHIMS ECOM, products, entitlements, campaign with placements `onboarding_complete` and `subscription_lapsed`, one paywall in the Crew Lens design system.
3. Supabase: create project, apply schema migration, create buckets, seed `plan_limits`.
4. EAS: new project under owner `ibrahim1774`, `eas.json` cloned from CostCook with the Crew Lens ASC app ID.
5. Vercel: new project `crewlens-share`.
6. ASO: name, subtitle, keywords and description through the `vibe-aso` skill, English first; other locales after Phase 1 ships.

## 9. Open items

- Ibrahim mentioned an Expo access token but none was included in the message. EAS is already logged in on this machine as `ibrahim1774`, so it is not blocking.
- Custom domain for share links: using the Vercel subdomain until one is chosen.
- Trade list for onboarding to be finalised during Phase 1 build.
