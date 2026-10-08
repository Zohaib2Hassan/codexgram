import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";
import { LIMITS } from "../../shared/domain";
export async function pickMedia(imagesOnly = false) {
  if (Platform.OS === "ios") {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted && permission.accessPrivileges !== "limited")
      throw new Error("PHOTO_PERMISSION_REQUIRED");
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: imagesOnly ? ["images"] : ["images", "videos"],
    allowsEditing: false,
    allowsMultipleSelection: false,
    quality: 1,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (
    asset.mimeType &&
    !["image/jpeg", "image/png", "image/webp", "video/mp4"].includes(
      asset.mimeType,
    )
  )
    throw new Error("UNSUPPORTED_MEDIA");
  if (
    !asset.fileSize ||
    asset.fileSize >
      (asset.type === "video" ? LIMITS.videoBytes : LIMITS.imageBytes) ||
    (asset.type === "video" && (!asset.duration || asset.duration > 60000))
  )
    throw new Error("MEDIA_LIMIT");
  return {
    uri: asset.uri,
    mime:
      asset.mimeType ?? (asset.type === "video" ? "video/mp4" : "image/jpeg"),
    kind: asset.type === "video" ? ("video" as const) : ("image" as const),
  };
}
