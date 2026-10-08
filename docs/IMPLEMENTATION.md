# Implementation status and boundaries

## Implemented locally

- Mobile Home/Messages/Explore/Profile native tabs, Clerk Google/Apple sign-in flow and account onboarding.
- Transactional invitations, unique usernames, private birth date, permanent calendar-year entitlement, skippable people suggestions.
- Image/video posts, follows, likes, comments, mentions, bookmarks/sharing, profile editing and owner-controlled deletion.
- Convex-backed real-time one-to-one messages, read receipts and permission-checked media.
- Account-scoped durable foreground outbox with idempotency, retries, quota pauses and cancellation controls.
- Teen/adult isolation, age-transition archival, blocks/mutes/reports, suspension and independent appeals.
- Protected reported evidence with retained copies, review/appeal decisions and retention cleanup.
- Web admin dashboard, local English/Urdu copy, system appearance, operating controls, Expo push dispatch/receipt workflow.
- App-account deletion, asynchronous content/media purge and Clerk deletion retries.
- EAS profiles, environment templates, release-gate checker, domain/backend tests and local browser smoke script.

## Local verification

- 33 automated domain/backend tests passed, including private HTTP media ranges, evidence retention/restoration, and stale-account send rejection.
- Expo lint and TypeScript checks passed; Expo Doctor passed all 21 checks.
- Android/iOS Hermes and web bundle exports succeeded. These are bundle exports, not signed installable builds.
- Browser smoke coverage includes the unconfigured entry screen and policy navigation in mobile English, desktop dark mode, and mobile Urdu. Authenticated screens require configured development services.

## Not demonstrated by local checks

Passing tests/typechecks/bundle export is not proof of an installed app, real Clerk/Convex connectivity, production OAuth linking, notification delivery, provider billing limits, video codec/seek behavior on actual phones, Urdu search semantics, translation quality or legal/store acceptance.

No service credentials or deployment identifiers were supplied in the workspace. Cloud configuration and deployment are therefore pending. The unconfigured entry screen is intentional. Public policy/support pages are drafts, not reviewed release documents.

The cost controls require a manually supplied combined provider estimate. Hard monthly budget enforcement and production telemetry-provider configuration are unresolved launch gates. The source contains operational error codes and provider hooks, but no claim of an active incident-alerting service.

Some vendor dependencies have npm advisories without a compatible automatic fix for this pinned SDK. Review specific advisories and runtime reachability before release; do not apply forced major-version changes.

`scripts/browser-smoke.mjs` exercises only the unconfigured shell and policy pages in English/Urdu and light/dark modes. Authenticated application and admin UI must be exercised after configuring development accounts.
