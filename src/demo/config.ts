/**
 * Limits of the public demo. Per sandbox the product's own LIMITS.demo apply (10 listings, 10
 * photos each); these cap the whole site, so the free tiers survive a busy day or a script.
 */
export const DEMO_LIMITS = {
  /** New sandboxes ("Try the demo" clicks) from one IP address per hour. */
  sandboxesPerIpPerHour: 10,
  /** New sandboxes per day, site-wide. */
  sandboxesPerDay: 300,
  /** Listings created by all sandboxes together per day. */
  listingsPerDay: 600,
  /** Photos uploaded by all sandboxes together per day (each at most 2.5 MB, usually ~300 KB). */
  photosPerDay: 1500,
  /** Enquiries from one IP address per 10 minutes. */
  enquiriesPerIpPer10Min: 5,
  /** Enquiries per day, site-wide. */
  enquiriesPerDay: 500,
} as const;

/** Prefix of the emails given to sandbox users; `.invalid` can never be a real address. */
export const SANDBOX_EMAIL_DOMAIN = "sandbox.casacast.invalid";
