import { Link } from "expo-router";
import { Card, Label, Screen } from "./ui";
import { useLocale } from "../lib/i18n";
export function Setup() {
  const { t } = useLocale();
  return (
    <Screen
      title={t("Your circle starts here.", "آپ کا حلقہ یہاں سے شروع ہوتا ہے۔")}
      subtitle={t(
        "A little closer to your people.",
        "اپنے لوگوں کے کچھ اور قریب۔",
      )}
    >
      <Card>
        <Label>
          {t("Development setup required", "ڈیولپمنٹ کی ترتیبات درکار ہیں")}
        </Label>
        <Label muted>
          {t(
            "Connect your Clerk and Convex development projects using .env.local. See README.md for setup and release checks.",
            "Clerk اور Convex پروجیکٹس کو .env.local کے ذریعے جوڑیں۔ ہدایات README.md میں ہیں۔",
          )}
        </Label>
      </Card>
      <Link href="/policy">
        <Label>
          {t(
            "Privacy and community information",
            "رازداری اور کمیونٹی کی معلومات",
          )}
        </Label>
      </Link>
    </Screen>
  );
}
