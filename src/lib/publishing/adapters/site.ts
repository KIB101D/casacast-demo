import type { ChannelAdapter } from "../types";

/**
 * The agency's own website. Publishing is a row in our database: the public catalogue shows
 * listings whose site publication is `published`. A sold listing keeps its page (with a "no longer
 * available" notice, good for SEO) but leaves the catalogue; a withdrawn one is gone.
 */
export const siteAdapter: ChannelAdapter = {
  type: "site",
  mode: "inline",
  async publish(listing) {
    return { externalId: listing.reference, url: listing.pageUrls.es, detail: "Live on the site" };
  },
  async update(listing) {
    return { url: listing.pageUrls.es, detail: "Updated on the site" };
  },
  async unpublish(_listing, _externalId, reason) {
    return reason === "sold"
      ? { detail: "Out of the catalogue; the page stays up marked as sold" }
      : { externalId: null, url: null, detail: "Removed from the site" };
  },
};
