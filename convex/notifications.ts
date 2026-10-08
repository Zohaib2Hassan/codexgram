import { v } from "convex/values";
import {
  mutation,
  query,
  internalAction,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { user, fail } from "./lib/access";
import { notificationVisible } from "./lib/notifications";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const me = await user(ctx);
    const rows = await ctx.db
      .query("notifications")
      .withIndex("recipient", (q) => q.eq("recipient", me._id))
      .order("desc")
      .take(100);
    const result = [];
    for (const n of rows)
      if (await notificationVisible(ctx, me, n)) {
        const actor = await ctx.db.get(n.actor);
        const m =
          n.target.kind === "message"
            ? await ctx.db.get(ctx.db.normalizeId("messages", n.target.id)!)
            : null;
        result.push({
          ...n,
          actorName: actor?.displayName,
          conversationId: m?.conversationId,
        });
      }
    return result;
  },
});
export const markRead = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, { id }) => {
    const me = await user(ctx);
    const n = await ctx.db.get(id);
    if (!n || n.recipient !== me._id) fail("NOT_FOUND");
    await ctx.db.patch(id, { read: true });
  },
});
export const registerDevice = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const me = await user(ctx);
    if (!/^(ExponentPushToken|ExpoPushToken)\[[\w-]+\]$/.test(token))
      fail("INVALID_PUSH_TOKEN");
    const existing = await ctx.db
      .query("devices")
      .withIndex("token", (q) => q.eq("token", token))
      .unique();
    if (existing) await ctx.db.patch(existing._id, { userId: me._id });
    else await ctx.db.insert("devices", { userId: me._id, token });
  },
});
export const unregisterDevices = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await user(ctx, true);
    for (const d of await ctx.db
      .query("devices")
      .withIndex("user", (q) => q.eq("userId", me._id))
      .collect())
      await ctx.db.delete(d._id);
  },
});
export const payload = internalQuery({
  args: { id: v.id("notifications") },
  handler: async (ctx, { id }) => {
    const n = await ctx.db.get(id);
    if (!n || n.pushed || n.read) return null;
    const p = await ctx.db.get(n.recipient);
    if (
      !p ||
      !p.preferences[n.category] ||
      !(await notificationVisible(ctx, p, n))
    )
      return null;
    const actor = await ctx.db.get(n.actor);
    const devices = await ctx.db
      .query("devices")
      .withIndex("user", (q) => q.eq("userId", p._id))
      .collect();
    return {
      actorName: actor!.displayName,
      locale: p.locale,
      category: n.category,
      devices,
    };
  },
});
export const pushed = internalMutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, { id }) => {
    if (await ctx.db.get(id)) await ctx.db.patch(id, { pushed: true });
  },
});
export const invalidDevice = internalMutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const d = await ctx.db
      .query("devices")
      .withIndex("token", (q) => q.eq("token", token))
      .unique();
    if (d) await ctx.db.delete(d._id);
  },
});
export const deliver = internalAction({
  args: { id: v.id("notifications"), attempt: v.number() },
  handler: async (ctx, { id, attempt }) => {
    if (process.env.PUSH_ENABLED !== "true") return;
    const p = await ctx.runQuery(internal.notifications.payload, { id });
    if (!p || !p.devices.length) return;
    try {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.EXPO_ACCESS_TOKEN
            ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
            : {}),
        },
        body: JSON.stringify(
          p.devices
            .slice(0, 100)
            .map((d) => ({
              to: d.token,
              title: p.actorName,
              body:
                p.locale === "ur"
                  ? p.category === "dm"
                    ? "آپ کے لیے نیا پیغام"
                    : "آپ کے حلقے میں نئی سرگرمی"
                  : p.category === "dm"
                    ? "Sent you a message"
                    : "New activity in your circle",
              data: { notificationId: id },
              sound: "default",
            })),
        ),
      });
      if (!response.ok) throw new Error("PUSH_RETRY");
      const result = (await response.json()) as {
        data?: { status: string; id?: string; details?: { error?: string } }[];
      };
      const receipts: string[] = [];
      const tokens: string[] = [];
      for (const [i, ticket] of (result.data ?? []).entries()) {
        if (ticket.details?.error === "DeviceNotRegistered")
          await ctx.runMutation(internal.notifications.invalidDevice, {
            token: p.devices[i].token,
          });
        if (ticket.id) {
          receipts.push(ticket.id);
          tokens.push(p.devices[i].token);
        }
      }
      await ctx.runMutation(internal.notifications.pushed, { id });
      if (receipts.length)
        await ctx.scheduler.runAfter(
          15 * 60_000,
          internal.notifications.receipts,
          { receipts, tokens },
        );
    } catch {
      if (attempt < 3)
        await ctx.scheduler.runAfter(
          30_000 * 2 ** attempt,
          internal.notifications.deliver,
          { id, attempt: attempt + 1 },
        );
      else console.error("push_delivery_failed", id);
    }
  },
});
export const receipts = internalAction({
  args: { receipts: v.array(v.string()), tokens: v.array(v.string()) },
  handler: async (ctx, args) => {
    const response = await fetch(
      "https://exp.host/--/api/v2/push/getReceipts",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.EXPO_ACCESS_TOKEN
            ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
            : {}),
        },
        body: JSON.stringify({ ids: args.receipts }),
      },
    );
    if (!response.ok) {
      console.error("push_receipts_failed");
      return;
    }
    const result = (await response.json()) as {
      data: Record<string, { details?: { error?: string } }>;
    };
    for (const [i, id] of args.receipts.entries())
      if (
        result.data[id]?.details?.error === "DeviceNotRegistered" &&
        args.tokens[i]
      )
        await ctx.runMutation(internal.notifications.invalidDevice, {
          token: args.tokens[i],
        });
  },
});
