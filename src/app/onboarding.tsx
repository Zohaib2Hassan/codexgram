import { useState } from "react";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { Redirect, router } from "expo-router";
import { api } from "../../convex/_generated/api";
import {
  Button,
  Card,
  Field,
  Label,
  Screen,
  ErrorText,
  useTask,
} from "../components/ui";
import { useLocale } from "../lib/i18n";
export default function Onboarding() {
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const onboard = useMutation(api.users.onboard);
  const { locale, setLocale, t } = useLocale();
  const [invite, setInvite] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const task = useTask();
  if (me) return <Redirect href="/" />;
  return (
    <Screen
      title={t("Make yourself at home.", "اپنے حلقے میں شامل ہوں۔")}
      subtitle={t(
        "A few details, then you’re in.",
        "چند تفصیلات کے بعد آپ تیار ہیں۔",
      )}
    >
      <Card>
        <Button
          secondary
          onPress={() => setLocale(locale === "en" ? "ur" : "en")}
        >
          {locale === "en" ? "اردو" : "English"}
        </Button>
        <Field
          label={t("Invitation code", "دعوت کا کوڈ")}
          value={invite}
          onChangeText={setInvite}
          autoCapitalize="none"
        />
        <Field
          label={t("Birth date · YYYY-MM-DD", "تاریخ پیدائش · YYYY-MM-DD")}
          value={birthDate}
          onChangeText={setBirthDate}
          keyboardType="numbers-and-punctuation"
        />
        <Label muted>
          {t(
            "Private. Used to separate age communities. You must be 13 or older.",
            "نجی معلومات۔ عمر کے گروپ الگ رکھنے کے لیے استعمال ہوتی ہے۔ کم از کم عمر 13 سال ہے۔",
          )}
        </Label>
        <Field
          label={t(
            "Username · 3–24 letters, digits or _",
            "صارف نام · 3–24 انگریزی حروف، اعداد یا _",
          )}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
        <Field
          label={t("Display name", "ظاہری نام")}
          value={displayName}
          onChangeText={setDisplayName}
        />
        <ErrorText text={task.error} />
        <Button
          disabled={task.busy || !isAuthenticated}
          onPress={() =>
            void task.run(async () => {
              await onboard({
                invite,
                birthDate,
                username,
                displayName,
                locale,
              });
              router.replace("/suggestions");
            })
          }
        >
          {t("Join my circle", "اپنے حلقے میں شامل ہوں")}
        </Button>
        <Label muted>
          {t(
            "Your free year starts when you finish this step. No payment details required.",
            "یہ مرحلہ مکمل ہونے پر مفت سال شروع ہوگا۔ ادائیگی کی تفصیلات درکار نہیں۔",
          )}
        </Label>
      </Card>
    </Screen>
  );
}
