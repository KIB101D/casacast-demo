import type { UserRole } from "@/db/schema";

/**
 * Who may do what, and how much. One place for every rule, so the UI, the Server Actions
 * and the tests all agree. If this ever becomes a product, plans are just more rows in LIMITS.
 */

export type LimitedAction = "createProperty" | "photosPerProperty";

export const LIMITS: Record<UserRole, Record<LimitedAction, number>> = {
  admin: { createProperty: Number.POSITIVE_INFINITY, photosPerProperty: 50 },
  demo: { createProperty: 10, photosPerProperty: 10 },
};

const LIMIT_MESSAGES: Record<LimitedAction, (limit: number) => string> = {
  createProperty: (limit) =>
    `The demo account can create up to ${limit} listings. Delete one of yours, or wait for the nightly reset.`,
  photosPerProperty: (limit) =>
    `A listing can have up to ${limit} photos. Delete one to add another.`,
};

export class LimitError extends Error {
  constructor(
    readonly action: LimitedAction,
    readonly limit: number,
  ) {
    super(LIMIT_MESSAGES[action](limit));
    this.name = "LimitError";
  }
}

/** Throws LimitError when `currentCount` already reached the role's limit for `action`. */
export function assertWithinLimits(role: UserRole, action: LimitedAction, currentCount: number) {
  const limit = LIMITS[role][action];
  if (currentCount >= limit) throw new LimitError(action, limit);
}

export function remainingQuota(role: UserRole, action: LimitedAction, currentCount: number) {
  return Math.max(0, LIMITS[role][action] - currentCount);
}

/** Admins can change anything. The demo user can change only listings it created itself. */
export function canModifyProperty(
  user: { id: string; role: UserRole },
  property: { createdById: string },
) {
  return user.role === "admin" || property.createdById === user.id;
}

/**
 * Enquiries hold real visitors' names and contacts, and the demo account is public. So the demo
 * user sees only enquiries about listings it created; agency listings and the general contact
 * form stay with the admin.
 */
export function canSeeLead(
  user: { id: string; role: UserRole },
  listingOwnerId: string | null,
  /** Demo version: the sandbox whose browser sent the enquiry, if any. */
  visitorId: string | null = null,
) {
  return (
    user.role === "admin" ||
    (listingOwnerId !== null && listingOwnerId === user.id) ||
    (visitorId !== null && visitorId === user.id)
  );
}
