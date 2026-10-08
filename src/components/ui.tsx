import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useColorScheme,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocale } from "../lib/i18n";
export function Label({
  children,
  muted = false,
  large = false,
}: {
  children: ReactNode;
  muted?: boolean;
  large?: boolean;
}) {
  const { rtl } = useLocale();
  return (
    <Text
      style={{
        writingDirection: rtl ? "rtl" : "ltr",
        textAlign: rtl ? "right" : "left",
      }}
      className={`${muted ? "text-zinc-500 dark:text-zinc-400" : "text-zinc-900 dark:text-zinc-100"} ${large ? `text-3xl font-bold ${rtl ? "leading-[48px]" : "leading-10 tracking-tight"}` : "text-base leading-7"}`}
    >
      {children}
    </Text>
  );
}
export function Screen({
  title,
  subtitle,
  children,
  action,
  scroll = true,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
  scroll?: boolean;
}) {
  const { rtl } = useLocale();
  const body = (
    <View
      style={{
        direction: rtl ? "rtl" : "ltr",
        ...(!scroll ? { flex: 1 } : {}),
      }}
      className="w-full max-w-2xl self-center px-5 pb-8"
    >
      <View className="flex-row items-center justify-between py-6">
        <View className="flex-1">
          <Label large>{title}</Label>
          {subtitle && <Label muted>{subtitle}</Label>}
        </View>
        {action}
      </View>
      {children}
    </View>
  );
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      className="flex-1 bg-[#fafaf8] dark:bg-[#111214]"
    >
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1 }}
        >
          {body}
        </ScrollView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}
export function Card({ children }: { children: ReactNode }) {
  return (
    <View className="mb-4 gap-3 rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      {children}
    </View>
  );
}
export function Button({
  children,
  onPress,
  disabled,
  secondary,
  danger,
}: {
  children: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={children}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-12 items-center justify-center rounded-2xl px-4 py-3 ${disabled ? "opacity-40" : ""} ${danger ? "bg-red-600" : secondary ? "bg-zinc-100 dark:bg-zinc-800" : "bg-accent"}`}
    >
      <Text
        className={`text-center text-base font-semibold ${secondary ? "text-zinc-900 dark:text-white" : "text-white"}`}
      >
        {children}
      </Text>
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const dark = useColorScheme() === "dark";
  const { rtl } = useLocale();
  return (
    <View className="mb-3 gap-1">
      <Label muted>{label}</Label>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={dark ? "#71717a" : "#a1a1aa"}
        {...props}
        style={[
          {
            textAlign: rtl ? "right" : "left",
            writingDirection: rtl ? "rtl" : "ltr",
            minHeight: 48,
          },
          props.style,
        ]}
        className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      />
    </View>
  );
}
export function Loading() {
  return (
    <View className="flex-1 items-center justify-center bg-[#fafaf8] dark:bg-[#111214]">
      <ActivityIndicator color="#6267e9" size="large" />
    </View>
  );
}
export function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <View className="items-center gap-3 py-16">
      <View className="mb-2 h-14 w-14 items-center justify-center rounded-full bg-indigo-100">
        <Text className="text-2xl text-accent">✦</Text>
      </View>
      <Label>{title}</Label>
      <Label muted>{detail}</Label>
    </View>
  );
}
export function useTask() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { t } = useLocale();
  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      const raw = e instanceof Error ? e.message : "";
      const known: [string, string, string][] = [
        [
          "MEDIA_LIMIT",
          "Choose an image up to 10 MB or a video up to 15 MB and 60 seconds.",
          "10 MB تک تصویر یا 15 MB اور 60 سیکنڈ تک ویڈیو منتخب کریں۔",
        ],
        [
          "UNSUPPORTED_MEDIA",
          "Choose a JPEG, PNG, WebP image or an MP4 video.",
          "JPEG، PNG، WebP تصویر یا MP4 ویڈیو منتخب کریں۔",
        ],
        [
          "PHOTO_PERMISSION_REQUIRED",
          "Allow access to selected photos in your device settings.",
          "ڈیوائس کی ترتیبات میں منتخب تصاویر تک رسائی دیں۔",
        ],
        [
          "INVALID_BIRTH_DATE",
          "Enter a real date using YYYY-MM-DD.",
          "درست تاریخ YYYY-MM-DD کی صورت میں لکھیں۔",
        ],
        [
          "INVALID_USERNAME",
          "Use 3–24 English letters, numbers or underscores.",
          "3–24 انگریزی حروف، اعداد یا انڈر اسکور استعمال کریں۔",
        ],
        [
          "BETA_FULL",
          "This invitation round is full. Please contact your inviter.",
          "دعوت کا یہ مرحلہ مکمل ہے۔ دعوت دینے والے سے رابطہ کریں۔",
        ],
        [
          "PUSH_PERMISSION_REQUIRED",
          "Enable notification permission in device settings.",
          "ڈیوائس کی ترتیبات میں اطلاعات کی اجازت دیں۔",
        ],
        [
          "PUSH_CONFIGURATION_REQUIRED",
          "Notifications are not available in this build yet.",
          "اس بلڈ میں اطلاعات ابھی دستیاب نہیں۔",
        ],
        [
          "SIGN_IN_INCOMPLETE",
          "Sign-in needs another verification step. Please retry or contact support.",
          "سائن ان کے لیے مزید تصدیق درکار ہے۔ دوبارہ کوشش کریں یا مدد لیں۔",
        ],
        [
          "USERNAME_TAKEN",
          "That username is already taken.",
          "یہ صارف نام پہلے سے موجود ہے۔",
        ],
        [
          "INVALID_INVITE",
          "That invitation is invalid or already used.",
          "دعوت نامہ غلط ہے یا استعمال ہو چکا ہے۔",
        ],
        [
          "AGE_NOT_ELIGIBLE",
          "You must be at least 13 to join.",
          "کم از کم عمر 13 سال ہے۔",
        ],
        [
          "PAUSED",
          "Temporarily paused. Please try later.",
          "عارضی طور پر بند ہے۔ بعد میں کوشش کریں۔",
        ],
        [
          "MUTUAL_SAME_AGE_REQUIRED",
          "Messaging requires mutual follows in your age community.",
          "اپنی عمر کے گروپ میں باہمی فالو ضروری ہے۔",
        ],
        [
          "CHAT_READ_ONLY",
          "This conversation is now read-only.",
          "اس گفتگو میں صرف پیغامات پڑھے جا سکتے ہیں۔",
        ],
      ];
      const match = known.find(([code]) => raw.includes(code));
      setError(
        match
          ? t(match[1], match[2])
          : t(
              "Could not complete this action. Check your connection and try again.",
              "یہ کام مکمل نہیں ہوا۔ رابطہ چیک کریں اور دوبارہ کوشش کریں۔",
            ),
      );
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run, clear: () => setError("") };
}
export function ErrorText({ text }: { text: string }) {
  return text ? (
    <Text
      accessibilityRole="alert"
      className="my-3 text-red-600 dark:text-red-400"
    >
      {text}
    </Text>
  ) : null;
}
