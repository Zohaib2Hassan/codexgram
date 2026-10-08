import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, Platform } from "react-native";
import { useAuth } from "@clerk/expo";
import { useConvex, useConvexAuth, useQuery } from "convex/react";
import * as Network from "expo-network";
import * as Crypto from "expo-crypto";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { type OutboxItem, afterFailure, restored } from "./outbox";
import {
  fileBody,
  loadItems,
  persistFile,
  removeItem,
  saveItem,
} from "./queue-store";
type Draft = Omit<OutboxItem, "id" | "owner" | "state" | "attempts" | "nextAt">;
const Context = createContext({
  items: [] as OutboxItem[],
  enqueue: async (_draft: Draft) => {},
  cancel: async (_id: string) => {},
  resume: async (_id: string) => {},
  clear: async () => {},
});
export function QueueProvider({ children }: { children: ReactNode }) {
  const client = useConvex();
  const auth = useConvexAuth();
  const { getToken } = useAuth();
  const me = useQuery(api.users.me, auth.isAuthenticated ? {} : "skip");
  const owner = me?._id;
  const active = me?.active;
  const [items, setItems] = useState<OutboxItem[]>([]);
  const rows = useRef<OutboxItem[]>([]);
  const currentOwner = useRef<string | undefined>(undefined);
  const epoch = useRef(0);
  const working = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const updateRows = useCallback((next: OutboxItem[]) => {
    rows.current = next;
    setItems(next);
  }, []);
  const put = useCallback(
    async (item: OutboxItem, generation: number) => {
      if (generation !== epoch.current) return;
      await saveItem(item);
      if (generation !== epoch.current) {
        await removeItem(item);
        return;
      }
      if (currentOwner.current === item.owner)
        updateRows([...rows.current.filter((i) => i.id !== item.id), item]);
    },
    [updateRows],
  );
  const drop = useCallback(
    async (item: OutboxItem) => {
      updateRows(rows.current.filter((i) => i.id !== item.id));
      await removeItem(item);
    },
    [updateRows],
  );
  useEffect(() => {
    currentOwner.current = owner;
    controller.current?.abort();
    let live = true;
    if (owner && Platform.OS !== "web")
      void loadItems(owner)
        .then((saved) => {
          if (live) updateRows(restored(saved));
        })
        .catch(() => console.error("outbox_load_failed"));
    return () => {
      live = false;
      controller.current?.abort();
    };
  }, [owner, updateRows]);
  useEffect(() => {
    if (Platform.OS === "web" || !active || !owner) return;
    let live = true;
    const stateSubscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") controller.current?.abort();
    });
    const timer = setInterval(() => {
      void (async () => {
        if (!live || working.current || AppState.currentState !== "active")
          return;
        const item = rows.current.find(
          (i) =>
            i.owner === owner &&
            i.state === "pending" &&
            i.nextAt <= Date.now(),
        );
        if (!item) return;
        working.current = true;
        const generation = epoch.current;
        try {
          const network = await Network.getNetworkStateAsync();
          if (!network.isConnected || !live) return;
          // Cancellation may have happened while connectivity was checked.
          if (
            !rows.current.some((i) => i.id === item.id && i.state === "pending")
          )
            return;
          updateRows(
            rows.current.map((i) =>
              i.id === item.id ? { ...i, state: "sending" } : i,
            ),
          );
          await put({ ...item, state: "sending" }, generation);
          if (!live || generation !== epoch.current) return;
          if (item.uri && !item.mediaId) {
            const token = await getToken({ template: "convex" });
            if (!token || !live || currentOwner.current !== owner)
              throw new Error("SESSION_MISMATCH");
            controller.current = new AbortController();
            const body = await fileBody(item.uri);
            const response = await fetch(
              `${process.env.EXPO_PUBLIC_CONVEX_SITE_URL}/media`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": item.mime ?? "application/octet-stream",
                  "X-Operation-Id": item.id,
                },
                body: body as BodyInit,
                signal: controller.current.signal,
              },
            );
            if (!response.ok) throw new Error(await response.text());
            const result = await response.json();
            item.mediaId = result.mediaId;
            await put({ ...item, state: "sending" }, generation);
          }
          if (
            !live ||
            generation !== epoch.current ||
            currentOwner.current !== owner ||
            AppState.currentState !== "active"
          )
            throw new Error("SESSION_MISMATCH");
          if (item.kind === "post")
            await client.mutation(api.social.publish, {
              mediaId: item.mediaId as Id<"media">,
              caption: item.text,
              operationId: item.id,
              expectedUserId: owner,
            });
          else
            await client.mutation(api.messages.send, {
              conversationId: item.conversationId as Id<"conversations">,
              text: item.text,
              operationId: item.id,
              expectedUserId: owner,
              ...(item.mediaId ? { mediaId: item.mediaId as Id<"media"> } : {}),
              ...(item.postId ? { postId: item.postId as Id<"posts"> } : {}),
            });
          await drop(item);
        } catch (error) {
          await put(
            afterFailure(
              item,
              error instanceof Error ? error.message : "CONNECTION",
            ),
            generation,
          );
        } finally {
          working.current = false;
          controller.current = null;
        }
      })().catch(() => console.error("outbox_persistence_failed"));
    }, 2000);
    return () => {
      live = false;
      clearInterval(timer);
      stateSubscription.remove();
      controller.current?.abort();
    };
  }, [client, getToken, active, owner, put, drop, updateRows]);
  return (
    <Context.Provider
      value={{
        items: items.filter((i) => i.owner === owner),
        enqueue: async (draft) => {
          if (!owner) throw new Error("SIGN_IN_REQUIRED");
          const id = Crypto.randomUUID();
          const uri = draft.uri ? persistFile(draft.uri, id) : undefined;
          await put(
            {
              ...draft,
              ...(uri ? { uri } : {}),
              id,
              owner,
              state: "pending",
              attempts: 0,
              nextAt: 0,
            },
            epoch.current,
          );
        },
        cancel: async (id) => {
          const item = rows.current.find(
            (i) => i.id === id && i.owner === owner,
          );
          if (item && item.state !== "sending") await drop(item);
        },
        resume: async (id) => {
          const item = rows.current.find(
            (i) => i.id === id && i.owner === owner,
          );
          if (item && item.state !== "sending")
            await put(
              {
                ...item,
                state: "pending",
                attempts: 0,
                nextAt: 0,
                error: undefined,
              },
              epoch.current,
            );
        },
        clear: async () => {
          epoch.current += 1;
          controller.current?.abort();
          const owned = rows.current.filter((i) => i.owner === owner);
          updateRows([]);
          for (const item of owned) await removeItem(item);
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useQueue = () => useContext(Context);
