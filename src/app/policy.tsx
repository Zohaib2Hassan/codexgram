import { Card, Label, Screen } from "../components/ui";
import { useLocale } from "../lib/i18n";
export default function Policy() {
  const { t } = useLocale();
  return (
    <Screen title={t("Privacy & community", "رازداری اور کمیونٹی")}>
      <Card>
        <Label>
          {t("Pre-release policy draft", "اجرا سے پہلے پالیسی کا مسودہ")}
        </Label>
        <Label muted>
          {t(
            "This information must receive human privacy, safety and translation review before launch. Operator identity, contact details and jurisdiction-specific rights are not finalized.",
            "اجرا سے پہلے رازداری، تحفظ اور ترجمے کا انسانی جائزہ ضروری ہے۔ منتظم کی شناخت، رابطہ اور مقامی حقوق کی تفصیلات ابھی حتمی نہیں۔",
          )}
        </Label>
      </Card>
      {[
        [
          t("A space for people aged 13+", "13 سال اور اس سے بڑی عمر کے لیے"),
          t(
            "An invitation and private birth date are required. Teen and adult communities are separate. Do not misrepresent your age.",
            "دعوت اور نجی تاریخ پیدائش ضروری ہیں۔ نوجوان اور بالغ گروپ الگ ہیں۔ اپنی عمر غلط نہ بتائیں۔",
          ),
        ],
        [
          t(
            "Be kind. Respect boundaries.",
            "مہربانی کریں۔ حدود کا احترام کریں۔",
          ),
          t(
            "No harassment, exploitation, threats, impersonation or illegal content. Use block, mute and report. Reports are reviewed daily, not continuously. This is not an emergency service.",
            "ہراسانی، استحصال، دھمکی، نقالی اور غیر قانونی مواد ممنوع ہیں۔ بلاک، میوٹ اور رپورٹ استعمال کریں۔ رپورٹس کا روزانہ جائزہ لیا جاتا ہے۔ یہ ہنگامی خدمت نہیں۔",
          ),
        ],
        [
          t("Your information", "آپ کی معلومات"),
          t(
            "Clerk handles sign-in. Convex stores profiles, social activity, messages and media. Birth dates are private. Messages are access-controlled, not end-to-end encrypted. Reported messages may be inspected by an authorized reviewer.",
            "Clerk سائن ان سنبھالتا ہے۔ Convex پروفائل، سرگرمی، پیغامات اور میڈیا محفوظ کرتا ہے۔ تاریخ پیدائش نجی ہے۔ پیغامات اینڈ ٹو اینڈ انکرپٹڈ نہیں۔ مجاز جائزہ لینے والا رپورٹ کردہ پیغام دیکھ سکتا ہے۔",
          ),
        ],
        [
          t("Deletion and evidence", "حذف کرنا اور ثبوت"),
          t(
            "Deleting your account removes social content and sent media. Recipients retain message text labeled Deleted user. Reported evidence stays through review and appeal, then is removed 30 days after closure. Appeals must be filed within 30 days of the decision.",
            "اکاؤنٹ حذف کرنے سے سماجی مواد اور بھیجا ہوا میڈیا ہٹ جاتا ہے۔ متن وصول کنندہ کے پاس حذف شدہ صارف کے نام سے رہتا ہے۔ رپورٹ کا ثبوت جائزے اور اپیل تک، پھر بند ہونے کے 30 دن تک رہتا ہے۔ فیصلے کے 30 دن کے اندر اپیل کریں۔",
          ),
        ],
        [
          t("One free year", "ایک مفت سال"),
          t(
            "Your first year starts when onboarding completes. No payment details or automatic charges. Pricing is undecided and access continues after the free year until a new policy is announced.",
            "مفت سال شمولیت مکمل ہونے سے شروع ہوتا ہے۔ ادائیگی کی معلومات یا خودکار چارج نہیں۔ قیمت غیر طے شدہ ہے اور نئی پالیسی تک رسائی جاری رہے گی۔",
          ),
        ],
      ].map(([title, text]) => (
        <Card key={title}>
          <Label>{title}</Label>
          <Label muted>{text}</Label>
        </Card>
      ))}
    </Screen>
  );
}
