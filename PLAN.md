# Invitation-only social app: implementation and completion plan

Updated: 2026-10-06. Workspace: `F:\vs_codes\app\selling`.

## 1. Purpose and how to use this plan

Build a clean, minimal, mobile-first Instagram-style app for Android and iOS using Clerk, Convex, Expo Router native tabs, and NativeWind. This file records the agreed product and the sequence for finishing it later.

**This repository already contains a substantial local implementation. Do not restart or scaffold over it.** Inspect the existing code, preserve working behavior, complete missing integration, and validate each phase. An unchecked item below means its end-to-end acceptance is still outstanding; it does not necessarily mean its code is missing.

For each phase:

1. Inspect the referenced files and current repository instructions.
2. Confirm relevant installed versions and matching official documentation before changing APIs.
3. Implement or repair only what the phase requires.
4. Run the listed acceptance checks and record evidence.
5. Update this plan with completed items, unresolved issues, and the next step.

Do not silently replace providers, weaken permissions, add paid resources, or expand scope to get a check to pass. Development deployment, production release, and store submission are distinct steps. No automatic production release is planned.

## 2. Current baseline

### Existing local implementation

- Four native mobile tabs, social screens, sign-in/onboarding, profile/settings, and a web admin dashboard.
- Convex schema and functions for invitations, entitlements, social relationships, posts, messages, authorization, media, moderation, deletion, and scheduled work.
- Protected media endpoints, foreground persistent outbox, idempotency, and account-switch rejection.
- English/Urdu copy, RTL text/layout handling, system appearance, notification preferences, and Expo push workflow.
- Environment templates, EAS profiles, release checker, test suite, and setup documentation.

### Previously completed local checks

- [x] 33 domain/backend tests passed.
- [x] Expo lint and TypeScript checks passed.
- [x] Expo Doctor passed 21/21 checks.
- [x] Android/iOS Hermes and web bundle exports succeeded.
- [x] Unconfigured setup and policy pages passed browser checks in mobile English, desktop dark mode, and mobile Urdu.
- [x] Urdu heading spacing was corrected and visually reviewed.

These are recorded local results, not guarantees about future revisions. Re-run relevant checks when resuming. Bundle exports are **not signed installable builds**. Browser coverage does not include authenticated social/admin journeys.

### Still unverified or externally blocked

- Clerk/Convex deployment configuration and real Google/Apple sign-in.
- Signed Android/iOS installation and device acceptance.
- Protected video playback/seeking, token refresh, push delivery, and queue recovery on phones.
- Live Urdu search quality and human translation/accessibility review.
- Provider spending controls enforcing the US$25 monthly ceiling.
- Reviewer assignment, production operations, final identity/store materials, and qualified safety/privacy review.
- Dependency advisory review: do not run `npm audit fix --force` into incompatible framework versions.

See [implementation status](docs/IMPLEMENTATION.md), [setup guide](README.md), and [release gates](docs/RELEASE.md).

## 3. Fixed product decisions

### Platforms and navigation

- Android and iOS contain the social app.
- Main native tabs: **Home, Messages, Explore, Profile**.
- Home header `+` opens post creation; activity, settings, saved posts, and detail screens are secondary routes.
- Web exposes admin sign-in/dashboard and required support/policy pages. A full public web social app is out of scope.
- Modern, minimal interface; readable contrast, accessible controls, system light/dark appearance, English and Urdu, RTL layouts.

### Authentication and onboarding

- Google and Apple sign-in through Clerk; secure sessions, no separate password system.
- Clerk identity is the application identity. Never identify or merge users by display name.
- Accept Clerk's verified-email account linking; test private-relay and different-email behavior.
- Flow: sign-in → invitation → private birth date → unique username/display name → optional profile details → skippable follow suggestions → Home.
- Reject onboarding for users under 13. Birth dates remain private; corrections require admin review.
- Complete invitation redemption, profile activation, and entitlement creation atomically. One Clerk user maps to one application profile.
- Returning users resume the proper state: unfinished onboarding, active account, suspension explanation, or deletion state.

### One free year

- Every user gets one free year beginning when invitation redemption and onboarding finish.
- Store `freeAccessStartedAt` and `freeAccessEndsAt` once. Retries and repeat logins never reset them.
- End at the next calendar anniversary in UTC; February 29 maps to February 28 in a non-leap year.
- Pricing is undecided. V1 has no billing, payment details, automatic renewal, charges, or access cutoff after the free year.
- Expired users retain normal access under the explicit pricing-not-launched policy.

