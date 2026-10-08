import { useCallback, useState } from "react";
import { FlatList, type ViewToken } from "react-native";
import { usePaginatedQuery } from "convex/react";
import { useIsFocused } from "../lib/focus";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { PostCard, type Post } from "./PostCard";
import { Button, Empty } from "./ui";
import { useLocale } from "../lib/i18n";
export function Feed({
  mode,
  author,
  search,
  header,
}: {
  mode: "home" | "explore" | "profile" | "saved";
  author?: Id<"users">;
  search?: string;
  header?: React.ReactElement;
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.social.feed,
    { mode, ...(author ? { author } : {}), ...(search ? { search } : {}) },
    { initialNumItems: 12 },
  );
  const [visible, setVisible] = useState(new Set<string>());
  const focused = useIsFocused();
  const [config] = useState({ itemVisiblePercentThreshold: 65 });
  const changed = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<Post>[] }) =>
      setVisible(new Set(viewableItems.map((v) => v.item._id))),
    [],
  );
  const { t } = useLocale();
  return (
    <FlatList
      data={results}
      keyExtractor={(p) => p._id}
      renderItem={({ item }) => (
        <PostCard post={item} visible={focused && visible.has(item._id)} />
      )}
      ListHeaderComponent={header}
      onViewableItemsChanged={changed}
      viewabilityConfig={config}
      initialNumToRender={4}
      maxToRenderPerBatch={4}
      windowSize={5}
      onEndReached={() => {
        if (status === "CanLoadMore") loadMore(12);
      }}
      onEndReachedThreshold={0.6}
      ListEmptyComponent={
        status !== "LoadingFirstPage" ? (
          <Empty
            title={t("A little quiet here.", "یہاں ابھی خاموشی ہے۔")}
            detail={t(
              "Find people in Explore or share your first moment.",
              "لوگ تلاش کریں یا اپنا پہلا لمحہ شیئر کریں۔",
            )}
          />
        ) : null
      }
      ListFooterComponent={
        status === "CanLoadMore" ? (
          <Button secondary onPress={() => loadMore(12)}>
            {t("Load more", "مزید دیکھیں")}
          </Button>
        ) : null
      }
    />
  );
}
