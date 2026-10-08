import { useMutation } from "convex/react";
import { router } from "expo-router";
import { View, Text } from "react-native";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import { Button, Card, ErrorText, Label, useTask } from "./ui";
import { ProtectedMedia } from "./ProtectedMedia";
import { useLocale } from "../lib/i18n";
export type Post = NonNullable<FunctionReturnType<typeof api.social.post>>;
export function MentionText({ text }: { text: string }) {
  return (
    <Text className="text-base leading-6 text-zinc-900 dark:text-zinc-100">
      {text.split(/(@[a-zA-Z0-9_]{3,24})/g).map((part, i) =>
        part.startsWith("@") ? (
          <Text
            key={i}
            accessibilityRole="link"
            className="text-accent"
            onPress={() =>
              router.push({
                pathname: "/(tabs)/explore",
                params: { search: part.slice(1) },
              })
            }
          >
            {part}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}
export function PostCard({ post, visible }: { post: Post; visible: boolean }) {
  const toggle = useMutation(api.social.toggle);
  const task = useTask();
  const { t } = useLocale();
  return (
    <Card>
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Label>{post.authorProfile?.displayName}</Label>
          <Label muted>
            @{post.authorProfile?.username} ·{" "}
            {new Date(post._creationTime).toLocaleDateString()}
          </Label>
        </View>
        <Button
          secondary
          onPress={() =>
            router.push({
              pathname: "/person/[id]",
              params: { id: post.author },
            })
          }
        >
          {t("Profile", "پروفائل")}
        </Button>
      </View>
      {post.media && (
        <ProtectedMedia
          id={post.media._id}
          kind={post.media.kind}
          visible={visible}
        />
      )}
      <MentionText text={post.caption} />
      <View className="flex-row flex-wrap gap-2">
        <Button
          secondary={!post.liked}
          onPress={() =>
            void task.run(() =>
              toggle({ id: post._id, kind: "like", enabled: !post.liked }),
            )
          }
        >{`${post.liked ? "♥" : "♡"} ${post.likeCount}`}</Button>
        <Button
          secondary
          onPress={() =>
            router.push({ pathname: "/post/[id]", params: { id: post._id } })
          }
        >
          {t("Comments", "تبصرے")}
        </Button>
        <Button
          secondary={!post.saved}
          onPress={() =>
            void task.run(() =>
              toggle({ id: post._id, kind: "bookmark", enabled: !post.saved }),
            )
          }
        >
          {post.saved ? t("Saved", "محفوظ") : t("Save", "محفوظ کریں")}
        </Button>
        <Button
          secondary
          onPress={() =>
            router.push({ pathname: "/share/[id]", params: { id: post._id } })
          }
        >
          {t("Share", "شیئر کریں")}
        </Button>
      </View>
      <ErrorText text={task.error} />
    </Card>
  );
}