### Social behavior

- Home: newest eligible posts from followed users, with pagination and useful empty states.
- Explore: recent eligible posts, people search, and caption search.
- One library-selected image or video per post; optional caption and mentions.
- Like/unlike, follow/unfollow, flat comments, caption/comment editing, and deletion of one's own posts/comments.
- Private bookmarks and sharing post references into eligible conversations.
- Profile: username, display name, photo, bio, website, optional typed location; no location permission required for typed location.
- Muted video autoplay on Wi-Fi by default; all-networks and never options. Pause off-screen/background playback.

### Messaging and age boundaries

- One-to-one messages: text, images, videos, shared posts, unread counts, and read receipts.
- Sending requires mutual follows, the same current age group, active accounts, and no blocking relationship.
- Recheck eligibility on every send, upload publication, queued retry, and relevant media request.
- Unfollowing makes existing chats read-only. Blocking prevents interaction and hides blocked content.
- Teen and adult discovery/interaction stay separate throughout the application.
- At 18: archive earlier posts for their owner, remove cross-age follows, and make cross-age chats read-only.
- Authorization must remain correct before scheduled cleanup catches up.
- Shared references do not grant access. Inaccessible content displays `Post unavailable` without leaking captions or media.

### Media and local work

- Images: JPEG/PNG/WebP, at most 10 MB. Videos: MP4, at most 15 MB and 60 seconds.
- Validate on the server as well as the client; unsupported/oversized media gets clear feedback.
- No automatic video compression, transcoding, camera capture, or editor in v1.
- All protected files use authenticated endpoints; no public storage URLs in client data.
- Native media supports authenticated range requests and refreshed tokens. Web evidence viewing must authenticate its fetches too.
- Persist pending sends/uploads in account-scoped SQLite metadata and app-sandbox files.
- Retry only while the app is open and connected. Use stable operation IDs and expected-user identity to prevent duplicates and cross-account publication.
- Show pending/sending/failed/paused states. Allow cancellation before sending starts and explicit retry/resume controls.
- Quota-paused work requires explicit resumption. Clear local content on account deletion.
- Track upload reservation, validation, publication, and abandonment; clean unused files.

### Notifications

- Expo push service with per-category switches and OS permission handling.
- DM push previews identify the sender without including message text/media.
- Recheck authorization/preferences before sending and before opening the destination.
- Handle invalid tokens, delivery tickets/receipts, retries, and unavailable destinations.
- Keep push disabled until the appropriate environment is configured and verified.

### Moderation and deletion

- Admin web tools: invitations, reports, evidence, content removal, timed/indefinite suspension, reinstatement, birth-date corrections, appeals, and usage controls.
- Primary owner handles daily moderation; a limited independent backup reviewer handles conflicts and appeals of the owner's decisions.
- Record privileged actions; prevent review of one's own conflicts. Reviewers cannot browse arbitrary private messages.
- Suspended users can read their explanation, appeal, and delete their account.
- Account deletion removes social content and sent media. Retained conversation text is labeled `Deleted user`.
- Preserve only reported evidence for review/appeal, restrict access, and delete it 30 days after closure. An open appeal prevents expiry.
- Disclose retention exceptions. Restoring a moderation decision must not restore author-deleted content or a deleted account.
- Messages and local queue storage are not end-to-end encrypted; do not claim otherwise.

### Explicitly out of scope

Carousels, capture/editing, threaded replies, hashtags, typing/online presence, sent-message deletion, background sending, payments, ads, product analytics, and a public web social client.

## 4. Stack, boundaries, and repository map

Retain the selected baseline; verify the lockfile when resuming:

| Component | Baseline |
| --- | --- |
| Expo | 57.0.26 |
| Expo Router | 57.0.24 |
| React Native | 0.86.3 |
| React | 19.2.3 |
| NativeWind | 4.2.7 |
| Clerk Expo SDK | 4.8.0 |
| Convex | 1.46.0 |
| Package manager | npm, existing package-lock.json |

