import { useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import { View } from "react-native";
import { api } from "../../convex/_generated/api";
import { Button, Card, ErrorText, Label, Loading, useTask } from "./ui";
import { useLocale } from "../lib/i18n";
export function People({ search = "" }: { search?: string }) {
  const rows = useQuery(api.users.people, { search });
  const follow = useMutation(api.social.follow);
  const task = useTask();
  const { t } = useLocale();
  if (!rows) return <Loading />;
  return (
    <>
      <ErrorText text={task.error} />
      {rows.map((p) => (
        <Card key={p._id}>
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1">
              <Label>{p.displayName}</Label>
              <Label muted>@{p.username}</Label>
            </View>
            <Button
              secondary={p.following}
              disabled={task.busy}
              onPress={() =>
                void task.run(() =>
                  follow({ id: p._id, enabled: !p.following }),
                )
              }
            >
              {p.following
                ? t("Following", "فالو کر رہے ہیں")
                : t("Follow", "فالو کریں")}
            </Button>
          </View>
          <Button
            secondary
            onPress={() =>
              router.push({ pathname: "/person/[id]", params: { id: p._id } })
            }
          >
            {t("View profile", "پروفائل دیکھیں")}
          </Button>
        </Card>
      ))}
    </>
  );
}
