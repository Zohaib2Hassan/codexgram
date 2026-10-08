import { useState } from "react";
import { router } from "expo-router";
import { Image } from "expo-image";
import { Guard } from "../components/Guard";
import {
  Button,
  Card,
  ErrorText,
  Field,
  Label,
  Screen,
  useTask,
} from "../components/ui";
import { useLocale } from "../lib/i18n";
import { pickMedia } from "../lib/picker";
import { useQueue } from "../lib/queue";
function Content() {
  const [media, setMedia] =
    useState<Awaited<ReturnType<typeof pickMedia>>>(null);
  const [text, setText] = useState("");
  const task = useTask();
  const { t } = useLocale();
  const queue = useQueue();
  return (
    <Screen title={t("Share a moment.", "ایک لمحہ شیئر کریں۔")}>
      <Card>
        {media?.kind === "image" && (
          <Image
            source={media.uri}
            style={{ width: "100%", aspectRatio: 1, borderRadius: 16 }}
          />
        )}
        {media?.kind === "video" && (
          <Label>{t("Video selected", "ویڈیو منتخب ہے")}</Label>
        )}
        <Button
          secondary
          onPress={() => void task.run(async () => setMedia(await pickMedia()))}
        >
          {t("Choose photo or video", "تصویر یا ویڈیو منتخب کریں")}
        </Button>
        <Label muted>
          {t(
            "Images up to 10 MB. MP4 videos up to 15 MB and 60 seconds.",
            "تصاویر 10 MB تک۔ MP4 ویڈیو 15 MB اور 60 سیکنڈ تک۔",
          )}
        </Label>
        <Field
          label={t("Caption · optional", "کیپشن · اختیاری")}
          multiline
          value={text}
          onChangeText={setText}
          maxLength={2200}
        />
        <ErrorText text={task.error} />
        <Button
          disabled={!media || task.busy}
          onPress={() =>
            void task.run(async () => {
              if (media)
                await queue.enqueue({
                  kind: "post",
                  text,
                  uri: media.uri,
                  mime: media.mime,
                });
              router.replace("/(tabs)/home");
            })
          }
        >
          {t("Share", "شیئر کریں")}
        </Button>
      </Card>
    </Screen>
  );
}
export default function Create() {
  return (
    <Guard>
      <Content />
    </Guard>
  );
}
