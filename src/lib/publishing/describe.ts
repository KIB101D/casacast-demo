import type { ChannelType, PropertyStatus } from "@/db/schema";
import { en, type AdminDictionary } from "@/i18n/admin/en";
import { MAX_ATTEMPTS } from "./backoff";

/** Fields of a publication the panel needs to say where it stands. */
export type PublicationState = {
  channelType: ChannelType;
  channelEnabled: boolean;
  enabled: boolean;
  status: "queued" | "published" | "failed" | "removed";
  live: boolean;
  attempts: number;
  nextAttemptAt: string | null;
  lastError: string | null;
  url: string | null;
};

export type Tone = "neutral" | "accent" | "ok" | "warn" | "danger";

/** The badge and the line under it, in the agent's words rather than the queue's. */
export function describePublication(
  p: PublicationState,
  propertyStatus: PropertyStatus,
  now: Date,
  dictionary: AdminDictionary = en,
): { label: string; tone: Tone; note: string | null; noteTone?: "danger" } {
  const t = dictionary.panel.state;
  if (!p.channelEnabled) return { label: t.channelOff, tone: "neutral", note: null };
  // Unticked and nothing to take down: there is no work, whatever the queue says.
  if (!p.enabled && !p.live && p.status !== "failed") {
    return { label: t.off, tone: "neutral", note: null };
  }

  if (p.status === "queued") {
    const retryAt = p.nextAttemptAt ? new Date(p.nextAttemptAt) : null;
    if (p.attempts > 0 && retryAt) {
      const seconds = Math.max(0, Math.ceil((retryAt.getTime() - now.getTime()) / 1000));
      return {
        label: seconds > 0 ? t.retryingIn(seconds) : t.retrying,
        tone: "warn",
        note: t.attemptNote(p.attempts + 1, MAX_ATTEMPTS, p.lastError),
      };
    }
    return { label: t.syncing, tone: "accent", note: null };
  }

  if (p.status === "failed") {
    return { label: t.failed, tone: "danger", note: p.lastError, noteTone: "danger" };
  }

  if (p.status === "published") {
    // The portal reads the feed on its own schedule, so we only promise "in the feed".
    return {
      label: p.channelType === "kyero" ? t.inFeed : t.published,
      tone: "ok",
      note: null,
    };
  }

  // removed
  if (!p.enabled) return { label: t.off, tone: "neutral", note: null };
  if (propertyStatus === "sold") {
    return {
      label: p.channelType === "telegram" && p.url ? t.markedSold : t.takenDownSold,
      tone: "neutral",
      note: null,
    };
  }
  if (propertyStatus !== "active") {
    return {
      label: t.waiting,
      tone: "neutral",
      note: t.waitingNote(dictionary.labels.statuses[propertyStatus]),
    };
  }
  return { label: t.notPublished, tone: "neutral", note: null };
}
