import { kyeroAdapter } from "@/lib/publishing/adapters/kyero";
import { telegramAdapter } from "@/lib/publishing/adapters/telegram";
import type {
  AdapterResult,
  ChannelAdapter,
  ChannelContext,
  ListingSnapshot,
} from "@/lib/publishing/types";

/**
 * Channel adapters the demo version swaps in (see lib/publishing/registry.ts). Same interface, so
 * the queue, retries, statuses and logs are the real ones; only the far end is different.
 */

/**
 * Telegram, simulated: a public demo must not let strangers post to a real channel, so nothing is
 * sent. It still runs through the queue like the real adapter (a remote channel, with a short
 * delay), so the panel shows the same "Syncing…" → "Published" flow and the sync log fills in.
 */
export const simulatedTelegramAdapter: ChannelAdapter = {
  type: "telegram",
  mode: "remote",
  async publish(listing, ctx) {
    await pause(ctx);
    return {
      externalId: `simulated:${listing.reference}`,
      url: null,
      detail: "Demo: post simulated, nothing was sent to Telegram",
    };
  },
  async update(_listing, _externalId, ctx) {
    await pause(ctx);
    return { detail: "Demo: post edit simulated" };
  },
  async unpublish(_listing, externalId, reason, ctx): Promise<AdapterResult> {
    await pause(ctx);
    return reason === "sold"
      ? { externalId, detail: "Demo: post marked as SOLD (simulated)" }
      : { externalId: null, detail: "Demo: post deletion simulated" };
  },
};

/**
 * Telegram in the demo version: the real adapter for the agency's listings once a bot is set up
 * (TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID), the simulation otherwise. Sandbox listings are always
 * simulated, whatever is configured: visitors never reach a real channel.
 */
export const demoTelegramAdapter: ChannelAdapter = {
  type: "telegram",
  mode: "remote",
  async publish(listing, ctx) {
    return pick(listing, ctx).publish(listing, ctx);
  },
  async update(listing, externalId, ctx) {
    const adapter = pick(listing, ctx);
    // A post made while Telegram was simulated has nothing to edit: post it for real now.
    if (adapter === telegramAdapter && isSimulated(externalId)) {
      return telegramAdapter.publish(listing, ctx);
    }
    return adapter.update(listing, externalId, ctx);
  },
  async unpublish(listing, externalId, reason, ctx) {
    // Taken down the way it was posted.
    const adapter = isSimulated(externalId) ? simulatedTelegramAdapter : pick(listing, ctx);
    return adapter.unpublish(listing, externalId, reason, ctx);
  },
};

export function realTelegramConfigured(env: Record<string, string | undefined>) {
  return Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID);
}

function pick(listing: ListingSnapshot, ctx: ChannelContext): ChannelAdapter {
  return listing.ownerRole !== "demo" && realTelegramConfigured(ctx.env)
    ? telegramAdapter
    : simulatedTelegramAdapter;
}

function isSimulated(externalId: string) {
  return externalId.startsWith("simulated:");
}

function pause(ctx: ChannelContext) {
  return ctx.sleep(600 + Math.round(ctx.random() * 900));
}

/**
 * Kyero for sandboxes: the same validation and the same XML generator, but a sandbox's listing
 * never enters the public feed. Its link opens /feeds/kyero-preview.xml, a feed of that sandbox's
 * own listings, which only it can see.
 */
export const demoKyeroAdapter: ChannelAdapter = {
  ...kyeroAdapter,
  async publish(listing, ctx) {
    return forSandbox(
      listing,
      ctx,
      await kyeroAdapter.publish(listing, ctx),
      "In your demo feed (only you see it)",
    );
  },
  async update(listing, externalId, ctx) {
    return forSandbox(
      listing,
      ctx,
      await kyeroAdapter.update(listing, externalId, ctx),
      "Demo feed entry updated",
    );
  },
};

function forSandbox(
  listing: ListingSnapshot,
  ctx: ChannelContext,
  result: AdapterResult,
  detail: string,
) {
  if (listing.ownerRole !== "demo") return result;
  return { ...result, url: new URL("/feeds/kyero-preview.xml", ctx.siteUrl).toString(), detail };
}
