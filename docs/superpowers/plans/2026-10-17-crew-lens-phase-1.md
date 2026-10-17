# Crew Lens Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Crew Lens core loop on iOS: sign in, create jobs, take GPS-stamped photos that file themselves to the nearest job and sync offline-first to Supabase, browse them per job, and share a live link to a job.

**Architecture:** Expo Router app with a thin SQLite-backed local store that is the source of truth for reads. A queue table drives uploads to Supabase Storage and Postgres; the server enforces plan limits with triggers and exposes shared jobs to anonymous viewers through one `security definer` function. A separate static web page on Vercel renders shared jobs.

**Tech Stack:** Expo SDK 55, expo-router, React 19, TypeScript strict, expo-camera, expo-location, expo-image-manipulator, expo-file-system (File API), expo-sqlite, expo-secure-store, expo-symbols, @supabase/supabase-js, expo-superwall (stubbed behind a flag), posthog-react-native, react-native-appsflyer, Jest via jest-expo, Maestro.

**Spec:** `docs/superpowers/specs/2026-10-17-crew-lens-design.md`

## Global Constraints

- Expo SDK `~55`, React Native `0.83`, React `19.2`. Install every package with `npx expo install`.
- iOS only. Deployment target `16.4`. Bundle ID `com.ibrahim1774.crewlens`. Scheme `crewlens`.
- TypeScript `strict: true`. `npx expo lint` and `npx tsc --noEmit` must pass before every commit.
- No `ios/` or `android/` folders committed. Native config lives in `app.json` and plugins.
- Colours only from `src/constants/theme.ts`. Fonts: Barlow Condensed (headings), Inter (body), JetBrains Mono (stamps).
- Shape: 6px corners on cards and buttons, 2px on chips and stamps, 1px hairlines, no shadows, no gradients.
- Icons via `expo-symbols` only. No emoji in UI strings.
- Photos stored at 2048px long edge JPEG quality 0.82. Thumbnails 320px long edge quality 0.7.
- Nearby radius 300 m. Upload retry max 8 attempts with exponential backoff starting at 2 s.
- Plan limits (active jobs / photos per job / link days): solo 25/100/30, pro 100/250/null, crew 500/500/null.
- Paywall: `EXPO_PUBLIC_PAYWALL_ENABLED` defaults to `false` until the Superwall paywall exists. When false, every user is treated as `pro`.
- Secrets only in `.env.local` (gitignored). Public keys use the `EXPO_PUBLIC_` prefix.
- Support email `support@davoxa.com`.

## Review Focus

1. **Location permission denied or GPS unavailable.** Camera must still work: job strip shows all active jobs sorted by recency, stamp shows `NO GPS`, photo saves with null coordinates. Test in Task 6 and Task 9.
2. **App killed mid-upload.** On next launch the queue row is still `pending` or `uploading`; `uploading` rows older than 2 minutes are reset to `pending` and retried. Test in Task 7.
3. **Same photo uploaded twice after a flaky network.** Storage upload uses `upsert: true` and the `photos` insert uses the client UUID as primary key with `on conflict do nothing`. Test in Task 7 (unit) and Task 4 (SQL).
4. **Hitting the active-jobs limit.** Creating a job when at the limit shows the limit sheet with "Archive a job" and "Upgrade" and does not create a local row. Test in Task 8.
5. **Opening an expired or revoked link.** The share page shows the expired state, never a stack trace or an empty grid. Test in Task 12.

---

## File structure

```
crewlens/
  app.json                      Expo config, plugins, permissions copy
  eas.json                      cloned from CostCook with Crew Lens ids
  package.json
  tsconfig.json                 strict, @/* -> src/*
  eslint.config.js
  jest.config.js                preset jest-expo
  .maestro/                     e2e flows
  assets/images/                icon, splash
  supabase/migrations/          SQL applied through the Supabase MCP, kept in repo
  web/                          Vercel share page (separate package)
  src/
    app/
      _layout.tsx               fonts, providers, auth gate, splash
      (auth)/
        _layout.tsx
        welcome.tsx
        sign-in.tsx
        name.tsx
        company.tsx
        permissions.tsx
        paywall.tsx             placeholder route until Superwall paywall exists
      (tabs)/
        _layout.tsx             5-slot bar with centre camera button
        index.tsx               Jobs
        activity.tsx            Phase 2 placeholder (empty state)
        shared.tsx              Phase 2 placeholder (empty state)
        you.tsx
      camera.tsx                full-screen modal
      job/[id].tsx              job screen
      job/new.tsx               new job sheet
      photo/[id].tsx            viewer
    components/
      text.tsx                  Heading, Body, Mono
      stamp.tsx                 Stamp block
      job-row.tsx
      photo-tile.tsx
      job-chip-strip.tsx        camera bottom strip
      button.tsx                Primary, Secondary, Ghost
      sheet.tsx                 bottom sheet wrapper
      empty.tsx                 empty state
      limit-sheet.tsx
    constants/
      theme.ts                  colours, spacing, radii, fonts
      limits.ts                 PLAN_LIMITS, NEARBY_RADIUS_M
    lib/
      supabase.ts               client with SecureStore session
      db.ts                     SQLite open + schema + typed helpers
      store.ts                  useSyncExternalStore over db
      auth.ts                   session, sign in with Apple, email OTP
      company.ts                create/load company + member
      jobs.ts                   CRUD, archive, nearby ranking
      photos.ts                 capture -> compress -> local save -> queue
      queue.ts                  upload state machine
      uploader.ts               runs queue against Supabase
      geo.ts                    distance, formatting
      stamp.ts                  stamp text formatting
      links.ts                  share link create/copy
      plan.ts                   current tier, limits, paywall flag
      analytics.ts              PostHog + AppsFlyer (from CostCook)
      paywall.tsx               Superwall wrappers (from CostCook, flag-gated)
    types/
      models.ts                 Company, Member, Job, Photo, ShareLink, QueueItem
  __tests__/
    geo.test.ts
    stamp.test.ts
    jobs.test.ts
    queue.test.ts
    plan.test.ts
```

---

### Task 1: Scaffold, theme, fonts, lint and test harness

**Files:**
- Create: `package.json`, `app.json`, `tsconfig.json`, `eslint.config.js`, `jest.config.js`, `eas.json`, `src/app/_layout.tsx`, `src/constants/theme.ts`, `src/components/text.tsx`, `assets/images/*`
- Test: `__tests__/theme.test.ts`

**Interfaces:**
- Produces: `Colors`, `Space`, `Radius`, `Fonts` from `@/constants/theme`; `Heading`, `Body`, `Mono` text components.

- [ ] **Step 1: Create the Expo app in the repo root**

```bash
cd "/Users/ibrahim/Crew Lens (IOS)/crewlens"
npx create-expo-app@latest . --template blank-typescript --no-install
```

Then replace `package.json` scripts and set `"main": "expo-router/entry"`, `"name": "crewlens"`.

