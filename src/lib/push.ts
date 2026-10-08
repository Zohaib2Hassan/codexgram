import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import Constants from "expo-constants";
export async function requestPushToken() {
  if (Platform.OS === "web") throw new Error("MOBILE_ONLY");
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("default", {
      name: "Activity",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  const permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted")
    throw new Error("PUSH_PERMISSION_REQUIRED");
  const projectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID || Constants.easConfig?.projectId;
  if (!projectId) throw new Error("PUSH_CONFIGURATION_REQUIRED");
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}
