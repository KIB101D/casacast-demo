import { describe, expect, it } from "vitest";
import { MAX_ATTEMPTS, nextAttemptAt } from "./backoff";
import { describePublication, type PublicationState } from "./describe";
import { planSync, statusAfterSuccess } from "./plan";
import { ADAPTERS } from "./registry";

describe("planSync", () => {
  const base = { enabled: true, propertyStatus: "active" as const, status: "queued" as const };

  it("publishes an active listing that isn't on the channel yet", () => {
    expect(planSync({ ...base, externalId: null })).toEqual({ action: "publish" });
  });

  it("updates one that is already there", () => {
    expect(planSync({ ...base, externalId: "42" })).toEqual({ action: "update" });
  });

  it("takes a sold listing down with the 'sold' reason", () => {
    expect(planSync({ ...base, propertyStatus: "sold", externalId: "42" })).toEqual({
      action: "unpublish",
      reason: "sold",
    });
  });

  it("withdraws a listing moved back to draft, or unticked", () => {
    expect(planSync({ ...base, propertyStatus: "draft", externalId: "42" })).toMatchObject({
      reason: "withdrawn",
    });
    expect(planSync({ ...base, enabled: false, externalId: "42" })).toMatchObject({
      reason: "withdrawn",
    });
  });

  it("does nothing when nothing is out there (published and withdrawn before the worker ran)", () => {
    expect(planSync({ ...base, enabled: false, externalId: null })).toEqual({ action: null });
  });

  it("does not take down twice: a sold Telegram post keeps its id but is already removed", () => {
    expect(
      planSync({ ...base, propertyStatus: "sold", status: "removed", externalId: "42" }),
    ).toEqual({ action: null });
  });

  it("settles on published after publish/update, removed otherwise", () => {
    expect(statusAfterSuccess("publish")).toBe("published");
    expect(statusAfterSuccess("update")).toBe("published");
    expect(statusAfterSuccess("unpublish")).toBe("removed");
    expect(statusAfterSuccess(null)).toBe("removed");
  });
});

describe("nextAttemptAt", () => {
  const now = new Date("2026-10-22T10:00:00Z");
  const after = (attempts: number, retryAfterMs?: number) =>
    nextAttemptAt(attempts, now, { retryable: true, retryAfterMs })!.getTime() - now.getTime();

  it("backs off 10 s, 30 s, 90 s", () => {
    expect([after(1), after(2), after(3)]).toEqual([10_000, 30_000, 90_000]);
  });

  it(`gives up after ${MAX_ATTEMPTS} attempts`, () => {
    expect(nextAttemptAt(MAX_ATTEMPTS, now, { retryable: true })).toBeNull();
  });

  it("never retries errors a person has to fix", () => {
    expect(nextAttemptAt(1, now, { retryable: false })).toBeNull();
  });

  it("waits longer when the channel asks (rate limits)", () => {
    expect(after(1, 60_000)).toBe(60_000);
  });
});

describe("describePublication", () => {
  const now = new Date("2026-10-22T10:00:00Z");
  const pub = (overrides: Partial<PublicationState>): PublicationState => ({
    channelType: "mock_portal",
    channelEnabled: true,
    enabled: true,
    status: "published",
    live: true,
    attempts: 0,
    nextAttemptAt: null,
    lastError: null,
    url: null,
    ...overrides,
  });

  it("counts down to the next retry and says which attempt it is", () => {
    const d = describePublication(
      pub({
        status: "queued",
        attempts: 1,
        nextAttemptAt: "2026-10-22T10:00:07Z",
        lastError: "503",
      }),
      "active",
      now,
    );
    expect(d.label).toBe("Retrying in 7 s");
    expect(d.note).toContain(`Attempt 2 of ${MAX_ATTEMPTS}`);
  });

  it("promises 'in the feed', not 'published', for Kyero", () => {
    expect(describePublication(pub({ channelType: "kyero" }), "active", now).label).toBe(
      "In the feed",
    );
  });

  it("explains why an enabled channel waits on a draft", () => {
    const d = describePublication(pub({ status: "removed", live: false }), "draft", now);
    expect(d.label).toBe("Waiting");
    expect(d.note).toContain("draft");
  });

  it("shows Off for an unticked channel with nothing to take down", () => {
    expect(
      describePublication(pub({ enabled: false, status: "queued", live: false }), "active", now)
        .label,
    ).toBe("Off");
  });
});

describe("registry", () => {
  it("has an adapter for every channel type, named after it", () => {
    for (const [type, adapter] of Object.entries(ADAPTERS)) expect(adapter.type).toBe(type);
  });

  it("keeps local channels inline and remote APIs on the queue", () => {
    expect(ADAPTERS.site.mode).toBe("inline");
    expect(ADAPTERS.kyero.mode).toBe("inline");
    expect(ADAPTERS.telegram.mode).toBe("remote");
    expect(ADAPTERS.mock_portal.mode).toBe("remote");
  });
});
