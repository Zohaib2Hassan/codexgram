import { useSSO, useAuth } from "@clerk/expo";
import { makeRedirectUri } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { Redirect, Link } from "expo-router";
import {
  Button,
  Card,
  ErrorText,
  Label,
  Screen,
  useTask,
} from "../components/ui";
import { useLocale } from "../lib/i18n";
WebBrowser.maybeCompleteAuthSession();
export default function SignIn() {
  const { isSignedIn } = useAuth();
  const { startSSOFlow } = useSSO();
  const task = useTask();
  const { t } = useLocale();
  if (isSignedIn) return <Redirect href="/" />;
  const login = (strategy: "oauth_google" | "oauth_apple") =>
    task.run(async () => {
      const result = await startSSOFlow({
        strategy,
        redirectUrl: makeRedirectUri({
          scheme: "selling",
          path: "sso-callback",
        }),
      });
      if (result.createdSessionId)
        await result.setActive?.({ session: result.createdSessionId });
      else if (
        result.authSessionResult?.type !== "cancel" &&
        result.authSessionResult?.type !== "dismiss"
      )
        throw new Error("SIGN_IN_INCOMPLETE");
    });
  return (
    <Screen
      title={t("A space for your people.", "آپ کے لوگوں کے لیے ایک جگہ۔")}
      subtitle={t("Real moments. Familiar faces.", "حقیقی لمحات۔ مانوس چہرے۔")}
    >
      <Card>
        <Label>{t("Welcome to your circle", "اپنے حلقے میں خوش آمدید")}</Label>
        <Label muted>
          {t(
            "Join with an invitation. Your first year is free.",
            "دعوت کے ساتھ شامل ہوں۔ آپ کا پہلا سال مفت ہے۔",
          )}
        </Label>
        <Button onPress={() => void login("oauth_google")} disabled={task.busy}>
          {t("Continue with Google", "Google کے ساتھ جاری رکھیں")}
        </Button>
        <Button
          secondary
          onPress={() => void login("oauth_apple")}
          disabled={task.busy}
        >
          {t("Continue with Apple", "Apple کے ساتھ جاری رکھیں")}
        </Button>
        <ErrorText text={task.error} />
      </Card>
      <Link href="/policy">
        <Label muted>
          {t("Privacy and community guidelines", "رازداری اور کمیونٹی کے اصول")}
        </Label>
      </Link>
    </Screen>
  );
}
