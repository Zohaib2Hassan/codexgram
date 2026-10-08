import { useQueue } from "../lib/queue";
import { useLocale } from "../lib/i18n";
import { Button, Card, Label } from "./ui";
export function Outbox({ conversationId }: { conversationId?: string }) {
  const queue = useQueue();
  const { t } = useLocale();
  return (
    <>
      {queue.items
        .filter((i) =>
          conversationId
            ? i.conversationId === conversationId
            : i.kind === "post",
        )
        .map((item) => (
          <Card key={item.id}>
            <Label>{item.text || t("Media attachment", "میڈیا فائل")}</Label>
            <Label muted>
              {
                {
                  pending: t("Waiting to send", "بھیجنے کا انتظار"),
                  sending: t("Sending…", "بھیجا جا رہا ہے…"),
                  failed: t("Send failed", "بھیجنے میں ناکامی"),
                  paused: t(
                    "Paused by a usage limit",
                    "استعمال کی حد کی وجہ سے رکا ہوا",
                  ),
                }[item.state]
              }
            </Label>
            {item.error && (
              <Label muted>
                {item.error === "limit"
                  ? t(
                      "Resume after the limit clears.",
                      "حد ختم ہونے کے بعد دوبارہ شروع کریں۔",
                    )
                  : item.error === "media"
                    ? t(
                        "This media could not be validated. Cancel and choose another file.",
                        "میڈیا کی تصدیق نہیں ہوئی۔ منسوخ کر کے دوسری فائل منتخب کریں۔",
                      )
                    : item.error === "permission"
                      ? t(
                          "Check that this conversation or account is still eligible.",
                          "گفتگو یا اکاؤنٹ کی اہلیت چیک کریں۔",
                        )
                      : t(
                          "Check your connection and retry.",
                          "رابطہ چیک کر کے دوبارہ کوشش کریں۔",
                        )}
              </Label>
            )}
            {item.state !== "sending" && (
              <>
                <Button secondary onPress={() => void queue.cancel(item.id)}>
                  {t("Cancel", "منسوخ کریں")}
                </Button>
                {item.state !== "pending" && (
                  <Button onPress={() => void queue.resume(item.id)}>
                    {t("Retry / resume", "دوبارہ کوشش کریں")}
                  </Button>
                )}
              </>
            )}
          </Card>
        ))}
    </>
  );
}
