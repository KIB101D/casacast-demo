import { describe, expect, it } from "vitest";
import { mockPortalAdapter } from "./adapters/mock-portal";
import { siteAdapter } from "./adapters/site";
import { context, failure, listing } from "./test-fixtures";

/** Plays back a fixed sequence of "random" numbers. */
const sequence =
  (...values: number[]) =>
  () =>
    values.shift() ?? 0.99;

describe("mockPortalAdapter", () => {
  it("accepts a listing and returns the portal's id", async () => {
    const result = await mockPortalAdapter.publish(
      listing(),
      context({ random: sequence(0.5, 0.99, 0.123) }),
    );
    expect(result.externalId).toMatch(/^MP-\d{6}$/);
  });

  it("fails with a retryable 503 or timeout at the configured rate", async () => {
    const ctx = context({ env: { MOCK_PORTAL_FAILURE_RATE: "1" }, random: sequence(0.5, 0, 0.1) });
    const error = await failure(mockPortalAdapter.publish(listing(), ctx));
    expect(error).toMatchObject({ retryable: true, message: expect.stringContaining("503") });

    const timeout = context({
      env: { MOCK_PORTAL_FAILURE_RATE: "1" },
      random: sequence(0.5, 0, 0.9),
    });
    expect(await failure(mockPortalAdapter.publish(listing(), timeout))).toMatchObject({
      retryable: true,
      message: expect.stringContaining("timed out"),
    });
  });

  it("never fails at rate 0", async () => {
    const ctx = context({ env: { MOCK_PORTAL_FAILURE_RATE: "0" }, random: () => 0 });
    await expect(mockPortalAdapter.publish(listing(), ctx)).resolves.toBeDefined();
  });

  it("rejects short descriptions for good (422)", async () => {
    const short = listing({
      translations: [{ locale: "en", title: "Flat", description: "Small." }],
    });
    const error = await failure(mockPortalAdapter.publish(short, context()));
    expect(error).toMatchObject({ retryable: false, message: expect.stringContaining("422") });
  });
});

describe("siteAdapter", () => {
  it("keeps the page of a sold listing but drops a withdrawn one", async () => {
    expect(await siteAdapter.unpublish(listing(), "CB-0001", "sold", context())).not.toHaveProperty(
      "externalId",
    );
    expect(await siteAdapter.unpublish(listing(), "CB-0001", "withdrawn", context())).toMatchObject(
      { externalId: null },
    );
  });
});
