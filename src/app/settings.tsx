import { useState } from "react";
import { useAuth, useClerk } from "@clerk/expo";
import { useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import { Switch, View } from "react-native";
import * as Crypto from "expo-crypto";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { Guard } from "../components/Guard";
import {
  Button,
  Card,
  ErrorText,
  Field,
  Label,
  Loading,
  Screen,
  useTask,
} from "../components/ui";
import { useLocale } from "../lib/i18n";
import { requestPushToken } from "../lib/push";
import { pickMedia } from "../lib/picker";
import { fileBody } from "../lib/queue-store";
function Content() {
  const me = useQuery(api.users.me);
  if (!me) return <Loading />;
  return <Form me={me} />;
}
function Form({
  me,
}: {
  me: Doc<"users"> & { entitlement: { freeAccessEndsAt: number } | null };
}) {
  const update = useMutation(api.users.update);
  const devices = useMutation(api.notifications.registerDevice);
  const unregister = useMutation(api.notifications.unregisterDevices);
  const avatar = useMutation(api.media.avatar);
  const hidden = useQuery(api.social.hiddenPeople);
  const relationship = useMutation(api.social.relationship);
  const correction = useMutation(api.users.requestBirthCorrection);
  const { signOut } = useClerk();
  const { getToken } = useAuth();
  const task = useTask();
  const { t, setLocale } = useLocale();
  const [form, setForm] = useState({
    username: me.username,
    displayName: me.displayName,
    bio: me.bio,
    website: me.website,
    location: me.location,
    locale: me.locale,
    autoplay: me.autoplay,
    preferences: me.preferences,
  });
  const [birth, setBirth] = useState("");
  const [reason, setReason] = useState("");
  const patch = (key: keyof typeof form, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }));
  return (
    <Screen title={t("Settings", "ترتیبات")}>
      <Card>
        {(
          ["username", "displayName", "bio", "website", "location"] as const
        ).map((key, i) => (
          <Field
            key={key}
            label={
              [
                t("Username", "صارف نام"),
                t("Display name", "ظاہری نام"),
                t("Bio", "تعارف"),
                t("Website · https://", "ویب سائٹ · https://"),
                t("Location · optional", "مقام · اختیاری"),
              ][i]
            }
            value={form[key]}
            onChangeText={(value) => patch(key, value)}
          />
        ))}
        <Button
          secondary
          onPress={() =>
            void task.run(async () => {
              const image = await pickMedia(true);
              if (!image) return;
              const token = await getToken({ template: "convex" });
              const response = await fetch(
                `${process.env.EXPO_PUBLIC_CONVEX_SITE_URL}/media`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "X-Operation-Id": Crypto.randomUUID(),
                    "Content-Type": image.mime,
                  },
                  body: (await fileBody(image.uri)) as BodyInit,
                },
              );
              if (!response.ok) throw new Error("UPLOAD_REJECTED");
              await avatar({ mediaId: (await response.json()).mediaId });
            })
          }
        >
          {t("Change profile photo", "پروفائل تصویر بدلیں")}
        </Button>
        <Button
          secondary
          onPress={() => {
            const next = form.locale === "en" ? "ur" : "en";
            patch("locale", next);
            setLocale(next);
          }}
        >
          {form.locale === "en" ? "اردو" : "English"}
        </Button>
        <Button
          secondary
          onPress={() =>
            patch(
              "autoplay",
              form.autoplay === "wifi"
                ? "always"
                : form.autoplay === "always"
                  ? "never"
                  : "wifi",
            )
          }
        >
          {t("Autoplay: ", "خودکار پلے: ") +
            {
              wifi: t("Wi-Fi only", "صرف وائی فائی"),
              always: t("All networks", "تمام نیٹ ورک"),
              never: t("Off", "بند"),
            }[form.autoplay]}
        </Button>
      </Card>
      <Card>
        <Label>{t("Push notifications", "پش اطلاعات")}</Label>
        {(
          Object.keys(form.preferences) as (keyof typeof form.preferences)[]
        ).map((key, i) => (
          <View key={key} className="flex-row items-center justify-between">
            <Label>
              {
                {
                  dm: t("Messages", "پیغامات"),
                  follow: t("Follows", "فالو"),
                  like: t("Likes", "پسند"),
                  comment: t("Comments", "تبصرے"),
                  mention: t("Mentions", "ذکر"),
                }[key]
              }
            </Label>
            <Switch
              accessibilityLabel={key}
              value={form.preferences[key]}
              onValueChange={(value) =>
                patch("preferences", { ...form.preferences, [key]: value })
              }
            />
          </View>
        ))}
        <Button
          secondary
          onPress={() =>
            void task.run(async () =>
              devices({ token: await requestPushToken() }),
            )
          }
        >
          {t("Enable on this device", "اس ڈیوائس پر فعال کریں")}
        </Button>
        <Label muted>
          {t(
            "Message previews show the sender only.",
            "پیغام کی اطلاع میں صرف بھیجنے والے کا نام نظر آتا ہے۔",
          )}
        </Label>
      </Card>
      <Button
        disabled={task.busy}
        onPress={() =>
          void task.run(async () => {
            await update(form);
            router.back();
          })
        }
      >
        {t("Save settings", "ترتیبات محفوظ کریں")}
      </Button>
      <ErrorText text={task.error} />
      <Card>
        <Label>{t("Your free year", "آپ کا مفت سال")}</Label>
        <Label muted>
          {me.entitlement
            ? new Date(me.entitlement.freeAccessEndsAt).toLocaleDateString()
            : ""}
        </Label>
        <Label>
          {t(
            "No automatic charge. Pricing has not launched; access continues after this date.",
            "خودکار چارج نہیں ہوگا۔ قیمت مقرر نہیں ہوئی؛ اس تاریخ کے بعد بھی رسائی جاری رہے گی۔",
          )}
        </Label>
      </Card>
      <Card>
        <Field
          label={t(
            "Request birth-date correction · YYYY-MM-DD",
            "تاریخ پیدائش کی درستگی · YYYY-MM-DD",
          )}
          value={birth}
          onChangeText={setBirth}
        />
        <Field
          label={t("Reason", "وجہ")}
          value={reason}
          onChangeText={setReason}
        />
        <Button
          secondary
          onPress={() =>
            void task.run(async () => {
              await correction({ birthDate: birth, reason });
              setBirth("");
              setReason("");
            })
          }
        >
          {t("Request review", "جائزے کی درخواست")}
        </Button>
      </Card>
      {hidden?.map((p) => (
        <Card key={`${p.kind}${p.id}`}>
          <Label>@{p.username}</Label>
          <Button
            secondary
            onPress={() =>
              void task.run(() =>
                relationship({ id: p.id, kind: p.kind, enabled: false }),
              )
            }
          >
            {p.kind === "block"
              ? t("Unblock", "ان بلاک کریں")
              : t("Unmute", "ان میوٹ کریں")}
          </Button>
        </Card>
      ))}
      <Button secondary onPress={() => router.push("/account")}>
        {t("Account, appeals and deletion", "اکاؤنٹ، اپیل اور حذف کرنا")}
      </Button>
      <Button
        secondary
        onPress={() =>
          void task.run(async () => {
            try {
              await unregister();
            } finally {
              await signOut();
            }
            router.replace("/");
          })
        }
      >
        {t("Sign out", "سائن آؤٹ")}
      </Button>
    </Screen>
  );
}
export default function Settings() {
  return (
    <Guard>
      <Content />
    </Guard>
  );
}
