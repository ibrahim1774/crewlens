# Crew Lens

Job-site photo documentation for contractors. Open the camera, the nearest job is already selected, every photo carries a time / GPS / person stamp, and a whole job shares with one link.

- Spec: `docs/superpowers/specs/2026-10-17-crew-lens-design.md`
- Phase 1 plan: `docs/superpowers/plans/2026-10-17-crew-lens-phase-1.md`
- Share page: https://crewlens-share.vercel.app (source in `web/`)

## Run

```bash
npm install
npx expo run:ios --device "iPhone 17" --port 8082   # simulator
npx expo run:ios --device                             # pick a connected iPhone
npm test && npm run lint && npm run typecheck
```

Local native builds on this Mac need `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`.

## Configuration

Secrets live in the gitignored `.env.local`. Public values use the `EXPO_PUBLIC_` prefix:

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | backend; the app runs local-only without them |
| `EXPO_PUBLIC_SHARE_BASE_URL` | share page origin (defaults to the Vercel URL) |
| `EXPO_PUBLIC_PAYWALL_ENABLED` | `true` turns on the Superwall gate; off means everyone gets Pro limits |
| `EXPO_PUBLIC_SUPERWALL_API_KEY` | Superwall iOS public key |
| `EXPO_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_APPSFLYER_DEV_KEY`, `EXPO_PUBLIC_APPLE_APP_ID` | analytics and attribution |

## Backend setup (once)

1. Create a Supabase project (org IBRAHIM SAAS, us-east-1).
2. Apply `supabase/migrations/0001_init.sql`, `0002_limits.sql`, `0003_sharing.sql` in order.
3. Deploy `supabase/functions/share` with JWT verification off (it authenticates by share token and uses the service role internally).
4. Put the project URL and publishable key in `.env.local`.
5. Set `window.CREWLENS_SHARE_ENDPOINT` in `web/config.js` to `https://<ref>.supabase.co/functions/v1/share` and redeploy `web/` with `vercel deploy --prod`.

## Tests

- Unit: `npm test` (Jest, native modules mocked in `test/mocks/`).
- UI: Maestro flows in `.maestro/` (needs `JAVA_HOME=/opt/homebrew/opt/openjdk@17`).
