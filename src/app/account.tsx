import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useClerk } from "@clerk/expo";
import { router } from "expo-router";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
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
import { useQueue } from "../lib/queue";
function Content() {
  const me = useQuery(api.users.me);
  const cases = useQuery(api.admin.myCases);
  const appeal = useMutation(api.admin.appeal);
  const remove = useMutation(api.maintenance.deleteAccount);
  const [selected, setSelected] = useState<Id<"moderation"> | undefined>(
    undefined,
  );
  const [text, setText] = useState("");
  const [confirm, setConfirm] = useState("");
  const task = useTask();
  const { t } = useLocale();
  const { signOut } = useClerk();
  const queue = useQueue();
  return (
    <Screen title={t("Your account", "آپ کا اکاؤنٹ")}>
      {!me?.active && (
        <Card>
          <Label>{t("Account suspended", "اکاؤنٹ معطل ہے")}</Label>
          <Label>{me?.suspensionReason}</Label>
        </Card>
      )}
      {cases?.actions
        .filter((a) => ["remove", "suspend"].includes(a.action))
        .map((a) => (
          <Card key={a._id}>
            <Label>{a.reason}</Label>
            <Button secondary onPress={() => setSelected(a._id)}>
              {t("Appeal this decision", "اس فیصلے کے خلاف اپیل")}
            </Button>
          </Card>
        ))}
      {selected && (
        <Card>
          <Field
            label={t("Explain your appeal", "اپیل کی وضاحت کریں")}
            multiline
            value={text}
            onChangeText={setText}
          />
          <Button
            onPress={() =>
              void task.run(async () => {
                await appeal({ moderationId: selected, text });
                setSelected(undefined);
                setText("");
              })
            }
          >
            {t("Submit appeal", "اپیل جمع کریں")}
          </Button>
        </Card>
      )}
      {cases?.appeals.map((a) => (
        <Card key={a._id}>
          <Label>{a.text}</Label>
          <Label muted>{a.status}</Label>
          <Label>{a.resolution}</Label>
        </Card>
      ))}
      <Card>
        <Label>{t("Delete account", "اکاؤنٹ حذف کریں")}</Label>
        <Label muted>
          {t(
            "Your profile, posts, comments and sent media will be removed. Recipients retain message text under “Deleted user”. Report evidence follows the disclosed retention policy. This cannot be undone.",
            "پروفائل، پوسٹس، تبصرے اور بھیجا ہوا میڈیا ہٹا دیا جائے گا۔ پیغامات کا متن وصول کنندہ کے پاس حذف شدہ صارف کے نام سے رہے گا۔ رپورٹ کے ثبوت مقررہ مدت تک محفوظ رہیں گے۔ یہ عمل واپس نہیں ہو سکتا۔",
          )}
        </Label>
        <Field
          label={t("Type DELETE to confirm", "تصدیق کے لیے DELETE لکھیں")}
          value={confirm}
          onChangeText={setConfirm}
          autoCapitalize="characters"
        />
        <Button
          danger
          disabled={confirm !== "DELETE" || task.busy}
          onPress={() =>
            void task.run(async () => {
              await queue.clear();
              await remove({ confirmation: "DELETE" });
              await signOut();
              router.replace("/");
            })
          }
        >
          {t("Permanently delete account", "اکاؤنٹ مستقل حذف کریں")}
        </Button>
      </Card>
      <ErrorText text={task.error} />
      <Button secondary onPress={() => void signOut()}>
        {t("Sign out", "سائن آؤٹ")}
      </Button>
    </Screen>
  );
}
export default function Account() {
  return (
    <Guard suspended>
      <Content />
    </Guard>
  );
}
