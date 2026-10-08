import { Redirect, Link } from "expo-router";
import { Platform } from "react-native";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Loading, Screen, Card, Label } from "../components/ui";
import { useLocale } from "../lib/i18n";
import { configured } from "../lib/providers";
import { Setup } from "../components/Setup";
export default function Index() {
  return configured ? <ConnectedIndex /> : <Setup />;
}
function ConnectedIndex() {
  const auth = useConvexAuth();
  const me = useQuery(api.users.me, auth.isAuthenticated ? {} : "skip");
  const { t } = useLocale();
  if (Platform.OS === "web")
    return (
      <Screen
        title="Selling"
        subtitle={t("Stay close to your people.", "اپنے لوگوں کے قریب رہیں۔")}
      >
        <Card>
          <Label>
            {t(
              "The social experience is available on Android and iOS by invitation.",
              "دعوت کے ذریعے Android اور iOS پر شامل ہوں۔",
            )}
          </Label>
          <Link href="/admin">
            <Label>{t("Admin sign-in", "ایڈمن سائن ان")}</Label>
          </Link>
          <Link href="/policy">
            <Label>
              {t(
                "Privacy and community information",
                "رازداری اور کمیونٹی کی معلومات",
              )}
            </Label>
          </Link>
          <Link href="/support">
            <Label>{t("Support", "مدد")}</Label>
          </Link>
        </Card>
      </Screen>
    );
  if (auth.isLoading || (auth.isAuthenticated && me === undefined))
    return <Loading />;
  if (!auth.isAuthenticated) return <Redirect href="/sign-in" />;
  if (!me) return <Redirect href="/onboarding" />;
  if (!me.active) return <Redirect href="/account" />;
  if (!me.suggestionsDone) return <Redirect href="/suggestions" />;
  return <Redirect href="/(tabs)/home" />;
}
