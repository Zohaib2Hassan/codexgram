import { useQuery } from "convex/react";
import { router } from "expo-router";
import { api } from "../../../convex/_generated/api";
import { Button, Card, Empty, Label, Screen } from "../../components/ui";
import { useLocale } from "../../lib/i18n";
export default function Messages() {
  const rows = useQuery(api.messages.inbox);
  const { t } = useLocale();
  return (
    <Screen
      title={t("Messages", "پیغامات")}
      subtitle={t("Keep the conversation going.", "گفتگو جاری رکھیں۔")}
    >
      {rows?.map((c) => (
        <Card key={c._id}>
          <Label>
            {c.other?.displayName ?? t("Deleted user", "حذف شدہ صارف")}
            {c.unread ? " ●" : ""}
          </Label>
          {!c.writable && (
            <Label muted>{t("Read-only", "صرف پڑھنے کے لیے")}</Label>
          )}
          <Button
            secondary
            onPress={() =>
              router.push({ pathname: "/chat/[id]", params: { id: c._id } })
            }
          >
            {t("Open conversation", "گفتگو کھولیں")}
          </Button>
        </Card>
      ))}
      {rows?.length === 0 && (
        <Empty
          title={t("Say hello.", "سلام کہیں۔")}
          detail={t(
            "Visit a mutual follower’s profile to start a chat.",
            "گفتگو کے لیے باہمی فالو کرنے والے کی پروفائل کھولیں۔",
          )}
        />
      )}
    </Screen>
  );
}