- [ ] **Step 2: Install dependencies**

```bash
npx expo install expo-router expo-linking expo-constants expo-status-bar expo-splash-screen expo-system-ui expo-font expo-symbols expo-haptics expo-image expo-sqlite expo-secure-store expo-camera expo-location expo-image-manipulator expo-file-system expo-background-task expo-task-manager expo-clipboard expo-web-browser expo-apple-authentication expo-tracking-transparency expo-application expo-device expo-build-properties expo-dev-client react-native-screens react-native-safe-area-context react-native-gesture-handler react-native-reanimated react-native-worklets react-native-svg @react-navigation/native @expo-google-fonts/barlow-condensed @expo-google-fonts/inter @expo-google-fonts/jetbrains-mono @supabase/supabase-js expo-superwall posthog-react-native react-native-appsflyer react-native-url-polyfill
npx expo install --save-dev jest jest-expo @types/jest eslint eslint-config-expo typescript
```

- [ ] **Step 3: Write app.json**

```json
{
  "expo": {
    "name": "Crew Lens",
    "slug": "crewlens",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "crewlens",
    "userInterfaceStyle": "light",
    "newArchEnabled": true,
    "ios": {
      "bundleIdentifier": "com.ibrahim1774.crewlens",
      "supportsTablet": false,
      "infoPlist": {
        "ITSAppUsesNonExemptEncryption": false,
        "NSAdvertisingAttributionReportEndpoint": "https://appsflyer-skadnetwork.com/"
      },
      "usesAppleSignIn": true
    },
    "plugins": [
      "expo-router",
      "expo-sqlite",
      "expo-secure-store",
      "expo-apple-authentication",
      ["expo-splash-screen", { "backgroundColor": "#E9E7E1", "image": "./assets/images/splash-icon.png", "imageWidth": 120 }],
      ["expo-camera", {
        "cameraPermission": "Crew Lens uses the camera to take job-site photos.",
        "microphonePermission": "Crew Lens uses the microphone when you record a video on a job."
      }],
      ["expo-location", {
        "locationWhenInUsePermission": "Crew Lens uses your location to file photos to the nearest job and to stamp where they were taken."
      }],
      ["expo-tracking-transparency", {
        "userTrackingPermission": "Crew Lens uses this to understand which ads bring people to the app. Your photos are never shared."
      }],
      ["expo-build-properties", { "ios": { "deploymentTarget": "16.4" } }],
      "react-native-appsflyer"
    ],
    "experiments": { "typedRoutes": true, "reactCompiler": true },
    "extra": { "router": {}, "eas": { "projectId": "" } },
    "owner": "ibrahim1774"
  }
}
```

- [ ] **Step 4: Write theme.ts**

```ts
export const Colors = {
  canvas: '#E9E7E1',
  surface: '#F7F6F2',
  ink: '#15161A',
  ink2: '#5B5E66',
  hairline: '#C9C7C0',
  flag: '#E8521E',
  slate: '#3D5A80',
  ok: '#2F7D4F',
  camera: '#0B0B0D',
  onCamera: '#F7F6F2',
} as const;

export const Space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const Radius = { chip: 2, card: 6, round: 999 } as const;
export const Fonts = {
  heading: 'BarlowCondensed_600SemiBold',
  headingBold: 'BarlowCondensed_700Bold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
} as const;
```

- [ ] **Step 5: Write text.tsx**

```tsx
import { Text, type TextProps } from 'react-native';
import { Colors, Fonts } from '@/constants/theme';

type Props = TextProps & { color?: string; size?: number };

export function Heading({ style, color = Colors.ink, size = 24, ...rest }: Props) {
  return <Text {...rest} style={[{ fontFamily: Fonts.heading, fontSize: size, color, letterSpacing: -0.2 }, style]} />;
}
export function Body({ style, color = Colors.ink, size = 15, ...rest }: Props) {
  return <Text {...rest} style={[{ fontFamily: Fonts.body, fontSize: size, color, lineHeight: size * 1.4 }, style]} />;
}
export function Mono({ style, color = Colors.slate, size = 12, ...rest }: Props) {
  return <Text {...rest} style={[{ fontFamily: Fonts.mono, fontSize: size, color, letterSpacing: 0.2 }, style]} />;
}
```

- [ ] **Step 6: Write _layout.tsx that loads fonts and renders a Stack**

Load `BarlowCondensed_600SemiBold`, `BarlowCondensed_700Bold`, `Inter_400Regular`, `Inter_500Medium`, `JetBrainsMono_400Regular`, `JetBrainsMono_500Medium` with `useFonts`, hold the splash until loaded, wrap in `GestureHandlerRootView` and a navigation `ThemeProvider` with `background: Colors.canvas`.

- [ ] **Step 7: Write jest.config.js and a theme test**

```js
module.exports = { preset: 'jest-expo', testMatch: ['**/__tests__/**/*.test.ts'] };
```

```ts
import { Colors } from '@/constants/theme';
test('one action colour', () => {
  const oranges = Object.values(Colors).filter((c) => c === '#E8521E');
  expect(oranges).toHaveLength(1);
});
```

- [ ] **Step 8: Run lint, typecheck, test; commit**

```bash
npx expo lint && npx tsc --noEmit && npx jest
git add -A && git commit -m "Scaffold Crew Lens with theme, fonts and test harness"
```

---

### Task 2: Types, limits, geo and stamp helpers

**Files:**
- Create: `src/types/models.ts`, `src/constants/limits.ts`, `src/lib/geo.ts`, `src/lib/stamp.ts`
- Test: `__tests__/geo.test.ts`, `__tests__/stamp.test.ts`

**Interfaces:**
- Produces: `distanceM(a, b)`, `formatCoords(lat, lng)`, `stampLines(photo, initials)`, `PLAN_LIMITS`, `NEARBY_RADIUS_M`, model types.

- [ ] **Step 1: Write models.ts**

```ts
export type Tier = 'solo' | 'pro' | 'crew';
export type JobStatus = 'active' | 'archived';
export type SyncState = 'pending' | 'uploading' | 'synced' | 'failed';

export interface Company { id: string; name: string; trade: string; tier: Tier; seats: number; createdAt: string }
export interface Member { userId: string; companyId: string; role: 'owner' | 'member'; displayName: string; initials: string }
export interface Job {
  id: string; companyId: string; name: string; address: string; clientName: string | null;
  lat: number | null; lng: number | null; status: JobStatus; coverPhotoId: string | null;
  createdAt: string; updatedAt: string; archivedAt: string | null;
  lastPhotoAt: string | null; photoCount: number; pendingCount: number;
}
export interface Photo {
  id: string; jobId: string; companyId: string; takerId: string; takerInitials: string;
  kind: 'photo' | 'video'; localUri: string | null; localThumbUri: string | null;
  storagePath: string | null; thumbPath: string | null; width: number; height: number;
  durationS: number | null; takenAt: string; lat: number | null; lng: number | null; accuracyM: number | null;
  syncState: SyncState; attempts: number; lastError: string | null;
}
export interface ShareLink {
  id: string; companyId: string; jobId: string; type: 'live' | 'gallery'; token: string;
  expiresAt: string | null; revokedAt: string | null; createdAt: string;
}
```

