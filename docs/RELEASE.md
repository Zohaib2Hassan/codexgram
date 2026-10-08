# Release gates

This source tree is not a released service. Do not invite production users until the following evidence exists.

| Gate | Required evidence |
| --- | --- |
| Authentication | Production Google and Apple flows on physical Android/iOS; approved redirect URLs; verified-email linking; different-email behavior |
| Authorization | Backend tests plus live-token tests for cross-age requests, blocks, suspension, deletion, private media and moderation evidence |
| Media | Real JPEG/PNG/WebP and MP4 uploads; unsupported formats rejected; 15 MB/60-second limits; authorized video seeking and refreshed tokens on both OSes |
| Queues | Airplane-mode recovery, app termination/restart, account switching, cancellation races, retries and exact-once publication on both OSes |
| Costs | Provider hard caps or a reviewed enforceable budget architecture; measured media egress, storage, database, push/build and admin-hosting costs below US$25 total |
| Safety | Qualified review of worldwide 13+ eligibility, age assurance, age segregation, user-generated content and report/appeal operations |
| Privacy | Operator/contact, rights processes, retention/backups, local queue storage and deletion; review of retained text and reported evidence exceptions |
| Localization | Human English/Urdu review, RTL navigation/layout, screen readers, font scaling and contrast |
| Operations | Primary and independent backup reviewer; incident process; provider usage alerts; production crash reporting and support route |
| Stores | Final name, identifiers, icons, screenshots, privacy disclosures, deletion-request URL and reviewer invitation/test credentials |

`npm run release:check` validates recorded acknowledgements and required public configuration. It does not certify compliance, verify billing limits, or submit anything. Keep `release-approval.local.json` private and set individual entries only after collecting the corresponding evidence.

The admin's cost estimate is manually entered and may be stale. Upload/media/invitation switches and quotas are application controls, not a guaranteed provider spending cap. No paid plan should be enabled automatically. Start with 50 users; raising admission to 500 requires another measured capacity/cost review.

No automatic deployment, store submission, bulk invitations, push delivery, or paid resources are enabled by the local implementation. Configure `PUSH_ENABLED=true` only in the appropriate verified deployment.

## Known operational defaults

- Free-year expiry does not gate access while pricing is unlaunched.
- Initial limits: 10 posts, 20 DM media publications and 40 upload reservations per account per UTC day; 100 follows/comments, 1,000 messages and 10 reports per day.
- Invitation codes expire after 7 days. Suggested accounts are same-cohort, active accounts; no contact-book upload.
- Appeal filing window is 30 days. An open appeal prevents evidence expiration; resolved appeals restart the 30-day evidence retention clock.
- Account deletion first tombstones access, then purges content in batches. Clerk deletion uses bounded retries and logs an operational error if configuration is missing or retries fail; operators must reconcile failures.
- Local pending media/text use the app sandbox and SQLite, not end-to-end encryption. There is no promise of deleting copies already downloaded or screenshotted by recipients.
- Search uses Convex caption search and a bounded user directory scan (admission capped at 500). Urdu matching quality needs live validation.
- Automatic retries execute only while the app is open. Notification delivery is best-effort and receipt checks are not proof the recipient saw a notification.

## Physical-device acceptance sequence

1. Create separate adult, teen, primary-admin and backup-reviewer accounts; do not use real minor data in development.
2. Complete onboarding twice and confirm one unchanged entitlement; race the same invitation from two accounts.
3. Post media, follow both ways, like/comment/mention, bookmark/share; test all operations with the other cohort and an unrelated account.
4. Send while offline, restart, reconnect, cancel/retry, sign out and switch accounts. Verify no cross-account publication and no duplicates.
5. Unfollow/block/suspend while the other device has an open chat or queued upload. Verify server rejection and read-only/unavailable screens.
6. Exercise a controlled birthday boundary and approved birth-date correction. Validate archives, follows, media and stale screen refresh.
7. Report text/media; delete the original; review and appeal with different admins. Validate protected evidence, retention and restoration behavior.
8. Delete an account, verify Clerk session termination, inaccessible media, removed social content and retained message text.
9. Test push opt-outs, denied OS permissions, expired tokens and notification taps to unavailable content.
10. Check Urdu and English in light/dark modes with large text and screen readers, including denied library permissions and slow networks.
