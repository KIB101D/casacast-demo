import type { ChannelType } from "@/db/schema";
import { mockPortalAdapter } from "./adapters/mock-portal";
import { siteAdapter } from "./adapters/site";
import { demoKyeroAdapter, demoTelegramAdapter } from "@/demo/adapters";
import type { ChannelAdapter } from "./types";

/**
 * Every channel the app can publish to. Adding one: implement ChannelAdapter, add it here and add
 * its type to the `channel_type` enum. The `Record` makes TypeScript insist on all of them.
 */
export const ADAPTERS: Record<ChannelType, ChannelAdapter> = {
  site: siteAdapter,
  // Demo version: sandbox listings stay out of the public feed; Telegram is real only for the
  // agency's listings with a bot configured, simulated otherwise (always for sandboxes).
  kyero: demoKyeroAdapter,
  telegram: demoTelegramAdapter,
  mock_portal: mockPortalAdapter,
};

export function adapterFor(type: ChannelType): ChannelAdapter {
  return ADAPTERS[type];
}

export const INLINE_CHANNELS = (Object.keys(ADAPTERS) as ChannelType[]).filter(
  (type) => ADAPTERS[type].mode === "inline",
);
