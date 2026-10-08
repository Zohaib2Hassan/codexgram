import { useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { api } from "../../../convex/_generated/api";
import { Guard } from "../../components/Guard";
import {
  Button,
  Card,
  ErrorText,
  Label,
  Screen,
  useTask,
} from "../../components/ui";
import { useLocale } from "../../lib/i18n";
import { useQueue } from "../../lib/queue";
function Content() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const chats = useQuery(api.messages.inbox);
  const queue = useQueue();
  const task = useTask();
  const { t } = useLocale();
  return (
    <Screen title={t("Share with a friend", "دوست کے ساتھ شیئر کریں")}>
      <Label muted>
        {t(
          "Only eligible conversations appear here.",
          "صرف اہل گفتگو یہاں دکھائی جاتی ہے۔",
        )}
      </Label>
      {chats
        ?.filter((c) => c.writable)
        .map((c) => (
          <Card key={c._id}>
            <Button
              secondary
              onPress={() =>
                void task.run(async () => {
                  await queue.enqueue({
                    kind: "message",
                    text: "",
                    postId: id,
                    conversationId: c._id,
                  });
                  router.replace({
                    pathname: "/chat/[id]",
                    params: { id: c._id },
                  });
                })
              }
            >
              {c.other?.displayName ?? t("Friend", "دوست")}
            </Button>
          </Card>
        ))}
      <ErrorText text={task.error} />
    </Screen>
  );
}
export default function Share() {
  return (
    <Guard>
      <Content />
    </Guard>
  );
}
