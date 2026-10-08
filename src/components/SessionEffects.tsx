import { useEffect } from "react";
import { Platform } from "react-native";
import { useConvexAuth, useQuery } from "convex/react";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { api } from "../../convex/_generated/api";
import { useLocale } from "../lib/i18n";
export function SessionEffects() {
  const auth = useConvexAuth();
  const me = useQuery(api.users.me, auth.isAuthenticated ? {} : "skip");
  const { setLocale } = useLocale();
  const locale = me?.locale;
  useEffect(() => {
    if (locale) setLocale(locale);
  }, [locale, setLocale]);
  useEffect(() => {
    if (Platform.OS === "web") return;
    const navigate = () => {
      if (auth.isAuthenticated) router.push("/activity");
    };
    const sub = Notifications.addNotificationResponseReceivedListener(navigate);
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        navigate();
        void Notifications.clearLastNotificationResponseAsync();
      }
    });
    return () => sub.remove();
  }, [auth.isAuthenticated]);
  return null;
}
