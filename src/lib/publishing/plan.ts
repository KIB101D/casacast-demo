import type { PropertyStatus, PublicationStatus, SyncAction } from "@/db/schema";
import type { UnpublishReason } from "./types";

/**
 * The queue stores "this publication needs a sync", not "publish" or "unpublish". The action is
 * worked out when the sync runs, from what is wanted now and what the channel has. So a listing
 * that is published and withdrawn again before the worker gets to it simply produces no call,
 * and running the same sync twice does no harm.
 */
export type SyncPlan =
  | { action: "publish" | "update"; reason?: undefined }
  | { action: "unpublish"; reason: UnpublishReason }
  | { action: null; reason?: undefined };

export function shouldBeLive(enabled: boolean, propertyStatus: PropertyStatus) {
  return enabled && propertyStatus === "active";
}

export function planSync(input: {
  enabled: boolean;
  propertyStatus: PropertyStatus;
  /** Status before this sync started. */
  status: PublicationStatus;
  externalId: string | null;
}): SyncPlan {
  if (shouldBeLive(input.enabled, input.propertyStatus)) {
    return { action: input.externalId ? "update" : "publish" };
  }
  // Not wanted. Remove it, unless it is already gone (a sold Telegram post keeps its id, marked
  // "sold", with the publication `removed`: nothing more to do).
  if (input.externalId && input.status !== "removed") {
    return {
      action: "unpublish",
      reason: input.propertyStatus === "sold" ? "sold" : "withdrawn",
    };
  }
  return { action: null };
}

/** The status a publication settles in after a successful sync. */
export function statusAfterSuccess(action: SyncAction | null): PublicationStatus {
  return action === "publish" || action === "update" ? "published" : "removed";
}