- [ ] **Step 2: Write limits.ts**

```ts
import type { Tier } from '@/types/models';
export const NEARBY_RADIUS_M = 300;
export const MAX_UPLOAD_ATTEMPTS = 8;
export const PLAN_LIMITS: Record<Tier, { activeJobs: number; photosPerJob: number; videosPerJob: number; videoMaxS: number; linkDays: number | null }> = {
  solo: { activeJobs: 25, photosPerJob: 100, videosPerJob: 0, videoMaxS: 0, linkDays: 30 },
  pro: { activeJobs: 100, photosPerJob: 250, videosPerJob: 10, videoMaxS: 60, linkDays: null },
  crew: { activeJobs: 500, photosPerJob: 500, videosPerJob: 25, videoMaxS: 120, linkDays: null },
};
```

- [ ] **Step 3: Write failing geo tests**

```ts
import { distanceM, formatCoords } from '@/lib/geo';
test('distance between two points', () => {
  // Empire State Building to Bryant Park, about 650 m
  const d = distanceM({ lat: 40.7484, lng: -73.9857 }, { lat: 40.7536, lng: -73.9832 });
  expect(d).toBeGreaterThan(600); expect(d).toBeLessThan(700);
});
test('zero distance', () => expect(distanceM({ lat: 1, lng: 1 }, { lat: 1, lng: 1 })).toBe(0));
test('formats coordinates with hemispheres', () => {
  expect(formatCoords(40.7128, -74.006)).toBe('40.7128N 74.0060W');
  expect(formatCoords(-33.8688, 151.2093)).toBe('33.8688S 151.2093E');
});
```

- [ ] **Step 4: Implement geo.ts (haversine)**

```ts
export interface LatLng { lat: number; lng: number }
const R = 6371000;
export function distanceM(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export function formatCoords(lat: number, lng: number): string {
  return `${Math.abs(lat).toFixed(4)}${lat >= 0 ? 'N' : 'S'} ${Math.abs(lng).toFixed(4)}${lng >= 0 ? 'E' : 'W'}`;
}
```

- [ ] **Step 5: Write failing stamp tests**

```ts
import { stampLines } from '@/lib/stamp';
test('stamp with gps', () => {
  expect(stampLines({ takenAt: '2026-10-17T14:42:00.000Z', lat: 40.7128, lng: -74.006 }, 'IBR', 'UTC'))
    .toEqual(['14:42 · OCT 17 2026', '40.7128N 74.0060W · IBR']);
});
test('stamp without gps', () => {
  expect(stampLines({ takenAt: '2026-10-17T14:42:00.000Z', lat: null, lng: null }, 'IBR', 'UTC')[1]).toBe('NO GPS · IBR');
});
```

- [ ] **Step 6: Implement stamp.ts**

```ts
import { formatCoords } from '@/lib/geo';
export function stampLines(p: { takenAt: string; lat: number | null; lng: number | null }, initials: string, timeZone?: string): [string, string] {
  const d = new Date(p.takenAt);
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone });
  const date = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric', timeZone }).toUpperCase().replace(',', '');
  const where = p.lat != null && p.lng != null ? formatCoords(p.lat, p.lng) : 'NO GPS';
  return [`${time} · ${date}`, `${where} · ${initials}`];
}
```

- [ ] **Step 7: Run tests, commit**

```bash
npx jest && npx tsc --noEmit
git add -A && git commit -m "Add models, plan limits, geo and stamp helpers"
```

---

### Task 3: Local database and store

**Files:**
- Create: `src/lib/db.ts`, `src/lib/store.ts`
- Test: `__tests__/db.test.ts` (uses an in-memory fake, see step 1)

**Interfaces:**
- Produces: `db.ready()`, `db.jobs.list()`, `db.jobs.upsert(job)`, `db.jobs.setStatus(id, status)`, `db.photos.listByJob(jobId)`, `db.photos.upsert(photo)`, `db.photos.setSync(id, state, patch)`, `db.queue.nextPending()`, `db.meta.get/set`; `useStore(selector)`, `notify()`.

- [ ] **Step 1: Write db.ts with schema**

Open with `openDatabaseAsync('crewlens.db')`. Schema:

```sql
create table if not exists meta (key text primary key, value text);
create table if not exists jobs (
  id text primary key, company_id text, name text, address text, client_name text,
  lat real, lng real, status text default 'active', cover_photo_id text,
  created_at text, updated_at text, archived_at text
);
create table if not exists photos (
  id text primary key, job_id text, company_id text, taker_id text, taker_initials text,
  kind text default 'photo', local_uri text, local_thumb_uri text, storage_path text, thumb_path text,
  width integer, height integer, duration_s real, taken_at text, lat real, lng real, accuracy_m real,
  sync_state text default 'pending', attempts integer default 0, last_error text, uploading_since text
);
create index if not exists photos_job on photos(job_id, taken_at desc);
create index if not exists photos_sync on photos(sync_state);
```

Row mappers convert snake_case to the camelCase models. `jobs.list()` joins a count of photos and pending photos and max(taken_at) per job.

- [ ] **Step 2: Write store.ts**

A module-level `listeners: Set<() => void>` with `notify()` and `useStore<T>(selector: () => T)` built on `useSyncExternalStore`. Every db write calls `notify()`.

- [ ] **Step 3: Test the mappers and the jobs aggregate SQL with a sql.js-free approach**

Put the SQL strings in `db.ts` exports and test `mapJobRow` and `mapPhotoRow` for null handling:

```ts
import { mapJobRow } from '@/lib/db';
test('maps nulls', () => {
  const j = mapJobRow({ id: 'a', company_id: 'c', name: 'n', address: '', client_name: null, lat: null, lng: null, status: 'active', cover_photo_id: null, created_at: 't', updated_at: 't', archived_at: null, photo_count: 0, pending_count: 0, last_photo_at: null });
  expect(j.lat).toBeNull(); expect(j.photoCount).toBe(0);
});
```

- [ ] **Step 4: Commit**

```bash
npx jest && npx tsc --noEmit && git add -A && git commit -m "Local SQLite schema and store"
```

---

### Task 4: Supabase project, schema, RLS, limits, buckets

**Files:**
- Create: `supabase/migrations/0001_init.sql`, `supabase/migrations/0002_limits.sql`, `supabase/migrations/0003_sharing.sql`, `src/lib/supabase.ts`

**Interfaces:**
- Produces: tables `companies, members, projects, photos, share_links, link_views, plan_limits`; function `get_shared_project(token text)`; `supabase` client; `.env.local` filled with URL and publishable key.

