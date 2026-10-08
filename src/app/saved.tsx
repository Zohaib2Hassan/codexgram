import { FlatList } from "react-native";
import { usePaginatedQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Guard } from "../components/Guard";
import { PostCard } from "../components/PostCard";
import {
  Button,
  Card,
  Label,
  Screen,
  ErrorText,
  useTask,
} from "../components/ui";
import { useLocale } from "../lib/i18n";
function Content() {
  const { t } = useLocale();
  const task = useTask();
  const remove = useMutation(api.social.toggle);
  const { results, status, loadMore } = usePaginatedQuery(
    api.social.saved,
    {},
    { initialNumItems: 20 },
  );
  return (
    <Screen title={t("Saved posts", "محفوظ پوسٹس")} scroll={false}>
      <ErrorText text={task.error} />
      <FlatList
        data={results}
        keyExtractor={(row) => row.id}
        renderItem={({ item }) =>
          item.post ? (
            <PostCard post={item.post} visible={false} />
          ) : (
            <Card>
              <Label>{t("Post unavailable", "پوسٹ دستیاب نہیں")}</Label>
              <Button
                secondary
                onPress={() =>
                  void task.run(() =>
                    remove({
                      id: item.postId,
                      kind: "bookmark",
                      enabled: false,
                    }),
                  )
                }
              >
                {t("Remove bookmark", "بک مارک ہٹائیں")}
              </Button>
            </Card>
          )
        }
        onEndReached={() => {
          if (status === "CanLoadMore") loadMore(20);
        }}
      />
    </Screen>
  );
}
export default function Saved() {
  return (
    <Guard>
      <Content />
    </Guard>
  );
}
