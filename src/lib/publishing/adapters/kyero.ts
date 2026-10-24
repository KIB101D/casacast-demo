import { kyeroProblemsMessage, validateForKyero } from "../kyero";
import {
  ChannelError,
  type ChannelAdapter,
  type ChannelContext,
  type ListingSnapshot,
} from "../types";

/**
 * The Kyero XML feed. Nothing is sent anywhere: the feed at /feeds/kyero.xml lists the listings
 * whose Kyero publication is `published`, and portals fetch it on their own schedule. Publishing
 * therefore means checking the listing against what portals accept, then letting it into the feed.
 */
function check(listing: ListingSnapshot) {
  const problems = validateForKyero(listing);
  if (problems.length > 0) {
    throw new ChannelError(kyeroProblemsMessage(problems), { retryable: false });
  }
}

function feedUrl(ctx: ChannelContext) {
  return new URL("/feeds/kyero.xml", ctx.siteUrl).toString();
}

export const kyeroAdapter: ChannelAdapter = {
  type: "kyero",
  mode: "inline",
  async publish(listing, ctx) {
    check(listing);
    return {
      externalId: listing.reference,
      url: feedUrl(ctx),
      detail: "In the feed; portals pick it up on their next fetch",
    };
  },
  async update(listing, _externalId, ctx) {
    check(listing);
    return { url: feedUrl(ctx), detail: "Feed entry updated" };
  },
  async unpublish() {
    return { externalId: null, url: null, detail: "Removed from the feed" };
  },
};
