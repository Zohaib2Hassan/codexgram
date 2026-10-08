import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Button, Field, Screen } from "../../components/ui";
import { Feed } from "../../components/Feed";
import { People } from "../../components/People";
import { useLocale } from "../../lib/i18n";
export default function Explore() {
  const params = useLocalSearchParams<{ search?: string }>();
  return (
    <ExploreContent
      key={params.search ?? ""}
      initialSearch={params.search ?? ""}
    />
  );
}
function ExploreContent({ initialSearch }: { initialSearch: string }) {
  const params = { search: initialSearch };
  const [search, setSearch] = useState(params.search ?? "");
  const [debounced, setDebounced] = useState(search);
  const [people, setPeople] = useState(!!params.search);
  const { t } = useLocale();
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const controls = (
    <>
      <Field
        label={t("Search people or captions", "لوگ یا کیپشن تلاش کریں")}
        value={search}
        onChangeText={setSearch}
      />
      <Button secondary onPress={() => setPeople(!people)}>
        {people
          ? t("Show posts", "پوسٹس دکھائیں")
          : t("Find people", "لوگ تلاش کریں")}
      </Button>
    </>
  );
  return (
    <Screen title={t("Explore", "دریافت")} scroll={people}>
      {people ? (
        <>
          {controls}
          <People search={debounced} />
        </>
      ) : (
        <Feed mode="explore" search={debounced} header={controls} />
      )}
    </Screen>
  );
}
