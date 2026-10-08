import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useColorScheme } from "react-native";
import { Guard } from "../../components/Guard";
import { useLocale } from "../../lib/i18n";
export default function Tabs() {
  const { t } = useLocale();
  const dark = useColorScheme() === "dark";
  return (
    <Guard>
      <NativeTabs
        tintColor="#6267e9"
        backgroundColor={dark ? "#111214" : "#fafaf8"}
      >
        <NativeTabs.Trigger name="home">
          <NativeTabs.Trigger.Label>
            {t("Home", "ہوم")}
          </NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="house.fill" md="home" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="messages">
          <NativeTabs.Trigger.Label>
            {t("Messages", "پیغامات")}
          </NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf="bubble.left.and.bubble.right.fill"
            md="chat"
          />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="explore">
          <NativeTabs.Trigger.Label>
            {t("Explore", "دریافت")}
          </NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="profile">
          <NativeTabs.Trigger.Label>
            {t("Profile", "پروفائل")}
          </NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="person.crop.circle" md="person" />
        </NativeTabs.Trigger>
      </NativeTabs>
    </Guard>
  );
}
