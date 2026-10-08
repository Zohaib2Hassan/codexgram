/* Local typed references; Convex CLI regenerates these after deployment setup. */
import { anyApi } from "convex/server";
import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as admin from "../admin";
import type * as maintenance from "../maintenance";
import type * as media from "../media";
import type * as messages from "../messages";
import type * as notifications from "../notifications";
import type * as social from "../social";
import type * as users from "../users";
type FullApi = ApiFromModules<{
  admin: typeof admin;
  maintenance: typeof maintenance;
  media: typeof media;
  messages: typeof messages;
  notifications: typeof notifications;
  social: typeof social;
  users: typeof users;
}>;
export const api = anyApi as unknown as FilterApi<
  FullApi,
  FunctionReference<"query" | "mutation" | "action", "public">
>;
export const internal = anyApi as unknown as FilterApi<
  FullApi,
  FunctionReference<"query" | "mutation" | "action", "internal">
>;
