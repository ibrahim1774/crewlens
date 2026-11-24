# Crew Lens web checkout (Stripe, test mode) — plan 2026-11-24

Owner decisions: own Stripe Checkout (not Superwall web), test mode first (live keys from a new Stripe account later; all keys/prices from env), same prices as App Store (Solo $9.99/mo $79.99/yr, Pro $19.99/mo $159.99/yr with 3-day trial, Crew $49.99/mo $399.99/yr), never show yearly as a monthly figure. Apple IAP via Superwall stays for everyone else.

## Findings
- Tier comes from server `companies.tier`; only `src/lib/documents.ts` reads per-device `hasEntitlement()` (so crew members of a paying company are wrongly unentitled for documents today).
- Paywall entry points: `src/lib/gate.ts`, `src/app/(auth)/setup.tsx` → `(auth)/paywall.tsx` (auto-opens Superwall), upgrade points in `you.tsx`, `team.tsx`, `job/[id]/documents.tsx`, `components/limit-sheet.tsx`. `subscription_lapsed` unused.
- Trigger `protect_billing_columns` blocks non-service-role tier UPDATEs (not INSERTs). `companies.tier` defaults to 'pro'.
- `superwall-webhook` downgrades to solo on Apple expiry → would revoke a Stripe payer. Both webhooks must go through one function.

## Design
- Subscription belongs to the USER; the app's normal onboarding creates the company; the paywall step auto-passes.
- One table of subscriptions (apple + stripe); `apply_billing(user)` sets the highest active tier.
- Payment is claimed by a signed-in account via a one-time server-checked claim of the Checkout session id. Never link by email (Confirm email is off).

## Tasks
- T1 migration `0011_web_billing.sql`: `billing_subscriptions` (source, external_id, user_id nullable, tier, period, status, current_period_end, cancel_at_period_end, stripe_customer_id, checkout_session_id unique, livemode, updated_at; RLS, no client access), `stripe_events` (dedupe), `apply_billing(p_user)` (service role; bypass trigger via `set_config('crewlens.billing','on',true)`), `create_company_with_owner` sets tier from active rows, `my_entitlement()` for any member.
- T2 `supabase/functions/_shared/billing-rules.ts` pure: planFromKey, isEntitled, mergeTier, trialDaysFor + jest tests.
- T3 `stripe-checkout`: `{plan, period}` → price from env `STRIPE_PRICE_{TIER}_{PERIOD}`, subscription mode, trial 3 days Pro only, success `/welcome?cs={CHECKOUT_SESSION_ID}`, cancel `/start`; 409 if signed-in user has active Apple sub; CORS = SITE_URL.
- T4 `stripe-webhook`: raw-body signature check (constructEventAsync + SubtleCrypto), dedupe, handle checkout.session.completed, customer.subscription.*, invoice.paid/payment_failed; refetch subscription; upsert; apply_billing; livemode guard; delete dedupe row on 500.
- T5 `stripe-claim` (auth): `{cs}` → session complete → atomic claim where user_id is null → metadata.user_id on customer/sub → apply_billing.
- T6 `stripe-portal` (auth): Billing Portal session, return `/account`.
- T7 `supabase/config.toml` verify_jwt=false for the four (each checks token itself).
- T8 `superwall-webhook`: upsert apple row + apply_billing (keep stale-expiration guard).
- T9 `delete-account`: cancel Stripe subs, delete billing rows.
- T10 web: `config.js` (SUPABASE_URL, anon key, SITE_URL), `start.html/js` (3 cards, monthly/yearly, "$79.99/yr"), `welcome.html/js` (sign up/in → claim → App Store link; keep cs in localStorage), `account.html` (plan + Manage billing), noindex /welcome /account.
- T11 app `src/lib/billing.ts`: refreshEntitlement via rpc my_entitlement, cached; webEntitled(), billingSource(), billingReady; refresh on session change, foreground, after membership fetch.
- T12 `paywall.tsx`: hasEntitlement = superwall || web; placements skip Superwall and call onAccess when web-entitled (wait billingReady ≤3 s).
- T13 `(auth)/paywall.tsx`: web-entitled → finish() on mount.
- T14 upgrade points for stripe payers: plain text "Your plan is billed on the web. Change it from your Crew Lens account online." (no link, no price). Delete-account copy mentions web sub cancelled.
- T15 tests: web entitlement skips placement; highest tier wins; Apple lapsed + Stripe active keeps access; crew member of web company; signed-in buyer with no company passes onboarding.