Use `npx expo install` for dependencies under repository instructions. Before Expo/React Native/EAS changes, read `package.json`, fetch the matching Expo versioned docs, and use the Expo docs index for the specific API. Reconfirm Clerk/Convex compatibility before any version change. Do not create/edit generated `ios/` or `android/` directories by hand.

| Area | Responsibility / existing location |
| --- | --- |
| Routes | `src/app/`; every file is a route, layouts define navigators |
| UI | `src/components/`; shared mobile components, feeds, protected media |
| Client state | `src/lib/`; providers, locale, queue, picker, focus, push |
| Pure rules | `shared/`; dates, cohorts, validation, media parsing/ranges |
| Authoritative backend | `convex/`; queries/mutations/actions, schema, permissions, jobs |
| Private files | `convex/http.ts`, `convex/media.ts`, storage authorization |
| Permissions | `convex/lib/access.ts`; enforce in every entry point |
| Admin/lifecycle | `convex/admin.ts`, `convex/maintenance.ts`, `convex/crons.ts` |
| Tests | `tests/domain.test.ts`, `tests/backend.test.ts`, `tests/lifecycle.test.ts` |
| Delivery | `app.config.ts`, `eas.json`, `scripts/release-check.mjs` |

Clerk owns authentication; Convex owns application profiles, permissions, entitlements, social data, moderation, and usage. Clients never assign roles, ownership, age groups, or access entitlements. Use Convex query subscriptions for server state and a separate durable local outbox for unacknowledged work. Never trust stale cached eligibility.

## 5. Data model and invariants

The deployed schema must come from `convex/schema.ts`. This table describes the domain rather than promising exact field names in future revisions.

| Record family | Essential data and relationships |
| --- | --- |
| Users/profiles | Unique Clerk identity and normalized username; display name, private DOB, profile fields, preferences, role/status, lifecycle markers |
| Entitlements | One user's immutable free-year start/end and pricing-not-launched behavior |
| Invitations | Unique code digest, expiry, creator, single redemption and redeemed identity |
| Posts/media | Author, caption/mentions, one attachment, visibility cohort/archive state, timestamps, deletion provenance; private storage metadata and claim/publication state |
| Follows/likes/bookmarks | Unique user-target pairs, no duplicate counters or duplicate relationships on retries; bookmarks private |
| Comments | Author, parent post, body/mentions, edit/deletion metadata; no nesting |
| Blocks/mutes | User-target relationship and server-enforced visibility/interaction consequences |
| Conversations/messages | Canonical participant pair, sender, content or media/reference, stable operation ID, sequence; per-user read position |
| Notifications/devices | Recipient, actor/target/category, read state, token ownership/preferences, dispatch/receipt state |
| Reports/evidence | Reporter, subject, reason, authorized snapshot/private evidence, status, retention deadline |
| Moderation/appeals | Actor, subject, action/reason, suspension expiry, audit trail, independent reviewer, resolution |
| Corrections | Private birth-date correction request and reviewed outcome |
| Usage/controls | Per-user daily counters, admission limit, budget estimate, invitation/upload/delivery switches |
| Upload reservations | Account, operation ID, expiry, claim/result; bounded abandoned-upload lifecycle |

Enforce uniqueness transactionally, using indexed lookups and mutations. Validate string limits, URLs, DOB, media size/type/duration, and target existence server-side. Private user fields must not leak through directory/profile queries. Every read/write must account for current suspension, deletion, cohort, blocks, and target visibility as applicable.

## 6. Ordered implementation and validation phases

### Phase 0 — Resume and establish a reproducible baseline

- [ ] Read `AGENTS.md`, this plan, README, implementation status, and release gates.
- [ ] Inspect working-tree changes before editing; preserve unrelated work and existing implementation.
- [ ] Verify installed versions, lockfile, scripts, and relevant official docs.
- [ ] Run lint/typecheck/tests/Expo Doctor and record failures before changes.
- [ ] Review dependency advisories and compatible fixes without forced stack upgrades.

**Exit:** reproducible baseline and a short, evidence-backed list of actual gaps.

### Phase 1 — Development projects and identity configuration

