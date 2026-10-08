import { useConvexAuth, useQuery } from "convex/react";
import { Redirect } from "expo-router";
import type { ReactNode } from "react";
import { api } from "../../convex/_generated/api";
import { Loading } from "./ui";
export function Guard({
  children,
  suspended = false,
}: {
  children: ReactNode;
  suspended?: boolean;
}) {
  const auth = useConvexAuth();
  const me = useQuery(api.users.me, auth.isAuthenticated ? {} : "skip");
  if (auth.isLoading || (auth.isAuthenticated && me === undefined))
    return <Loading />;
  if (!auth.isAuthenticated) return <Redirect href="/sign-in" />;
  if (!me) return <Redirect href="/onboarding" />;
  if (!me.active && !suspended) return <Redirect href="/account" />;
  return children;
}
