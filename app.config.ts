import type { ConfigContext, ExpoConfig } from "expo/config";
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: process.env.APP_NAME || "Selling",
  slug: "selling",
  ios: {
    ...config.ios,
    ...(process.env.IOS_BUNDLE_IDENTIFIER
      ? { bundleIdentifier: process.env.IOS_BUNDLE_IDENTIFIER }
      : {}),
    supportsTablet: false,
  },
  android: {
    ...config.android,
    ...(process.env.ANDROID_PACKAGE
      ? { package: process.env.ANDROID_PACKAGE }
      : {}),
    blockedPermissions: [
      "android.permission.CAMERA",
      "android.permission.RECORD_AUDIO",
    ],
  },
  plugins: [
    ...(config.plugins ?? []).filter((p) => p !== "expo-localization"),
    [
      "expo-localization",
      { supportedLocales: { ios: ["en", "ur"], android: ["en", "ur"] } },
    ],
    [
      "expo-image-picker",
      {
        cameraPermission: false,
        microphonePermission: false,
        photosPermission: "Choose photos and videos to share with your circle.",
      },
    ],
    "expo-notifications",
  ],
  extra: {
    ...config.extra,
    ...(process.env.EXPO_PUBLIC_EAS_PROJECT_ID
      ? { eas: { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID } }
      : {}),
  },
});