- [ ] Confirm final/provisional app name, scheme, Android package, iOS bundle ID, and EAS project.
- [ ] Configure separate development Clerk and Convex projects; preserve production separation.
- [ ] Create `.env.local` from `.env.example` only if it does not already exist; never overwrite existing secrets.
- [ ] Set public Clerk publishable key, Convex client URL, Convex HTTP site URL, and EAS project ID.
- [ ] Configure Clerk Google/Apple providers, redirect URLs, Convex JWT audience, and issuer.
- [ ] Set server-only secrets in Convex; regenerate typed bindings through configured Convex CLI.
- [ ] Bootstrap separate adult admin/reviewer development accounts using internal functions, then disable bootstrap.

**Exit:** real development authentication and an authenticated Convex call succeed; secrets are absent from client configuration and version control.

### Phase 2 — Validate risky integrations before deeper polish

- [ ] Install development builds on both platforms and verify NativeWind and native tabs.
- [ ] Verify Google/Apple login, logout, cold start, expired sessions, and Clerk-to-Convex identity.
- [ ] Upload protected video and verify playback, seeking, refreshed tokens, and unauthorized rejection.
- [ ] Check real English/Urdu people and caption search results.
- [ ] Restart the app with queued text/media and verify account-scoped recovery.

**Exit:** all five integration risks have device/cloud evidence. If one fails, document it and resolve within the chosen architecture; do not bypass authorization or switch providers silently.

### Phase 3 — Onboarding, profile, and entitlements

- [ ] Validate each onboarding screen, back/retry behavior, optional fields, and skipped suggestions.
- [ ] Test under-13 rejection, private DOB, username collisions, and server-side input validation.
- [ ] Race one invitation between accounts; retry onboarding and confirm one activated account per identity.
- [ ] Test free-year start/end, leap-day anniversary, repeat login, and continued access after expiry.
- [ ] Verify profile/avatar editing, invalid websites, and birth-date correction workflow.

**Exit:** activation and entitlement assignment are atomic, unique, and immutable on retries.

### Phase 4 — Social feeds and content

- [ ] Validate Home chronology, pagination, follow suggestions, Explore search, and empty/error/loading states.
- [ ] Validate publish/edit/delete, mentions, likes, follow/unfollow, and flat comment editing/deletion.
- [ ] Verify owner-only writes, private bookmarks, and unavailable reference placeholders.
- [ ] Verify profile views, owner archives, blocks/mutes, and server enforcement with stale clients.
- [ ] Verify autoplay preferences and stopping off-screen/background playback.

**Exit:** the complete post-to-discovery-to-interaction journey works on both devices without permission leakage.

### Phase 5 — Messaging and durable outbox

- [ ] Validate mutual-follow conversation creation, inbox ordering, unread counts, and read receipts.
- [ ] Send text/media/shared posts; validate ordering and operation-ID deduplication.
- [ ] Test network interruption, restart, retries, failed uploads, cancellation races, quota pauses, and explicit resume.
- [ ] Test logout/account switching during send/upload and deletion with pending work.
- [ ] Unfollow/block/suspend/change cohort while the chat is open; ensure queued work is rejected correctly.

**Exit:** no duplicate publication or cross-account sends; ineligible chats become read-only; retained content follows access rules.

### Phase 6 — Media, lifecycle, and age transitions

- [ ] Exercise valid/invalid files, spoofed metadata, oversized bodies, excessive duration, and partial uploads.
- [ ] Verify private range responses, invalid ranges, cache behavior, and web CORS allowlisting.
- [ ] Verify abandoned files/reservations are cleaned without deleting published content.
- [ ] Test birthday boundaries before and after cleanup, archived owner-only content, and cross-age follow removal.
- [ ] Test DOB correction effects on current permissions and existing relationships.
- [ ] Verify batched account purge, retained text labels, Clerk deletion retry/failure reconciliation, and local queue clearing.

**Exit:** lifecycle jobs are retry-safe, and delayed jobs do not weaken current authorization. Container checks alone do not count as device codec validation.

### Phase 7 — Admin, reports, evidence, and appeals

- [ ] Verify invitation management, admission controls, and role-restricted dashboard access.
- [ ] Report eligible posts/comments/messages; verify reviewers cannot inspect unrelated DMs.
- [ ] Remove content; suspend temporarily/indefinitely; test expiry and reinstatement.
- [ ] Verify suspended-account explanation, appeal, and deletion access.
- [ ] Test primary-reviewer conflicts, independent appeal decisions, and privileged audit records.
- [ ] Delete originals after reporting; verify restricted evidence remains only through its retention window.
- [ ] Verify appeals prevent premature cleanup and reversal cannot restore author-deleted content.

