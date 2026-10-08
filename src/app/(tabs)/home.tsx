import { View } from "react-native";
import { router } from "expo-router";
import { Button, Screen } from "../../components/ui";
import { Feed } from "../../components/Feed";
import { Outbox } from "../../components/Outbox";
import { useLocale } from "../../lib/i18n";
export default function Home() {
  const { t } = useLocale();
  return (
    <Screen
      title={t("Your circle", "آپ کا حلقہ")}
      subtitle={t("Little moments, together.", "چھوٹے لمحات، ایک ساتھ۔")}
      scroll={false}
      action={
        <View className="flex-row gap-2">
          <Button secondary onPress={() => router.push("/activity")}>
            {t("Activity", "سرگرمی")}
          </Button>
          <Button onPress={() => router.push("/create")}>＋</Button>
        </View>
      }
    >
      <Feed mode="home" header={<Outbox />} />
    </Screen>
  );
}
