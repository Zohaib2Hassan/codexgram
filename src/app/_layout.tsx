import "../global.css";
import { Stack } from "expo-router";
import { Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LocaleProvider } from "../lib/i18n";
import { Services, configured } from "../lib/providers";
import { QueueProvider } from "../lib/queue";
import { SessionEffects } from "../components/SessionEffects";
export { ErrorBoundary } from "expo-router";
function Routes() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="policy" />
      <Stack.Screen name="support" />
      <Stack.Protected guard={configured}>
        <Stack.Screen name="admin" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sso-callback" />
      </Stack.Protected>
      <Stack.Protected guard={configured && Platform.OS !== "web"}>
        {[
          "(tabs)",
          "account",
          "activity",
          "chat/[id]",
          "create",
          "onboarding",
          "person/[id]",
          "post/[id]",
          "report",
          "saved",
          "settings",
          "share/[id]",
          "suggestions",
        ].map((name) => (
          <Stack.Screen key={name} name={name} />
        ))}
      </Stack.Protected>
    </Stack>
  );
}
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LocaleProvider>
        {configured ? (
          <Services>
            <QueueProvider>
              <SessionEffects />
              <Routes />
            </QueueProvider>
          </Services>
        ) : (
          <Routes />
        )}
      </LocaleProvider>
    </SafeAreaProvider>
  );
}
