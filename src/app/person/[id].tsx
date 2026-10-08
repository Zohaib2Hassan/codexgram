import { useQuery, useMutation } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Guard } from "../../components/Guard";
import { Feed } from "../../components/Feed";
import {
  Button,
  Card,
  ErrorText,
  Label,
  Screen,
  useTask,
} from "../../components/ui";
import { useLocale } from "../../lib/i18n";
function Content() {
  const { id } = useLocalSearchParams<{ id: Id<"users"> }>();
  const p = useQuery(api.users.profile, { id });
  const follow = useMutation(api.social.follow);
  const relationship = useMutation(api.social.relationship);
  const start = useMutation(api.messages.start);
  const task = useTask();
  const { t } = useLocale();
  return (
    <Screen title={p?.displayName ?? t("Profile", "پروفائل")} scroll={false}>
      {p ? (
        <Feed
          mode="profile"
          author={id}
          header={
            <Card>
              <Label muted>@{p.username}</Label>
              <Label>{p.bio}</Label>
              <Label muted>{p.location}</Label>
              <Label>{p.website}</Label>
              <Button
                secondary={p.following}
                onPress={() =>
                  void task.run(() => follow({ id, enabled: !p.following }))
                }
              >
                {p.following
                  ? t("Unfollow", "ان فالو کریں")
                  : t("Follow", "فالو کریں")}
              </Button>
              <Button
                onPress={() =>
                  void task.run(async () => {
                    const conversation = await start({ otherId: id });
                    router.push({
                      pathname: "/chat/[id]",
                      params: { id: conversation },
                    });
                  })
                }
              >
                {t("Message", "پیغام")}
              </Button>
              <Button
                secondary
                onPress={() =>
                  void task.run(() =>
                    relationship({ id, kind: "mute", enabled: !p.muted }),
                  )
                }
              >
                {p.muted
                  ? t("Unmute", "ان میوٹ کریں")
                  : t("Mute posts", "پوسٹس میوٹ کریں")}
              </Button>
              <Button
                secondary
                onPress={() =>
                  router.push({
                    pathname: "/report",
                    params: { kind: "user", id },
                  })
                }
              >
                {t("Report", "رپورٹ کریں")}
              </Button>
              <Button
                danger
                onPress={() =>
                  void task.run(async () => {
                    await relationship({ id, kind: "block", enabled: true });
                    router.back();
                  })
                }
              >
                {t("Block", "بلاک کریں")}
              </Button>
              <ErrorText text={task.error} />
            </Card>
          }
        />
      ) : (
        <Label muted>{t("Profile unavailable", "پروفائل دستیاب نہیں")}</Label>
      )}
    </Screen>
  );
}
export default function Person() {
  return (
    <Guard>
      <Content />
    </Guard>
  );
}