- [ ] **Step 1: Create the project** via the Supabase MCP: name `crewlens`, org `kucwakrnuohfvtbiaqtb`, region `us-east-1`. Poll `get_project` until `ACTIVE_HEALTHY`.

- [ ] **Step 2: Migration 0001_init.sql**

```sql
create extension if not exists pgcrypto;
create table companies (
  id uuid primary key default gen_random_uuid(), name text not null, trade text not null default 'other',
  tier text not null default 'pro' check (tier in ('solo','pro','crew')), seats int not null default 1,
  logo_path text, created_at timestamptz default now(), updated_at timestamptz default now()
);
create table members (
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','member')),
  display_name text not null, initials text not null,
  created_at timestamptz default now(), primary key (user_id, company_id)
);
create table projects (
  id uuid primary key, company_id uuid not null references companies(id) on delete cascade,
  name text not null, address text not null default '', client_name text,
  lat double precision, lng double precision,
  status text not null default 'active' check (status in ('active','archived')),
  cover_photo_id uuid, archived_at timestamptz,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create index projects_company on projects(company_id, status);
create table photos (
  id uuid primary key, project_id uuid not null references projects(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  taker_id uuid not null, taker_initials text not null default '',
  kind text not null default 'photo' check (kind in ('photo','video')),
  storage_path text not null, thumb_path text not null, width int, height int, duration_s real,
  taken_at timestamptz not null, lat double precision, lng double precision, accuracy_m real,
  device_id text, created_at timestamptz default now()
);
create index photos_project on photos(project_id, taken_at desc);

create or replace function my_company_ids() returns setof uuid language sql stable security definer set search_path = public as
$$ select company_id from members where user_id = auth.uid() $$;

alter table companies enable row level security;
alter table members enable row level security;
alter table projects enable row level security;
alter table photos enable row level security;

create policy companies_rw on companies for all using (id in (select my_company_ids())) with check (true);
create policy members_self on members for all using (user_id = auth.uid() or company_id in (select my_company_ids())) with check (user_id = auth.uid() or company_id in (select my_company_ids()));
create policy projects_rw on projects for all using (company_id in (select my_company_ids())) with check (company_id in (select my_company_ids()));
create policy photos_rw on photos for all using (company_id in (select my_company_ids())) with check (company_id in (select my_company_ids()));

insert into storage.buckets (id, name, public) values ('photos','photos',false), ('thumbs','thumbs',false) on conflict do nothing;
create policy photos_bucket_rw on storage.objects for all
  using (bucket_id in ('photos','thumbs') and (storage.foldername(name))[1]::uuid in (select my_company_ids()))
  with check (bucket_id in ('photos','thumbs') and (storage.foldername(name))[1]::uuid in (select my_company_ids()));
```

Storage object paths are `<company_id>/<project_id>/<photo_id>.jpg`.

- [ ] **Step 3: Migration 0002_limits.sql**

```sql
create table plan_limits (tier text primary key, active_projects int, photos_per_project int, videos_per_project int, video_max_s int, link_days int);
insert into plan_limits values ('solo',25,100,0,0,30), ('pro',100,250,10,60,null), ('crew',500,500,25,120,null);
alter table plan_limits enable row level security;
create policy plan_limits_read on plan_limits for select using (true);

create or replace function enforce_project_limit() returns trigger language plpgsql as $$
declare lim int; cnt int;
begin
  if new.status <> 'active' then return new; end if;
  select pl.active_projects into lim from companies c join plan_limits pl on pl.tier = c.tier where c.id = new.company_id;
  select count(*) into cnt from projects where company_id = new.company_id and status = 'active' and id <> new.id;
  if cnt >= lim then raise exception 'limit_active_projects' using errcode = 'P0001'; end if;
  return new;
end $$;
create trigger projects_limit before insert or update of status on projects for each row execute function enforce_project_limit();

create or replace function enforce_photo_limit() returns trigger language plpgsql as $$
declare lim int; cnt int;
begin
  select case when new.kind = 'video' then pl.videos_per_project else pl.photos_per_project end into lim
    from companies c join plan_limits pl on pl.tier = c.tier where c.id = new.company_id;
  select count(*) into cnt from photos where project_id = new.project_id and kind = new.kind;
  if cnt >= lim then raise exception 'limit_photos_per_project' using errcode = 'P0001'; end if;
  return new;
end $$;
create trigger photos_limit before insert on photos for each row execute function enforce_photo_limit();
```

- [ ] **Step 4: Migration 0003_sharing.sql**

```sql
create table share_links (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references companies(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  type text not null default 'live' check (type in ('live','gallery')),
  token text not null unique default encode(gen_random_bytes(9), 'base64url'),
  photo_ids uuid[], expires_at timestamptz, revoked_at timestamptz, frozen_at timestamptz,
  created_at timestamptz default now()
);
create table link_views (id bigserial primary key, link_id uuid references share_links(id) on delete cascade, viewed_at timestamptz default now(), ua_hash text);
alter table share_links enable row level security;
alter table link_views enable row level security;
create policy links_rw on share_links for all using (company_id in (select my_company_ids())) with check (company_id in (select my_company_ids()));
create policy views_read on link_views for select using (link_id in (select id from share_links where company_id in (select my_company_ids())));

create or replace function set_link_expiry() returns trigger language plpgsql as $$
declare days int;
begin
  select pl.link_days into days from companies c join plan_limits pl on pl.tier = c.tier where c.id = new.company_id;
  if days is not null and new.expires_at is null then new.expires_at := now() + make_interval(days => days); end if;
  return new;
end $$;
create trigger links_expiry before insert on share_links for each row execute function set_link_expiry();

-- freeze live links when a project is archived
create or replace function freeze_links_on_archive() returns trigger language plpgsql as $$
begin
  if new.status = 'archived' and old.status = 'active' then
    update share_links set frozen_at = now() where project_id = new.id and type = 'live' and frozen_at is null;
  end if;
  return new;
end $$;
create trigger projects_freeze after update of status on projects for each row execute function freeze_links_on_archive();

create or replace function get_shared_project(p_token text, p_ua_hash text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare l share_links; p projects; result jsonb;
begin
  select * into l from share_links where token = p_token;
  if not found or l.revoked_at is not null or (l.expires_at is not null and l.expires_at < now()) then
    return jsonb_build_object('status','expired');
  end if;
  select * into p from projects where id = l.project_id;
  insert into link_views(link_id, ua_hash) values (l.id, p_ua_hash);
  select jsonb_build_object(
    'status','ok','type',l.type,'name',p.name,'address',p.address,
    'photos', coalesce((select jsonb_agg(jsonb_build_object(
        'id',ph.id,'kind',ph.kind,'taken_at',ph.taken_at,'lat',ph.lat,'lng',ph.lng,'initials',ph.taker_initials,
        'width',ph.width,'height',ph.height,
        'url', storage_sign(ph.storage_path, 'photos'), 'thumb', storage_sign(ph.thumb_path, 'thumbs')
      ) order by ph.taken_at desc)
      from photos ph where ph.project_id = p.id
        and (l.photo_ids is null or ph.id = any(l.photo_ids))
        and (l.frozen_at is null or ph.created_at <= l.frozen_at)), '[]'::jsonb)
  ) into result;
  return result;
end $$;
grant execute on function get_shared_project(text, text) to anon, authenticated;
```

