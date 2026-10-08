import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { active, blocked, visiblePost, visibleUser } from "./access";
import { mentionedNames } from "../../shared/domain";
type Target = Doc<"notifications">["target"];
export async function notificationVisible(
  ctx: MutationCtx | QueryCtx,
  recipient: Doc<"users">,
  item: { actor: Id<"users">; target: Target },
) {
  const actor = await ctx.db.get(item.actor);
  if (
    !active(recipient) ||
    !actor ||
    !(await visibleUser(ctx, recipient, actor))
  )
    return false;
  if (item.target.kind === "post") {
    const id = ctx.db.normalizeId("posts", item.target.id);
    return !!id && (await visiblePost(ctx, recipient, await ctx.db.get(id)));
  }
  if (item.target.kind === "message") {
    const id = ctx.db.normalizeId("messages", item.target.id);
    const m = id ? await ctx.db.get(id) : null;
    const c = m ? await ctx.db.get(m.conversationId) : null;
    return (
      !!m &&
      !m.removed &&
      !!c &&
      (c.a === recipient._id || c.b === recipient._id) &&
      !(await blocked(ctx, c.a, c.b))
    );
  }
  return item.target.kind === "user" && item.target.id === actor._id;
}
export async function notify(
  ctx: MutationCtx,
  actor: Doc<"users">,
  recipient: Id<"users">,
  category: Doc<"notifications">["category"],
  target: Target,
) {
  if (recipient === actor._id) return;
  const person = await ctx.db.get(recipient);
  if (
    !person ||
    !(await notificationVisible(ctx, person, { actor: actor._id, target }))
  )
    return;
  const id = await ctx.db.insert("notifications", {
    recipient,
    actor: actor._id,
    category,
    target,
    read: false,
    pushed: false,
  });
  await ctx.scheduler.runAfter(0, internal.notifications.deliver, {
    id,
    attempt: 0,
  });
}
export async function mentions(
  ctx: MutationCtx,
  actor: Doc<"users">,
  text: string,
  target: Target,
  previous: string[] = [],
) {
  for (const name of mentionedNames(text)) {
    if (previous.includes(name)) continue;
    const p = await ctx.db
      .query("users")
      .withIndex("username", (q) => q.eq("username", name))
      .unique();
    if (p) await notify(ctx, actor, p._id, "mention", target);
  }
}
