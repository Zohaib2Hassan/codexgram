import { useQuery } from "convex/react";
import { router } from "expo-router";
import { api } from "../../../convex/_generated/api";
import { Button, Card, Label, Loading, Screen } from "../../components/ui";
import { Feed } from "../../components/Feed";
import { ProtectedMedia } from "../../components/ProtectedMedia";
import { useLocale } from "../../lib/i18n";
export default function Profile() {
  const me = useQuery(api.users.me);
  const { t } = useLocale();
  if (!me) return <Loading />;
  return (
    <Screen
      title={me.displayName}
      subtitle={`@${me.username}`}
      scroll={false}
      action={
        <Button secondary onPress={() => router.push("/settings")}>
          {t("Settings", "ترتیبات")}
        </Button>
      }
    >
      <Feed
        mode="profile"
        author={me._id}
        header={
          <Card>
            {me.avatarId && <ProtectedMedia id={me.avatarId} kind="image" />}
            <Label>
              {me.bio ||
                t(
                  "Your story, in your own words.",
                  "آپ کی کہانی، آپ کے الفاظ میں۔",
                )}
            </Label>
            <Label muted>{me.location}</Label>
            <Button secondary onPress={() => router.push("/saved")}>
              {t("Saved posts", "محفوظ پوسٹس")}
            </Button>
            <Label muted>
              {t(
                "Earlier teen posts become private to you at 18.",
                "18 سال کی عمر پر سابقہ پوسٹس صرف آپ کو نظر آئیں گی۔",
              )}
            </Label>
          </Card>
        }
      />
    </Screen>
  );
}
