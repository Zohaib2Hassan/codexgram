# Selling — invitation-only social app

Expo Router native tabs, NativeWind, Clerk authentication and a Convex backend. Android/iOS contain the social app; web contains the private admin dashboard and public policy/support pages.

Every user receives one calendar year of free access from completed onboarding. The entitlement is assigned once, transactionally with invite redemption. Pricing is unlaunched: expiry neither bills nor locks out users.

## Local setup

```powershell
npm ci
Copy-Item .env.example .env.local
```

Fill the three public Clerk/Convex values in `.env.local`. Keep development and production projects separate. Do not put service secrets in `EXPO_PUBLIC_*` variables or commit environment files.

```powershell
npx convex dev
```

Select the **existing development project**. This deploys the development functions and regenerates `convex/_generated`. Local schema-typed bindings are included so the repository can typecheck and test before a deployment is configured. The CLI needs a configured deployment for its normal code generation.

In Clerk, enable Google and Apple, configure mobile app identifiers/redirects and create the Convex JWT template with audience `convex`. Configure the development Convex deployment's `CLERK_JWT_ISSUER_DOMAIN` to that Clerk instance. Set `CLERK_SECRET_KEY` only in Convex for account-deletion cleanup. Test provider email-linking and Apple private relay separately; do not merge application profiles by display name.

Set these additional values for signed builds: `APP_NAME`, `IOS_BUNDLE_IDENTIFIER`, `ANDROID_PACKAGE`, `EXPO_PUBLIC_EAS_PROJECT_ID`. The current `Selling` name and `selling` scheme are provisional. Changing the scheme also requires updating the Clerk callback in `src/app/sign-in.tsx` and provider allowlists.

```powershell
npx expo start --dev-client
```

Use development builds, not Expo Go, to verify native authentication, notifications, video and queue persistence. Without configuration the app deliberately shows a setup screen; there is no fake sign-in or fabricated social data.

## First administrators and invitations

1. In the development Convex dashboard, temporarily set `ADMIN_BOOTSTRAP_ENABLED=true`.
2. Invoke the **internal** `admin:seedInvite` function with a unique random code of at least 24 characters. Redeem it in the mobile app as an adult account.
3. Invoke internal `admin:bootstrap` with that account's Clerk ID, username, birth date, and `role: "admin"`. The function checks the actual onboarded account's age too.
4. Repeat for a different adult account using `role: "reviewer"` for independent appeals/conflicts. Disable bootstrap immediately afterward.
5. Open `/admin` on web and sign in. Roles are enforced in every backend admin function; hiding the dashboard alone is not the access control.

Ordinary admins can generate single-use invitations in the dashboard. Codes expire after seven days and only SHA-256 digests are retained. Initial admission is 50 accounts; raising it up to 500 requires observed cost and capacity evidence.

## Protected media and messaging

- All media bytes go through authenticated Convex HTTP endpoints. No direct storage URLs are sent to clients. Range requests support video seeking; every request is permission checked and marked `no-store`.
- Supported images: JPEG, PNG, WebP, up to 10 MB. Video: MP4, up to 15 MB and 60 seconds, with server-side container-duration checks. No automatic transcoding, compression or editing.
- Posts contain one attachment. Media stays unpublished until a post/message/profile mutation claims it. Unclaimed uploads expire after a day.
- Native outbox metadata is in SQLite; media copies are in the app document sandbox. Stable operation IDs deduplicate publication and message sends. Operations include the expected application user ID to reject account-switch races.
- Retry only while foregrounded and online. Quota/budget pauses require user resumption; blocked/unfollowed/age-ineligible chats reject new messages. No background transfer guarantee.
- Account deletion immediately revokes app access, asynchronously purges social content/media, and requests Clerk identity deletion. Recipients keep message text labeled Deleted user. Deletion failures must be reconciled operationally.
- Reports preserve an independent private evidence copy. Reviewers cannot inspect arbitrary DMs. Open appeals prevent evidence expiry; closed evidence is deleted after 30 days. Appeal reversals recheck independent reviewer permissions and do not restore author-deleted content.

Set Convex `ADMIN_ORIGINS` to the exact comma-separated web origins permitted to fetch evidence, such as `http://localhost:8081,https://admin.example.com`. Native clients do not need CORS allowlisting.

## Notifications

Push is disabled unless Convex `PUSH_ENABLED=true`. Configure EAS/APNs/FCM and the Expo project ID first. If enhanced Expo push security is enabled, set `EXPO_ACCESS_TOKEN` in Convex only.

Users request OS permission from Settings. Category preferences are server-side; DMs contain only the sender name and a generic message notice. Permissions are rechecked before dispatch; taps open the permission-filtered activity screen. Tickets and delayed receipts handle invalid devices. Push is best-effort, not a guaranteed delivery channel.

## Validation commands

```powershell
npx expo lint
npx tsc --noEmit
npm test
npx expo-doctor
npx expo export --platform all --output-dir dist
```

Tests use `convex-test` and exercise real function implementations against an in-memory database/storage mock, plus calendar, media-range and queue-state logic. They do not establish live cloud authentication, provider costs, device behavior or store acceptance.

```powershell
node scripts/preview-server.mjs
```

Serves the static export at `http://127.0.0.1:8083`, with extensionless paths. A production static host needs equivalent HTML routing and correct Clerk redirect/origin configuration. Hosting is not provisioned automatically.

## Build and release

```powershell
npx eas-cli@latest build --profile development --platform android
npx eas-cli@latest build --profile development --platform ios
npm run release:check
```

EAS profiles use separate environment selections. Point development/preview at nonproduction Clerk/Convex instances; production at production instances. Release validation deliberately fails until credentials, identities and human/device/budget approvals are recorded. Production submission is a separate manual action; no automatic deployment or billing is enabled.

Read [docs/RELEASE.md](docs/RELEASE.md) for the gates and physical-device acceptance sequence. Public policy/support content is clearly marked as a pre-release draft and needs final operator/contact details and qualified review.

## Source map

- `src/app`: Expo screens, mobile native-tab layout, protected web dashboard.
- `src/components`, `src/lib`: UI, localization, authenticated media, device notifications and durable outbox.
- `convex`: schema, authentication/authorization, social/messaging operations, media HTTP routes, administration, lifecycle jobs.
- `shared`: calendar entitlements, age cohorts, validation and byte-range/container parsing.
- `tests`: backend permission/lifecycle and domain regression tests.

## Outstanding external verification

No Clerk/Convex deployment was configured in the workspace during initial implementation. Complete live sign-in/deletion, protected video playback, Urdu search, push, physical-device QA and release reviews before real users. The US$25 controls are application-level switches driven by an operator-entered estimate; they are **not** a verified provider hard cap.

The dependency audit reports transitive advisories in the selected SDK/toolchain. Do not run `npm audit fix --force`: its suggested major upgrades/downgrades conflict with the pinned Expo/NativeWind stack. Review the specific advisories and compatible fixes before production.
