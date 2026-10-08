import { useAuth } from "@clerk/expo";
import { useEffect, useState } from "react";
import { Label } from "./ui";
import { useLocale } from "../lib/i18n";
export function ProtectedMedia({
  id,
  kind,
  evidence = false,
}: {
  id: string;
  kind: "image" | "video";
  visible?: boolean;
  evidence?: boolean;
}) {
  const { getToken, userId } = useAuth();
  const { t } = useLocale();
  const [asset, setAsset] = useState<{
    id: string;
    owner: string;
    url: string;
  } | null>(null);
  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    void (async () => {
      const token = await getToken({ template: "convex" });
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_CONVEX_SITE_URL}/${evidence ? "evidence" : "media"}?id=${encodeURIComponent(id)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal: controller.signal,
        },
      );
      if (!response.ok) throw new Error("MEDIA_UNAVAILABLE");
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      setAsset({ id, owner: userId, url: objectUrl });
    })().catch(() => {
      if (!controller.signal.aborted) setAsset(null);
    });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, evidence, getToken, userId]);
  if (!asset || asset.id !== id || asset.owner !== userId)
    return <Label muted>{t("Media unavailable", "میڈیا دستیاب نہیں")}</Label>;
  return kind === "image" ? (
    <img
      src={asset.url}
      alt={t("Reported image", "رپورٹ کردہ تصویر")}
      style={{
        width: "100%",
        borderRadius: 18,
        maxHeight: 600,
        objectFit: "contain",
      }}
    />
  ) : (
    <video
      src={asset.url}
      controls
      muted
      playsInline
      preload="metadata"
      aria-label={t("Reported video", "رپورٹ کردہ ویڈیو")}
      style={{ width: "100%", borderRadius: 18, maxHeight: 600 }}
    />
  );
}