## App Store (verify current text before submitting)
3.1.3(b) multiplatform: unlocking web purchases is fine since the same plans are sold via IAP. v1: no web prices/links/buttons in the app. Keep Superwall IAP + Restore. Add a review note.

## Test plan
Cards 4242… success, 4000 0025 0000 3155 3DS, …9995 decline, …0341 renewal fail (past_due). Test clocks for renewal/trial end. Test-mode webhook endpoint at the Supabase function URL; replay events to check dedupe. Simulator: new web buyer, existing owner buys on web, crew member, cancel in portal, Apple+Stripe with Apple expired, delete account. `npm test` stays green.

## Rollout
T1–T2 → db push → secrets → deploy T3–T9 → Stripe endpoint + portal → web (preview then prod) → app build with T11–T15 → only then link /start from marketing → later live keys.

## By hand
Stripe test products/prices (scriptable), portal config, webhook endpoint; Supabase secrets STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, 6 STRIPE_PRICE_*, SITE_URL; Supabase Auth redirect URL; ASC review note; Superwall web checkout off.

## v1 defaults chosen for open questions
Web sign-in email+password only; trial not blocked for prior Apple trial users; unclaimed payments recovered via /welcome link (localStorage) + Stripe receipt; refunds/disputes handled by hand; portal = cancel + update card only (no plan switching).

## Revision 2 (2026-11-24, after owner chose primehub.dev + full re-review)
- Pages live on primehub.dev as static files in the PrimeHub repo `public/crewlens/` (start, welcome, account). vercel.json has no catch-all, so /crewlens/ is free; the React app is untouched. Fresh worktree from origin/main (90b7e59); preview first, production only on a separate go.
- Accounts + billing stay in the Crew Lens Supabase (dlyeaquyqtcqcsazjorl). PrimeHub's Supabase (bziohcvejdgbpuyalpqb) is NOT used: the app signs in against Crew Lens's database, a PrimeHub login would not work in the app.
- Stripe: PrimeHub's account (test key in ~/.primehub-pro-secrets/stripe-primehub-test.env). metadata.app='crewlens' on session + subscription_data + customer. Verified: PrimeHub old webhook, PrimeHub Pro webhook (incl. refund/dispute handler) and Prime Barber web-app webhook all ignore other app tags. Crew Lens webhook ignores anything not tagged crewlens / not one of its 6 prices. Dedicated Billing Portal configuration (never edit the account default). Cards only (Apple/Google Pay included).
- Test-mode safety: test checkout only on a protected preview; webhook/claim apply test-mode payments only for allowlisted emails, so a 4242 card can never unlock the live app. Production pages ship with live keys only.
- protect_billing_columns already lets service_role through: no set_config bypass.
- apply_billing is a no-op when the user has zero billing rows (existing Apple payers keep their tier until their next Apple event writes a row).
- App entitlement = Superwall ACTIVE OR server my_entitlement() active (Apple payers keep working via Superwall on device).
- Loophole found: Apple/Google sign-in on the Sign in screen creates a non-guest account; routeFor sends a non-guest with a company straight to tabs and companies.tier defaults to 'pro', so quitting before the paywall gives Pro limits unpaid (documents still locked). Fix: owner without an active entitlement (Superwall or server) is routed to the paywall.
- CORS on new edge functions: https://primehub.dev + the preview origin.
- Ships in ONE new 1.0.1 build together with Word support (build 6 is not submitted).
