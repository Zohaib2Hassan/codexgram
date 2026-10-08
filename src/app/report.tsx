import { useState } from "react";
import { useAction } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { api } from "../../convex/_generated/api";
import { Guard } from "../components/Guard";
import {
  Button,
  Card,
  ErrorText,
  Field,
  Label,
  Screen,
  useTask,
} from "../components/ui";
import { useLocale } from "../lib/i18n";
function Content() {
  const { kind, id } = useLocalSearchParams<{
    kind: "post" | "comment" | "message" | "user";
    id: string;
  }>();
  const report = useAction(api.admin.report);
  const [reason, setReason] = useState("");
  const task = useTask();
  const { t } = useLocale();
  return (
    <Screen
      title={t(
        "Help keep this space safe.",
        "اس جگہ کو محفوظ رکھنے میں مدد کریں۔",
      )}
    >
      <Card>
        <Label muted>
          {t(
            "A reviewer can inspect this reported content. Evidence is retained through review and appeal, then deleted 30 days after closure.",
            "جائزہ لینے والا رپورٹ کردہ مواد دیکھ سکتا ہے۔ ثبوت جائزے اور اپیل تک محفوظ رہتا ہے، پھر فیصلہ بند ہونے کے 30 دن بعد حذف ہوتا ہے۔",
          )}
        </Label>
        <Field
          label={t("What happened?", "کیا ہوا؟")}
          multiline
          value={reason}
          onChangeText={setReason}
          maxLength={1000}
        />
        <ErrorText text={task.error} />
        <Button
          disabled={task.busy || !reason.trim()}
          onPress={() =>
            void task.run(async () => {
              await report({ target: { kind, id }, reason });
              router.back();
            })
          }
        >
          {t("Send report", "رپورٹ بھیجیں")}
        </Button>
      </Card>
    </Screen>
  );
}
export default function Report() {
  return (
    <Guard>
      <Content />
    </Guard>
  );
}
