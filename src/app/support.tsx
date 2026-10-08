import { Link } from "expo-router";
import { Card, Label, Screen } from "../components/ui";
import { useLocale } from "../lib/i18n";
export default function Support() {
  const { t } = useLocale();
  return (
    <Screen title={t("Support", "مدد")}>
      <Card>
        <Label>{t("In the app", "ایپ میں")}</Label>
        <Label muted>
          {t(
            "Report content from its menu. Review moderation decisions and submit an appeal from Settings → Account. Delete your account there too, even during suspension.",
            "مواد کے مینو سے رپورٹ کریں۔ ترتیبات میں اکاؤنٹ سے فیصلے دیکھیں، اپیل کریں یا معطلی کے دوران بھی اکاؤنٹ حذف کریں۔",
          )}
        </Label>
        <Label muted>
          {t(
            "A public support contact and an external account-deletion request channel must be configured before release.",
            "اجرا سے پہلے عوامی رابطہ اور ایپ کے باہر اکاؤنٹ حذف کرنے کی درخواست کا طریقہ مقرر کرنا ضروری ہے۔",
          )}
        </Label>
        <Link href="/policy">
          <Label>
            {t("Read privacy information", "رازداری کی معلومات پڑھیں")}
          </Label>
        </Link>
      </Card>
    </Screen>
  );
}
