import { useEffect, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, View } from "react-native";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useIsFocused } from "../../lib/focus";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Guard } from "../../components/Guard";
import {
  Button,
  Card,
  ErrorText,
  Field,
  Label,
  Screen,
  useTask,
} from "../../components/ui";
import { ProtectedMedia } from "../../components/ProtectedMedia";
import { Outbox } from "../../components/Outbox";
import { useLocale } from "../../lib/i18n";
import { useQueue } from "../../lib/queue";
import { pickMedia } from "../../lib/picker";
function Content() {
  const { id } = useLocalSearchParams<{ id: Id<"conversations"> }>();
  const info = useQuery(api.messages.info, { id });
  const me = useQuery(api.users.me);
  const read = useMutation(api.messages.read);
  const focused = useIsFocused();
  const sequence = info?.sequence;
  useEffect(() => {
    if (sequence !== undefined && focused)
      void read({ id, sequence }).catch(() => {});
  }, [id, read, sequence, focused]);
  const { t } = useLocale();
  return (
    <Screen
      title={info?.other?.displayName ?? t("Conversation", "گفتگو")}
      scroll={false}
    >
      {info ? (
        <ChatBody
          id={id}
          writable={info.writable}
          otherRead={info.otherRead}
          me={me?._id}
        />
      ) : (
        <Label>{t("Conversation unavailable", "گفتگو دستیاب نہیں")}</Label>
      )}
    </Screen>
  );
}
function ChatBody({
  id,
  writable,
  otherRead,
  me,
}: {
  id: Id<"conversations">;
  writable: boolean;
  otherRead: number;
  me?: Id<"users">;
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.messages.list,
    { id },
    { initialNumItems: 30 },
  );
  const [text, setText] = useState("");
  const [media, setMedia] =
    useState<Awaited<ReturnType<typeof pickMedia>>>(null);
  const task = useTask();
  const queue = useQueue();
  const { t } = useLocale();
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <FlatList
        data={results}
        inverted
        keyExtractor={(m) => m._id}
        onEndReached={() => {
          if (status === "CanLoadMore") loadMore(30);
        }}
        renderItem={({ item: m }) => (
          <View className={m.author === me ? "ml-8" : "mr-8"}>
            <Card>
              <Label muted>
                {m.authorName ?? t("Deleted user", "حذف شدہ صارف")}
              </Label>
              <Label>
                {m.removed ? t("Message removed", "پیغام ہٹا دیا گیا") : m.text}
              </Label>
              {m.media ? (
                <ProtectedMedia
                  id={m.media._id}
                  kind={m.media.kind}
                  visible={false}
                />
              ) : m.mediaId ? (
                <Label muted>
                  {t("Attachment removed", "فائل ہٹا دی گئی")}
                </Label>
              ) : null}
              {m.postId &&
                (m.post ? (
                  <Button
                    secondary
                    onPress={() =>
                      router.push({
                        pathname: "/post/[id]",
                        params: { id: m.post!._id },
                      })
                    }
                  >
                    {t("View shared post", "شیئر کردہ پوسٹ دیکھیں")}
                  </Button>
                ) : (
                  <Label muted>
                    {t("Post unavailable", "پوسٹ دستیاب نہیں")}
                  </Label>
                ))}
              {m.author === me ? (
                <Label muted>
                  {m.sequence <= otherRead
                    ? t("Read", "پڑھا گیا")
                    : t("Sent", "بھیج دیا گیا")}
                </Label>
              ) : (
                <Button
                  secondary
                  onPress={() =>
                    router.push({
                      pathname: "/report",
                      params: { kind: "message", id: m._id },
                    })
                  }
                >
                  {t("Report", "رپورٹ")}
                </Button>
              )}
            </Card>
          </View>
        )}
      />
      <Outbox conversationId={id} />
      {writable ? (
        <View className="gap-2 pt-3">
          <Field
            label={t("Message", "پیغام")}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={4000}
          />
          <View className="flex-row gap-2">
            <Button
              secondary
              onPress={() =>
                void task.run(async () => setMedia(await pickMedia()))
              }
            >
              {media
                ? t("Change attachment", "فائل تبدیل کریں")
                : t("Attach", "فائل شامل کریں")}
            </Button>
            <Button
              disabled={task.busy || (!text.trim() && !media)}
              onPress={() =>
                void task.run(async () => {
                  await queue.enqueue({
                    kind: "message",
                    conversationId: id,
                    text,
                    ...(media ? { uri: media.uri, mime: media.mime } : {}),
                  });
                  setText("");
                  setMedia(null);
                })
              }
            >
              {t("Send", "بھیجیں")}
            </Button>
          </View>
          <ErrorText text={task.error} />
        </View>
      ) : (
        <Label muted>
          {t(
            "Read-only: messaging requires mutual follows in the same age community.",
            "صرف پڑھنے کے لیے: پیغام کے لیے ایک ہی عمر کے گروپ میں باہمی فالو ضروری ہے۔",
          )}
        </Label>
      )}
    </KeyboardAvoidingView>
  );
}
export default function Chat() {
  return (
    <Guard>
      <Content />
    </Guard>
  );
}