**Exit:** a primary and independent reviewer can complete the full report/appeal lifecycle with no self-review bypass.

### Phase 8 — Notifications and operational visibility

- [ ] Configure APNs/FCM/EAS and development push credentials before enabling push.
- [ ] Validate OS denial, category opt-outs, token refresh/unregister, account switching, tickets/receipts, and invalid-token cleanup.
- [ ] Verify sender-only DM previews and permission-checked notification destinations.
- [ ] Configure production crash/error reporting and alerts within the cost allowance; product analytics remains out of scope.
- [ ] Define alerts for cleanup failures, Clerk deletion failures, upload/send errors, job failures, and provider usage.
- [ ] Avoid recording tokens, private DOB, message bodies, or evidence in routine logs; document incident handling and operator ownership.

**Exit:** operators can detect and reconcile material failures; push permissions and previews are verified on both OSes.

### Phase 9 — Cost, performance, accessibility, and content review

- [ ] Measure storage/egress/database/auth/build/admin-hosting costs for the initial 50-user workload.
- [ ] Establish provider hard controls or another reviewed mechanism that actually enforces the US$25 total monthly ceiling.
- [ ] Alert at 80% (US$20), pause invitations, and restrict uploads/media delivery as necessary; confirm already-incurred usage and delayed billing are accounted for.
- [ ] Measure feed/chat responsiveness, scrolling, memory, slow-network loading, and media playback on representative devices; agree numeric targets from the baseline before sign-off.
- [ ] Validate screen-reader names/order, large text, contrast, theme changes, RTL layout/navigation, and long Urdu content.
- [ ] Obtain human English/Urdu and qualified worldwide 13+ safety/privacy review.
- [ ] Finalize support identity/contact, deletion request channel, policy text, and reviewer coverage.

**Exit:** measured capacity/cost evidence and named review sign-offs exist. Human review costs are separate and require approved quotes.

### Phase 10 — Release candidate and controlled launch

- [ ] Configure isolated production services, storage, secrets, OAuth identifiers, push, and admin origins.
- [ ] Complete final app name, icons, screenshots, store disclosures, privacy/support URLs, and reviewer access.
- [ ] Run automated checks and the full physical-device sequence in `docs/RELEASE.md` against the candidate.
- [ ] Produce installable Android/iOS EAS builds; test the actual artifacts.
- [ ] Record evidence for each release gate, then run the release checker with the required environment.
- [ ] Document backup/restore and rollback procedures appropriate to deployed providers; test recovery before real users.
- [ ] Submit/release manually only after the gates are met; start with 50 invited users.
- [ ] Review costs, reliability, moderation load, and defects before any staged expansion toward 500.

**Exit:** tested, installable release with verified operations and reviewed policies. Passing the release script alone is not certification or authorization to publish.

## 7. Configuration inventory

| Value | Location / purpose |
| --- | --- |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Client environment; public Clerk instance identifier |
| `EXPO_PUBLIC_CONVEX_URL` | Client environment; Convex query/mutation endpoint |
| `EXPO_PUBLIC_CONVEX_SITE_URL` | Client environment; authenticated HTTP media endpoint |
| `EXPO_PUBLIC_EAS_PROJECT_ID` | Client/build environment; Expo project and push association |
| `APP_NAME`, `IOS_BUNDLE_IDENTIFIER`, `ANDROID_PACKAGE` | Build configuration; final application identity |
| `CONVEX_DEPLOYMENT` | Local/backend deployment selection managed by Convex setup |
| `CLERK_JWT_ISSUER_DOMAIN` | Convex environment; authentication issuer |
| `CLERK_SECRET_KEY` | Convex only; account deletion integration |
| `ADMIN_BOOTSTRAP_ENABLED` | Temporary server-only bootstrap switch; disable immediately afterward |
| `ADMIN_ORIGINS` | Server-side exact allowlist for browser evidence/media requests |
| `PUSH_ENABLED` | Server-side switch; false until configured and tested |
| `EXPO_ACCESS_TOKEN` | Server secret when enhanced Expo push security is enabled |

Never put secret keys into `EXPO_PUBLIC_*`. Changing the app scheme also requires updating callbacks/allowlists. Keep `.env.local` and `release-approval.local.json` private. The release checker reads process environment; ensure required values are present in the shell/CI running it.

