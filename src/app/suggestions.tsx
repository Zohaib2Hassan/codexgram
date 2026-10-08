import { useMutation } from "convex/react";
import { router } from "expo-router";
import { api } from "../../convex/_generated/api";
import { Guard } from "../components/Guard";
import { People } from "../components/People";
import { Button, Screen, ErrorText, useTask } from "../components/ui";
import { useLocale } from "../lib/i18n";
function Content() {
  const finish = useMutation(api.users.finishSuggestions);
  const task = useTask();
  const { t } = useLocale();
  return (
    <Screen
      title={t("Find your people.", "اپنے لوگ تلاش کریں۔")}
      subtitle={t(
        "Follow a few familiar faces. You can skip this.",
        "کچھ مانوس لوگوں کو فالو کریں۔ یہ مرحلہ چھوڑ بھی سکتے ہیں۔",
      )}
    >
      <People />
      <ErrorText text={task.error} />
      <Button
        disabled={task.busy}
        onPress={() =>
          void task.run(async () => {
            await finish();
            router.replace("/(tabs)/home");
          })
        }
      >
        {t("Continue to Home", "ہوم پر جائیں")}
      </Button>
    </Screen>
  );
}
export default function Suggestions() {
  return (
    <Guard>
      <Content />
    </Guard>
  );
}
