import { useAuth } from "@clerk/expo";
import { useEffect, useState, useCallback, useRef } from "react";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import * as Network from "expo-network";
import { AppState, View } from "react-native";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Label } from "./ui";
import { useLocale } from "../lib/i18n";
export function ProtectedMedia({
  id,
  kind,
  visible = true,
  evidence = false,
}: {
  id: string;
  kind: "image" | "video";
  visible?: boolean;
  evidence?: boolean;
}) {
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const { t } = useLocale();
  const mediaFailed = useCallback(() => setFailed(true), []);
  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      void getToken({ template: "convex" })
        .then((value) => {
          if (mounted) setToken(value);
        })
        .catch(() => {
          if (mounted) setFailed(true);
        });
    };
    refresh();
    const timer = setInterval(refresh, 45000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [getToken]);
  if (!token || failed)
    return (
      <View className="min-h-32 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800">
        <Label muted>{t("Media unavailable", "میڈیا دستیاب نہیں")}</Label>
      </View>
    );
  const uri = `${process.env.EXPO_PUBLIC_CONVEX_SITE_URL}/${evidence ? "evidence" : "media"}?id=${encodeURIComponent(id)}`;
  return kind === "image" ? (
    <Image
      source={{ uri, headers: { Authorization: `Bearer ${token}` } }}
      cachePolicy="none"
      contentFit="cover"
      accessibilityLabel={t("Shared image", "شیئر کردہ تصویر")}
      style={{ width: "100%", aspectRatio: 1, borderRadius: 18 }}
      onError={mediaFailed}
    />
  ) : (
    <ProtectedVideo
      uri={uri}
      token={token}
      visible={visible}
      onError={mediaFailed}
    />
  );
}
function ProtectedVideo({
  uri,
  token,
  visible,
  onError,
}: {
  uri: string;
  token: string;
  visible: boolean;
  onError: () => void;
}) {
  const me = useQuery(api.users.me);
  const [active, setActive] = useState(AppState.currentState === "active");
  const network = Network.useNetworkState();
  const player = useVideoPlayer(
    { uri, headers: { Authorization: `Bearer ${token}` }, useCaching: false },
    (p) => {
      p.muted = true;
      p.loop = true;
    },
  );
  const previousToken = useRef(token);
  useEffect(() => {
    if (previousToken.current === token) return;
    previousToken.current = token;
    let live = true;
    const position = player.currentTime;
    const playing = player.playing;
    void player
      .replaceAsync({
        uri,
        headers: { Authorization: `Bearer ${token}` },
        useCaching: false,
      })
      .then(() => {
        if (live) {
          player.currentTime = position;
          if (playing && active) player.play();
        }
      })
      .catch(onError);
    return () => {
      live = false;
    };
  }, [token, uri, player, active, onError]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) =>
      setActive(state === "active"),
    );
    return () => sub.remove();
  }, []);
  useEffect(() => {
    const sub = player.addListener("statusChange", (event) => {
      if (event.status === "error") onError();
    });
    return () => sub.remove();
  }, [player, onError]);
  useEffect(() => {
    if (
      visible &&
      active &&
      (me?.autoplay === "always" ||
        (me?.autoplay === "wifi" &&
          network.type === Network.NetworkStateType.WIFI))
    )
      player.play();
    else player.pause();
  }, [player, visible, active, me?.autoplay, network.type]);
  return (
    <VideoView
      player={player}
      style={{ width: "100%", aspectRatio: 1, borderRadius: 18 }}
      nativeControls
      contentFit="contain"
    />
  );
}