`storage_sign` is not a built-in. Instead the web page requests signed URLs through an Edge Function `share` that calls `get_shared_project`, then `storage.createSignedUrls` with the service role key, and returns the final JSON. Write the Edge Function in Task 12; in this migration return `storage_path` and `thumb_path` fields instead of `url` and `thumb`.

- [ ] **Step 5: Apply all three migrations through the MCP `apply_migration`, then verify with SQL**

```sql
-- as a smoke test
select tier, active_projects from plan_limits order by 1;
select proname from pg_proc where proname in ('get_shared_project','enforce_project_limit','enforce_photo_limit');
```

- [ ] **Step 6: Write supabase.ts**

```ts
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const storage = {
  getItem: (k: string) => SecureStore.getItemAsync(k),
  setItem: (k: string, v: string) => SecureStore.setItemAsync(k, v),
  removeItem: (k: string) => SecureStore.deleteItemAsync(k),
};
export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
  { auth: { storage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } }
);
```

- [ ] **Step 7: Fill `.env.local` with URL and publishable key; commit migrations and client**

```bash
git add supabase src/lib/supabase.ts && git commit -m "Supabase schema, RLS, plan limit triggers, sharing function"
```

---

### Task 5: Auth, company and onboarding screens

**Files:**
- Create: `src/lib/auth.ts`, `src/lib/company.ts`, `src/lib/plan.ts`, `src/app/(auth)/_layout.tsx`, `welcome.tsx`, `sign-in.tsx`, `name.tsx`, `company.tsx`, `permissions.tsx`, `paywall.tsx`, `src/components/button.tsx`, `src/components/stamp.tsx`
- Modify: `src/app/_layout.tsx` (auth gate)
- Test: `__tests__/plan.test.ts`, `__tests__/company.test.ts`

**Interfaces:**
- Produces: `useSession()`, `signInWithApple()`, `sendEmailCode(email)`, `verifyEmailCode(email, code)`, `signOut()`; `ensureCompany({ name, trade, displayName })`, `useCompany()`, `useMember()`; `currentTier()`, `limitsFor(tier)`, `paywallEnabled`; `initialsFor(name)`.

- [ ] **Step 1: plan.ts and its test**

```ts
import { PLAN_LIMITS } from '@/constants/limits';
import type { Tier } from '@/types/models';
export const paywallEnabled = process.env.EXPO_PUBLIC_PAYWALL_ENABLED === 'true';
export function effectiveTier(companyTier: Tier | null, hasEntitlement: boolean): Tier {
  if (!paywallEnabled) return companyTier ?? 'pro';
  return hasEntitlement ? (companyTier ?? 'solo') : 'solo';
}
export const limitsFor = (t: Tier) => PLAN_LIMITS[t];
```

Test: with the flag off, `effectiveTier(null, false)` is `'pro'`.

- [ ] **Step 2: company.ts with initials**

```ts
export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '???';
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return (parts[0][0] + parts[1][0] + (parts[2]?.[0] ?? parts[1][1] ?? '')).toUpperCase().slice(0, 3);
}
```

Test: `initialsFor('Ibrahim')` → `IBR`; `initialsFor('Jo Smith')` → `JOS`; `initialsFor('Ana Maria Lopez')` → `AML`.

`ensureCompany` inserts a `companies` row and a `members` row for `auth.uid()`, caches both in `meta` (`company`, `member`) and returns them. `useCompany` reads from the store.

- [ ] **Step 3: auth.ts**

Sign in with Apple via `expo-apple-authentication` → `supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken })`. Email: `signInWithOtp({ email })` then `verifyOtp({ email, token, type: 'email' })`. `useSession` subscribes to `onAuthStateChange`.

- [ ] **Step 4: Screens**

