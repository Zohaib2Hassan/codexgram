import fs from "node:fs";
const keys = [
  "APP_NAME",
  "IOS_BUNDLE_IDENTIFIER",
  "ANDROID_PACKAGE",
  "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "EXPO_PUBLIC_CONVEX_URL",
  "EXPO_PUBLIC_CONVEX_SITE_URL",
  "EXPO_PUBLIC_EAS_PROJECT_ID",
];
const gates = [
  "privacyReview",
  "teenSafetyReview",
  "urduReview",
  "backupReviewerAssigned",
  "providerSpendingControls",
  "protectedMediaDeviceTests",
  "androidDeviceTests",
  "iosDeviceTests",
  "supportContactPublished",
  "externalDeletionChannel",
  "productionClerkConvexConfigured",
  "storeMaterialsApproved",
];
const approval = fs.existsSync("release-approval.local.json")
  ? JSON.parse(fs.readFileSync("release-approval.local.json", "utf8"))
  : {};
const missing = [
  ...keys.filter((k) => !process.env[k]).map((k) => `Configuration: ${k}`),
  ...gates.filter((g) => approval[g] !== true).map((g) => `Release gate: ${g}`),
];
if (missing.length) {
  console.error(`Release blocked:\n${missing.join("\n")}`);
  process.exitCode = 1;
} else
  console.log(
    "Recorded release gates passed. This does not submit or publish the app.",
  );