## 8. Commands and evidence

Run from the repository root. Inspect scripts before using them if the project has changed.

```powershell
# Existing lockfile installation, when needed
npm ci

# Configure/select the development backend; this deploys development functions
npx convex dev

# Start after configuration, with an installed development client
npx expo start --dev-client

# Required local checks
npx expo lint
npx tsc --noEmit
npm test
npx expo-doctor
npx expo export --platform all --output-dir dist

# Static web smoke: keep the server running in one terminal
node scripts/preview-server.mjs
# Run in a second terminal; currently uses installed Microsoft Edge
node scripts/browser-smoke.mjs

# Cloud development builds, after project/signing configuration
npx eas-cli@latest build --profile development --platform android
npx eas-cli@latest build --profile development --platform ios

# Checks recorded configuration and acknowledgements; does not publish
npm run release:check
```

Before declaring a code phase complete, run lint/typecheck and targeted tests. Broaden testing when changes affect shared permissions, schema, queue behavior, or lifecycle. Keep test evidence explicit about mock backend versus live deployment versus installed-device behavior.

For every completed phase, record: date, commit/revision or working-tree reference, environment, devices/OS versions if applicable, checks run, result, evidence location, remaining risks, and next action. Do not place secrets or real private user data in evidence.

## 9. Assumptions and adjustable defaults

These are defaults in the local implementation, not newly confirmed product choices:

| Assumption/default | Current value / follow-up |
| --- | --- |
| App identity | `Selling` / `selling` is provisional; final name and identifiers pending |
| Invitation expiry | 7 days; single use, digest stored |
| Admission | 50 initially; maximum planned expansion 500 subject to measured review |
| Daily abuse limits | 10 posts, 20 DM media publications, 40 upload reservations, 100 follows/comments, 1,000 messages, 10 reports per account per UTC day; inspect exact counter definitions before tuning |
| Orphan uploads | Unclaimed uploads expire after a day |
| Appeals | Filing within 30 days; open appeals preserve evidence; closure restarts 30-day retention |
| Search | Convex caption search and bounded directory scan suitable only for the capped initial cohort; live Urdu behavior unverified |
| Budget estimate | Operator-entered combined estimate; may be stale and cannot prove a hard cap |
| Retry behavior | Bounded foreground retries; quota/budget pause requires explicit resume |
| Performance targets | Numeric targets still to be agreed from representative-device measurements |
| Moderation staffing | Daily primary review and limited independent backup; identities/coverage not yet confirmed |
| Human review | Separate cost; quotes and sign-off pending |

## 10. Open risks and decisions

1. **US$25 ceiling:** provider billing delays and media egress may defeat application-level switches. Resolve enforceable controls before enabling paid usage or launch.
2. **Worldwide 13+ launch:** eligibility, age assurance, privacy, moderation, and store obligations need qualified human review; a DOB field alone does not settle them.
3. **Protected media:** device codecs, token refresh, seeking, large request handling, and delivery cost remain physical-device/live-service gates.
4. **Authentication:** real Google/Apple credentials, redirect configuration, private-relay linking, and deletion behavior remain unverified.
5. **Dependencies:** transitive advisories need reachability assessment and compatible remediation where available.
6. **Operations:** reviewer staffing, incident alerts, recovery, support contact, and deletion-failure reconciliation need owners and tested procedures.
7. **Localization/accessibility:** Urdu copy/search and native RTL/screen-reader behavior require human/device review.
8. **Store identity:** final name, signing configuration, assets, descriptions, disclosures, and reviewer invitations are pending.
9. **After-year pricing:** deliberately undecided; does not block this free-access implementation. Any later monetization needs a separate product decision and plan.
10. **Growth beyond 500:** requires revisiting directory/search strategy, query bounds, scheduled job throughput, media delivery, costs, and moderation capacity.

## 11. Definition of v1 done

V1 is done only when all agreed journeys work in installed Android and iOS builds, authorization and lifecycle checks pass against the real deployment, independent moderation works, the budget mechanism is verified, human release reviews are complete, and production configuration/store materials are finalized. No billing or automatic expiry cutoff is introduced.

Until then, describe the project as locally implemented with outstanding integration and release validation. The next practical starting point is **Phase 0, then Phase 1**; reuse the existing code rather than rebuilding it.