- `welcome`: canvas background, a large stamp mock as the hero (`Stamp` component with the current time and the user's rough location text "YOUR JOB SITE"), heading "Every photo, filed and stamped.", body line, Primary button "Get started".
- `sign-in`: "Continue with Apple" (black button, Apple guidelines), hairline, email field + "Send code", then 6-digit code field.
- `name`: text field, live `Stamp` preview showing initials updating as they type.
- `company`: company name field, trade chips: Roofing, HVAC, Plumbing, Electrical, Landscaping, Painting, Restoration, Remodeling, Cleaning, Inspection, Solar, Other.
- `permissions`: three rows (Camera, Location, Notifications) each with one explanatory line and a "Allow" ghost button that triggers the request; "Continue" enabled once camera is granted. Location denial is allowed.
- `paywall`: if `paywallEnabled` registers Superwall placement `onboarding_complete`; otherwise shows "Plans coming soon" and continues. Sets `meta.onboarded = '1'`.

Root `_layout` gate: no session → `(auth)`; session but no company → `(auth)/name`; else `(tabs)`.

- [ ] **Step 5: Commit**

```bash
npx expo lint && npx tsc --noEmit && npx jest && git add -A && git commit -m "Auth, company setup and onboarding"
```

---

### Task 6: Jobs: list, nearby ranking, create, archive

**Files:**
- Create: `src/lib/jobs.ts`, `src/app/(tabs)/_layout.tsx`, `src/app/(tabs)/index.tsx`, `src/app/job/new.tsx`, `src/components/job-row.tsx`, `src/components/empty.tsx`, `src/components/sheet.tsx`, `src/components/limit-sheet.tsx`
- Test: `__tests__/jobs.test.ts`

**Interfaces:**
- Produces: `rankJobs(jobs, here | null)` → `{ nearby: Job[]; recent: Job[]; all: Job[] }`; `createJob({ name, address, clientName, lat, lng })`; `archiveJob(id)`; `unarchiveJob(id)`; `useJobs()`; `useLocation()` (last known + watch).

- [ ] **Step 1: Failing rankJobs tests**

```ts
import { rankJobs } from '@/lib/jobs';
const job = (id: string, lat: number | null, lng: number | null, last: string | null) => ({ id, lat, lng, lastPhotoAt: last, status: 'active' }) as any;
test('nearby within 300m sorted by distance, excludes archived', () => {
  const here = { lat: 40.0, lng: -74.0 };
  const near = job('a', 40.001, -74.0, null);          // ~111 m
  const far = job('b', 40.01, -74.0, null);            // ~1.1 km
  const nearer = job('c', 40.0005, -74.0, null);       // ~55 m
  const r = rankJobs([near, far, nearer, { ...near, id: 'z', status: 'archived' }], here);
  expect(r.nearby.map((j) => j.id)).toEqual(['c', 'a']);
  expect(r.all.map((j) => j.id)).toEqual(['b']);
});
test('no location: nearby empty, recent by lastPhotoAt desc', () => {
  const r = rankJobs([job('a', 1, 1, '2026-01-01'), job('b', 1, 1, '2026-02-01'), job('c', 1, 1, null)], null);
  expect(r.nearby).toEqual([]);
  expect(r.recent.map((j) => j.id)).toEqual(['b', 'a']);
  expect(r.all.map((j) => j.id)).toEqual(['c']);
});
```

- [ ] **Step 2: Implement rankJobs**

```ts
export function rankJobs(jobs: Job[], here: LatLng | null) {
  const active = jobs.filter((j) => j.status === 'active');
  const withDist = active.map((j) => ({ j, d: here && j.lat != null && j.lng != null ? distanceM(here, { lat: j.lat, lng: j.lng }) : Infinity }));
  const nearby = withDist.filter((x) => x.d <= NEARBY_RADIUS_M).sort((a, b) => a.d - b.d).map((x) => x.j);
  const rest = active.filter((j) => !nearby.includes(j));
  const recent = rest.filter((j) => j.lastPhotoAt).sort((a, b) => (b.lastPhotoAt! > a.lastPhotoAt! ? 1 : -1)).slice(0, 10);
  const all = rest.filter((j) => !recent.includes(j)).sort((a, b) => a.name.localeCompare(b.name));
  return { nearby, recent, all };
}
```

- [ ] **Step 3: createJob with limit check**

Count local active jobs against `limitsFor(tier).activeJobs`; if at limit throw `new LimitError('active_jobs')`. Otherwise insert locally with a client UUID (`Crypto.randomUUID()` from `expo-crypto`, install it) and insert into Supabase `projects`; if Supabase raises `limit_active_projects`, delete the local row and throw `LimitError`.

- [ ] **Step 4: Tabs layout**

Five slots. Centre slot is a custom `tabBarButton` rendering a 56px `flag` circle with `camera.fill` symbol, raised 18px, which pushes `/camera` as a modal. Tab icons: `briefcase`, `clock`, `link`, `person`. Labels in `Fonts.heading` size 12.

- [ ] **Step 5: Jobs screen**

Header with company name (Heading 28), search icon, "New job" ghost button. Sections `Nearby`, `Recent`, `All`, `Archived` (collapsed). `JobRow`: 72px cover (`expo-image`, fallback a `surface` square with a `slate` `mappin` symbol), name, address, `Mono` line `"${timeAgo} · ${photoCount} photos"`, `flag` dot + pending count if `pendingCount > 0`. Empty state: "No jobs yet. Tap the camera to start one where you stand."

- [ ] **Step 6: New job sheet**

Fields: name (required), address (prefilled by reverse geocoding current location with `Location.reverseGeocodeAsync`), client (optional). Primary "Create job". On `LimitError` present `LimitSheet` ("You have 25 active jobs on Solo. Archive one, or upgrade.") with buttons "See archived" and "Upgrade" (Upgrade registers placement `upgrade_tapped` when the flag is on, otherwise closes).

- [ ] **Step 7: Commit**

```bash
npx expo lint && npx tsc --noEmit && npx jest && git add -A && git commit -m "Jobs tab with nearby ranking, create and archive"
```

---

### Task 7: Upload queue state machine and uploader

**Files:**
- Create: `src/lib/queue.ts`, `src/lib/uploader.ts`
- Test: `__tests__/queue.test.ts`

**Interfaces:**
- Produces: `nextState(item, event)` pure reducer; `backoffMs(attempt)`; `runQueue(deps)`; `startUploader()` (foreground + network listeners); `retryFailed()`.

- [ ] **Step 1: Failing reducer tests**

```ts
import { nextState, backoffMs, STALE_UPLOADING_MS } from '@/lib/queue';
const item = (over = {}) => ({ syncState: 'pending', attempts: 0, uploadingSince: null, ...over }) as any;
test('pending -> uploading', () => expect(nextState(item(), { type: 'start', now: 't' }).syncState).toBe('uploading'));
test('uploading -> synced', () => expect(nextState(item({ syncState: 'uploading' }), { type: 'ok' }).syncState).toBe('synced'));
test('failure increments and returns to pending until max', () => {
  const s = nextState(item({ syncState: 'uploading', attempts: 7 }), { type: 'error', message: 'x' });
  expect(s).toMatchObject({ syncState: 'failed', attempts: 8, lastError: 'x' });
  const s2 = nextState(item({ syncState: 'uploading', attempts: 2 }), { type: 'error', message: 'x' });
  expect(s2).toMatchObject({ syncState: 'pending', attempts: 3 });
});
test('stale uploading resets to pending', () => {
  const s = nextState(item({ syncState: 'uploading', uploadingSince: new Date(Date.now() - STALE_UPLOADING_MS - 1).toISOString() }), { type: 'sweep', now: new Date().toISOString() });
  expect(s.syncState).toBe('pending');
});
test('backoff doubles from 2s and caps at 5 min', () => {
  expect(backoffMs(1)).toBe(2000); expect(backoffMs(2)).toBe(4000); expect(backoffMs(20)).toBe(300000);
});
```

- [ ] **Step 2: Implement queue.ts**

```ts
export const STALE_UPLOADING_MS = 2 * 60 * 1000;
export type QueueEvent = { type: 'start'; now: string } | { type: 'ok' } | { type: 'error'; message: string } | { type: 'sweep'; now: string } | { type: 'retry' };
export function nextState<T extends { syncState: SyncState; attempts: number; uploadingSince: string | null; lastError?: string | null }>(item: T, e: QueueEvent): T {
  switch (e.type) {
    case 'start': return { ...item, syncState: 'uploading', uploadingSince: e.now };
    case 'ok': return { ...item, syncState: 'synced', uploadingSince: null, lastError: null };
    case 'error': {
      const attempts = item.attempts + 1;
      return { ...item, attempts, lastError: e.message, uploadingSince: null, syncState: attempts >= MAX_UPLOAD_ATTEMPTS ? 'failed' : 'pending' };
    }
    case 'sweep':
      if (item.syncState === 'uploading' && item.uploadingSince && Date.parse(e.now) - Date.parse(item.uploadingSince) > STALE_UPLOADING_MS) return { ...item, syncState: 'pending', uploadingSince: null };
      return item;
    case 'retry': return item.syncState === 'failed' ? { ...item, syncState: 'pending', attempts: 0, lastError: null } : item;
  }
}
export const backoffMs = (attempt: number) => Math.min(2000 * 2 ** (attempt - 1), 300000);
```

- [ ] **Step 3: uploader.ts**

`runQueue` loop: sweep stale, pick oldest `pending` whose `attempts === 0` or whose backoff has elapsed (track `lastAttemptAt` in `meta` keyed by photo id or add a column `next_attempt_at`; use the column). For each: ensure the job exists remotely (upsert `projects` row from local), read thumb bytes with `new File(uri).bytes()`, `supabase.storage.from('thumbs').upload(path, bytes, { contentType: 'image/jpeg', upsert: true })`, same for full, then `supabase.from('photos').upsert(row, { onConflict: 'id', ignoreDuplicates: true })`. On a `limit_photos_per_project` error mark `failed` with that message and do not retry. Run one at a time. Trigger on `AppState` active and on `NetInfo`-free approach: a 30 s interval while the app is active plus an immediate run after every capture.

- [ ] **Step 4: Commit**

```bash
npx jest && npx tsc --noEmit && git add -A && git commit -m "Upload queue state machine and uploader"
```

---

### Task 8: Capture pipeline

**Files:**
- Create: `src/lib/photos.ts`
- Test: `__tests__/photos.test.ts` (pure parts: path builder, dimension maths)

**Interfaces:**
- Produces: `capture({ jobId, uri, width, height, location })` → `Photo`; `storagePaths(companyId, jobId, photoId)` → `{ full, thumb }`; `targetSize(w, h, longEdge)`.

- [ ] **Step 1: Tests**

```ts
import { storagePaths, targetSize } from '@/lib/photos';
test('paths', () => expect(storagePaths('c', 'j', 'p')).toEqual({ full: 'c/j/p.jpg', thumb: 'c/j/p.jpg' }));
test('target size keeps ratio', () => {
  expect(targetSize(4032, 3024, 2048)).toEqual({ width: 2048, height: 1536 });
  expect(targetSize(3024, 4032, 2048)).toEqual({ width: 1536, height: 2048 });
  expect(targetSize(1000, 500, 2048)).toEqual({ width: 1000, height: 500 });
});
```

- [ ] **Step 2: Implement**

`capture`: generate UUID; compute `targetSize`; `ImageManipulator.manipulate(uri).resize(size).renderAsync()` then `saveAsync({ compress: 0.82, format: SaveFormat.JPEG })`; same for thumb at 320 with 0.7; move both into `new Directory(Paths.document, 'photos', jobId)` (create if missing) as `<id>.jpg` and `<id>.thumb.jpg`; delete the camera cache file; insert local photo row `pending`; if job has no cover set it; `notify()`; kick `runQueue`.

- [ ] **Step 3: Commit**

```bash
npx jest && npx tsc --noEmit && git add -A && git commit -m "Capture pipeline: compress, thumbnail, store, enqueue"
```

---

### Task 9: Camera screen with job strip and stamp flash

**Files:**
- Create: `src/app/camera.tsx`, `src/components/job-chip-strip.tsx`
- Modify: `src/app/_layout.tsx` (register `camera` as `presentation: 'fullScreenModal'`)

**Interfaces:**
- Consumes: `rankJobs`, `useLocation`, `capture`, `createJob`, `Stamp`, `limitsFor`.

- [ ] **Step 1: Build the screen**

- `CameraView` fills the screen, `facing` state, `flash` state, `onCameraReady`.
- Top bar: close (`xmark`), flash toggle, flip. Icons in `onCamera`.
- Bottom: `JobChipStrip` (horizontal `FlatList`): first chip `+ New job here` then nearby jobs then recent. Selected chip has `flag` background. Default selection: first nearby job if any, else `+ New job here`. Tapping `+ New job here` opens `job/new` as a sheet with location prefilled; on return the new job becomes selected.
- Shutter: 72px `flag` circle with 4px `onCamera` ring. On press: `Haptics.impactAsync(Medium)`, `ref.takePictureAsync({ quality: 1, skipProcessing: false })`, then `capture(...)` with the latest location fix (`Location.getLastKnownPositionAsync` with a 5 s `getCurrentPositionAsync` fallback started when the screen mounts).
- After capture: a `Stamp` fades in bottom-left for 1.2 s; the selected chip's badge increments.
- Long-press shutter: if `limitsFor(tier).videosPerJob === 0` show a one-line toast "Video is on Pro and Crew." Otherwise phase 3; for now the same toast says "Video is coming soon."
- If location permission is denied: strip shows recent then all; stamp shows `NO GPS`.

- [ ] **Step 2: Manual test on simulator**

Simulator camera is unavailable; use `expo run:ios --device` on the iPhone over USB. Take 3 photos on two jobs, airplane mode on for one of them, confirm rows become `synced` after reconnecting (Task 10's grid shows it).

- [ ] **Step 3: Commit**

```bash
npx expo lint && npx tsc --noEmit && git add -A && git commit -m "Camera with nearest-job strip and stamp"
```

---

### Task 10: Job screen, grid and viewer

**Files:**
- Create: `src/app/job/[id].tsx`, `src/app/photo/[id].tsx`, `src/components/photo-tile.tsx`
- Test: `__tests__/group.test.ts` (day grouping)

**Interfaces:**
- Produces: `groupByDay(photos, timeZone?)` → `{ key: string; label: string; photos: Photo[] }[]`.

- [ ] **Step 1: Test grouping**

```ts
import { groupByDay } from '@/lib/photos';
test('groups by local day newest first with label', () => {
  const g = groupByDay([{ id: 'a', takenAt: '2026-10-17T10:00:00Z' }, { id: 'b', takenAt: '2026-10-16T10:00:00Z' }, { id: 'c', takenAt: '2026-10-17T12:00:00Z' }] as any, 'UTC');
  expect(g.map((x) => x.key)).toEqual(['2026-10-17', '2026-10-16']);
  expect(g[0].photos.map((p) => p.id)).toEqual(['c', 'a']);
  expect(g[0].label).toBe('FRI OCT 17 · 2 PHOTOS');
});
```

- [ ] **Step 2: Job screen**

Hero 240px cover image with dark scrim, name (Heading 30 in `surface`) and address (Body `surface` 80 percent). Action row: Camera (opens `/camera?jobId=`), Share (opens share sheet, Task 11), More (menu: Edit, Archive or Unarchive, Delete with confirm). Grid: `SectionList` by day, 3 columns, 2px gaps, each `PhotoTile` shows thumb (`expo-image` from `localThumbUri` or signed remote), a `Mono` 10px time at bottom-left, a `flag` dot top-right when not synced, a red `exclamationmark.triangle` when `failed` (tap to retry). Banner above grid when any `failed`: "3 photos failed to upload. Retry".

- [ ] **Step 3: Viewer**

Horizontal paging `FlatList` of the job's photos, `camera` background, pinch-zoom via `expo-image` `contentFit="contain"` (no custom zoom in phase 1), bottom bar: `Stamp` + taker name, actions: Share photo (burn the stamp into a copy via `ImageManipulator` is phase 2; phase 1 shares the file as is), Save to Photos (`expo-media-library`, install), Delete (confirm, removes local file and remote row).

- [ ] **Step 4: Commit**

```bash
npx expo lint && npx tsc --noEmit && npx jest && git add -A && git commit -m "Job screen with day-grouped grid and viewer"
```

---

### Task 11: Live share link

**Files:**
- Create: `src/lib/links.ts`, share sheet inside `src/app/job/[id].tsx`
- Test: `__tests__/links.test.ts`

**Interfaces:**
- Produces: `getOrCreateLiveLink(jobId)` → `ShareLink`; `linkUrl(token)`; `SHARE_BASE_URL`.

- [ ] **Step 1: Test**

```ts
import { linkUrl } from '@/lib/links';
test('builds url', () => expect(linkUrl('abc')).toBe(`${process.env.EXPO_PUBLIC_SHARE_BASE_URL ?? 'https://crewlens-share.vercel.app'}/s/abc`));
```

- [ ] **Step 2: Implement**

Select existing `share_links` where `project_id = jobId and type = 'live' and revoked_at is null`; else insert `{ company_id, project_id, type: 'live' }` and read back `token, expires_at`. Share sheet: two rows, "Live link to this job" (subtitle: "Always shows the latest photos" or "Expires in 30 days" on Solo) and "Pick photos" (disabled with "Phase 2" caption). Tapping the live row: `Clipboard.setStringAsync(url)`, then `Share.share({ url })`.

- [ ] **Step 3: Commit**

```bash
npx jest && npx tsc --noEmit && git add -A && git commit -m "Live share links"
```

---

### Task 12: Share page (Edge Function + Vercel static page)

**Files:**
- Create: `supabase/functions/share/index.ts`, `web/index.html`, `web/s/[token]` handled by `web/vercel.json` rewrite to `index.html`, `web/app.js`, `web/styles.css`

**Interfaces:**
- Edge Function `GET /functions/v1/share?token=` → `{ status: 'ok' | 'expired', name, address, photos: [{ id, taken_at, lat, lng, initials, url, thumb, width, height }] }`.

- [ ] **Step 1: Edge Function**

Deno. Reads `token`, hashes `user-agent` with SHA-256, calls `supabase.rpc('get_shared_project', { p_token, p_ua_hash })` with the service role client, then `storage.from('photos').createSignedUrls(paths, 3600)` and the same for thumbs, merges and returns JSON with `Cache-Control: no-store`. Deploy with the Supabase MCP `deploy_edge_function`.

- [ ] **Step 2: Web page**

Single static page. Same tokens as the app (`#E9E7E1` canvas, Barlow Condensed via Google Fonts, JetBrains Mono for stamps). Header: job name, address, `Mono` "Live · updated just now" or "Gallery". Grid by day with stamps under each thumbnail. Click opens a lightbox with the full image and stamp. Footer "Shared with Crew Lens". Expired state: heading "This link has expired", body "Ask the contractor for a new one." Error state: "Couldn't load this job. Try again."

- [ ] **Step 3: Deploy to Vercel**

```bash
cd web && npx vercel --prod --yes --name crewlens-share
```

Set `EXPO_PUBLIC_SHARE_BASE_URL` in `.env.local` to the deployed URL.

- [ ] **Step 4: Test** by opening a real token in Safari and a fake token; commit.

```bash
git add -A && git commit -m "Public share page and edge function"
```

---

### Task 13: You tab, analytics, attribution, Superwall stub

**Files:**
- Create: `src/app/(tabs)/you.tsx`, `src/app/(tabs)/activity.tsx`, `src/app/(tabs)/shared.tsx`, `src/lib/analytics.ts`, `src/lib/paywall.tsx`
- Modify: `src/app/_layout.tsx` (providers)

- [ ] **Step 1: Copy `analytics.ts` from CostCook** verbatim except the Apple App ID env name; events listed in the spec section 5 are added at their call sites (`job_created`, `photo_captured` with `offline`, `photo_synced`, `sync_failed`, `link_created`, `job_archived`, `onboarding_step`).

- [ ] **Step 2: Copy `paywall.tsx` from CostCook**, change placements to `'onboarding_complete' | 'subscription_lapsed' | 'upgrade_tapped'`, and wrap `SuperwallProvider` in `_layout` only when `paywallEnabled && EXPO_PUBLIC_SUPERWALL_API_KEY` is set.

- [ ] **Step 3: You tab**

Rows: Profile (name, initials stamp preview), Company (name, trade), Plan (tier label, usage `Mono` "12 of 100 active jobs", bar in `slate`), Manage subscription (opens `itms-apps://apps.apple.com/account/subscriptions`), Restore purchases (flag-gated), Support (mailto support@davoxa.com), Privacy, Terms, Sign out.

- [ ] **Step 4: Activity and Shared** show `Empty` with "Coming in the next update." so the bar is complete.

- [ ] **Step 5: Commit**

```bash
npx expo lint && npx tsc --noEmit && npx jest && git add -A && git commit -m "You tab, analytics, attribution, paywall stub"
```

---

### Task 14: EAS, Maestro flows, device install

**Files:**
- Create: `eas.json`, `.maestro/onboarding.yaml`, `.maestro/job-and-photo.yaml`, `.maestro/share-link.yaml`

- [ ] **Step 1: eas.json** copied from CostCook with the `submit.production.ios.ascAppId` left blank until the ASC app exists. `npx eas-cli init --id` to create the EAS project and write `extra.eas.projectId`.

- [ ] **Step 2: Maestro flows**

`onboarding.yaml`: launch, tap "Get started", tap email, type test email, assert code field visible.
`job-and-photo.yaml`: assumes signed in; tap "New job", type "Maestro House", tap "Create job", assert "Maestro House" visible, tap camera, tap shutter, back, open job, assert a tile exists.
`share-link.yaml`: open job, tap Share, tap "Live link to this job", assert "Copied" toast.

- [ ] **Step 3: Build and install on device**

```bash
export LANG=en_US.UTF-8
npx expo prebuild --platform ios --clean
npx expo run:ios --device --configuration Release
```

Follow `costcook-build-gotchas` for the UTF-8 and RN-from-source environment.

- [ ] **Step 4: Run flows, fix, commit, push**

```bash
maestro test .maestro
git add -A && git commit -m "EAS config, Maestro flows" && git push
```

---

## Self-review

- Spec coverage: onboarding (T5), paywall deferred by flag (T5, T13), jobs and nearby (T6), camera and stamp (T8, T9), offline queue (T7), job grid and viewer (T10), live link (T11), share page (T12), archive and link freeze (T4, T6), You tab usage (T13), analytics (T13), tests (every task), device install (T14). Gallery links, Activity, Shared, tags, annotations, team, video, reports, map are Phase 2 and 3 as the spec states.
- Review Focus items each have a home: 1 in T6/T9, 2 and 3 in T7/T4, 4 in T6, 5 in T12.
- Names are consistent: `rankJobs`, `capture`, `nextState`, `runQueue`, `getOrCreateLiveLink`, `stampLines`, `effectiveTier`, `limitsFor`.
