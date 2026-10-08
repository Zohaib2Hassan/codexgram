import { useQuery, useMutation } from "convex/react";
import { router } from "expo-router";
import { api } from "../../convex/_generated/api";
import { Guard } from "../components/Guard";
import {
  Button,
  Card,
  ErrorText,
  Label,
  Screen,
  useTask,
} from "../components/ui";
import { useLocale } from "../lib/i18n";
function Content() {
  const rows = useQuery(api.notifications.list);
  const read = useMutation(api.notifications.markRead);
  const task = useTask();
  const { t } = useLocale();
  const labels = {
    dm: t("sent a message", "نے پیغام بھیجا"),
    follow: t("followed you", "نے آپ کو فالو کیا"),
    like: t("liked your post", "کو آپ کی پوسٹ پسند آئی"),
    comment: t("commented on your post", "نے آپ کی پوسٹ پر تبصرہ کیا"),
    mention: t("mentioned you", "نے آپ کا ذکر کیا"),
  };
  return (
    <Screen title={t("Activity", "سرگرمی")}>
      <ErrorText text={task.error} />
      {rows?.map((n) => (
        <Card key={n._id}>
          <Label>
            {n.actorName} {labels[n.category]}
            {!n.read && " ●"}
          </Label>
          <Button
            secondary
            onPress={() =>
              void task.run(async () => {
                await read({ id: n._id });
                if (n.conversationId)
                  router.push({
                    pathname: "/chat/[id]",
                    params: { id: n.conversationId },
                  });
                else if (n.target.kind === "post")
                  router.push({
                    pathname: "/post/[id]",
                    params: { id: n.target.id },
                  });
                else if (n.target.kind === "user")
                  router.push({
                    pathname: "/person/[id]",
                    params: { id: n.target.id },
                  });
              })
            }
          >
            {t("View", "دیکھیں")}
          </Button>
        </Card>
      ))}
    </Screen>
  );
}
export default function Activity() {
  return (
    <Guard>
      <Content />
    </Guard>
  );
}
