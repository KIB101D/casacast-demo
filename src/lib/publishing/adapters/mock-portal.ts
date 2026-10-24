import {
  ChannelError,
  type ChannelAdapter,
  type ChannelContext,
  type ListingSnapshot,
} from "../types";

/**
 * A stand-in for a big portal's listing API, which Idealista and Fotocasa don't offer publicly.
 * It behaves like a real remote API: it takes a while, sometimes fails with errors worth retrying
 * (503, timeouts) and rejects bad data for good (422). That exercises the queue, the backoff and
 * the Retry button without a real partner account.
 */

export const MOCK_MIN_DESCRIPTION = 80;

function failureRate(ctx: ChannelContext) {
  const value = Number(ctx.env.MOCK_PORTAL_FAILURE_RATE ?? ctx.config.failureRate ?? 0.3);
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 0.3;
}

async function call(ctx: ChannelContext) {
  await ctx.sleep(300 + Math.round(ctx.random() * 900));
  if (ctx.random() < failureRate(ctx)) {
    throw ctx.random() < 0.6
      ? new ChannelError("Partner portal 503: Service Unavailable", { retryable: true })
      : new ChannelError("Partner portal timed out after 5 s", { retryable: true });
  }
}

function validate(listing: ListingSnapshot) {
  const longest = Math.max(
    0,
    ...listing.translations
      .filter((t) => t.locale === "en" || t.locale === "es")
      .map((t) => t.description.trim().length),
  );
  if (longest < MOCK_MIN_DESCRIPTION) {
    throw new ChannelError(
      `Partner portal 422: description must be at least ${MOCK_MIN_DESCRIPTION} characters in English or Spanish`,
      { retryable: false },
    );
  }
}

export const mockPortalAdapter: ChannelAdapter = {
  type: "mock_portal",
  mode: "remote",
  async publish(listing, ctx) {
    await call(ctx);
    validate(listing);
    const id = `MP-${Math.floor(100_000 + ctx.random() * 900_000)}`;
    return { externalId: id, detail: `Accepted by the partner portal as ${id}` };
  },
  async update(listing, externalId, ctx) {
    await call(ctx);
    validate(listing);
    return { detail: `Partner portal listing ${externalId} updated` };
  },
  async unpublish(_listing, externalId, _reason, ctx) {
    await call(ctx);
    return { externalId: null, detail: `Partner portal listing ${externalId} removed` };
  },
};
