import { useState } from "react";
import { useQuery, useMutation, usePaginatedQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Guard } from "../../components/Guard";
import { PostCard, MentionText } from "../../components/PostCard";
import {
  Button,
  Card,
  ErrorText,
  Field,
  Label,
  Screen,
  useTask,
} from "../../components/ui";
import { useLocale } from "../../lib/i18n";
function Content() {
  const { id } = useLocalSearchParams<{ id: Id<"posts"> }>();
  const post = useQuery(api.social.post, { id });
  const me = useQuery(api.users.me);
  const edit = useMutation(api.social.editPost);
  const remove = useMutation(api.social.deletePost);
  const task = useTask();
  const { t } = useLocale();
  const [caption, setCaption] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  return (
    <Screen title={t("Moment", "لمحہ")}>
      {post ? (
        <>
          <PostCard post={post} visible />
          {post.author === me?._id && (
            <Card>
              <Field
                label={t("Edit caption", "کیپشن میں ترمیم")}
                value={caption ?? post.caption}
                onChangeText={setCaption}
                multiline
              />
              <Button
                secondary
                onPress={() =>
                  void task.run(() =>
                    edit({ id, caption: caption ?? post.caption }),
                  )
                }
              >
                {t("Save caption", "کیپشن محفوظ کریں")}
              </Button>
              <Button
                danger
                onPress={() => {
                  if (!confirm) setConfirm(true);
                  else
                    void task.run(async () => {
                      await remove({ id });
                      router.back();
                    });
                }}
              >
                {confirm
                  ? t("Confirm delete post", "پوسٹ حذف کرنے کی تصدیق")
                  : t("Delete post", "پوسٹ حذف کریں")}
              </Button>
            </Card>
          )}
          <Button
            secondary
            onPress={() =>
              router.push({ pathname: "/report", params: { kind: "post", id } })
            }
          >
            {t("Report post", "پوسٹ رپورٹ کریں")}
          </Button>
          <ErrorText text={task.error} />
          <Comments id={id} />
        </>
      ) : (
        <Label>{t("Post unavailable", "پوسٹ دستیاب نہیں")}</Label>
      )}
    </Screen>
  );
}
function Comments({ id }: { id: Id<"posts"> }) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.social.comments,
    { id },
    { initialNumItems: 20 },
  );
  const me = useQuery(api.users.me);
  const comment = useMutation(api.social.comment);
  const remove = useMutation(api.social.deleteComment);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<Id<"comments"> | undefined>(undefined);
  const task = useTask();
  const { t } = useLocale();
  return (
    <>
      <Field
        label={
          editing
            ? t("Edit comment", "تبصرے میں ترمیم")
            : t("Add a comment", "تبصرہ لکھیں")
        }
        value={text}
        onChangeText={setText}
        maxLength={1000}
      />
      <Button
        disabled={!text.trim() || task.busy}
        onPress={() =>
          void task.run(async () => {
            await comment({
              postId: id,
              text,
              ...(editing ? { id: editing } : {}),
            });
            setText("");
            setEditing(undefined);
          })
        }
      >
        {t("Save comment", "تبصرہ محفوظ کریں")}
      </Button>
      <ErrorText text={task.error} />
      {results.map((c) => (
        <Card key={c._id}>
          <Label muted>{c.authorProfile.displayName}</Label>
          <MentionText text={c.text} />
          {c.author === me?._id ? (
            <>
              <Button
                secondary
                onPress={() => {
                  setEditing(c._id);
                  setText(c.text);
                }}
              >
                {t("Edit", "ترمیم")}
              </Button>
              <Button
                secondary
                onPress={() => void task.run(() => remove({ id: c._id }))}
              >
                {t("Delete", "حذف کریں")}
              </Button>
            </>
          ) : (
            <Button
              secondary
              onPress={() =>
                router.push({
                  pathname: "/report",
                  params: { kind: "comment", id: c._id },
                })
              }
            >
              {t("Report", "رپورٹ")}
            </Button>
          )}
        </Card>
      ))}
      {status === "CanLoadMore" && (
        <Button secondary onPress={() => loadMore(20)}>
          {t("More comments", "مزید تبصرے")}
        </Button>
      )}
    </>
  );
}
export default function PostDetail() {
  return (
    <Guard>
      <Content />
    </Guard>
  );
}
