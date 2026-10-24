import { describe, expect, it } from "vitest";
import { context, listing } from "@/lib/publishing/test-fixtures";
import { demoKyeroAdapter, demoTelegramAdapter, simulatedTelegramAdapter } from "./adapters";

describe("simulated Telegram", () => {
  it("never calls the network and still records a post", async () => {
    const ctx = context({
      fetch: () => {
        throw new Error("must not be called");
      },
    });
    const result = await simulatedTelegramAdapter.publish(listing(), ctx);
    expect(result.externalId).toContain("simulated");
    expect(result.detail).toMatch(/simulated/i);
  });

  it("keeps the post when sold and forgets it when withdrawn", async () => {
    const ctx = context();
    expect((await simulatedTelegramAdapter.unpublish(listing(), "x", "sold", ctx)).externalId).toBe(
      "x",
    );
    expect(
      (await simulatedTelegramAdapter.unpublish(listing(), "x", "withdrawn", ctx)).externalId,
    ).toBeNull();
  });
});

describe("Kyero for sandboxes", () => {
  it("points a sandbox listing at its own preview feed", async () => {
    const result = await demoKyeroAdapter.publish(listing({ ownerRole: "demo" }), context());
    expect(result.url).toMatch(/\/feeds\/kyero-preview\.xml$/);
  });

  it("leaves the agency's listings on the public feed", async () => {
    const result = await demoKyeroAdapter.publish(listing({ ownerRole: "admin" }), context());
    expect(result.url).toMatch(/\/feeds\/kyero\.xml$/);
  });

  it("validates like the real adapter", async () => {
    await expect(
      demoKyeroAdapter.publish(listing({ photos: [], ownerRole: "demo" }), context()),
    ).rejects.toThrow(/photo/);
  });
});

describe("Telegram in the demo version", () => {
  const live = { TELEGRAM_BOT_TOKEN: "123:abc", TELEGRAM_CHAT_ID: "@agency" };

  it("simulates the agency's posts without a bot", async () => {
    const result = await demoTelegramAdapter.publish(listing({ ownerRole: "admin" }), context());
    expect(result.externalId).toMatch(/^simulated:/);
  });

  it("always simulates a sandbox's posts, even with a bot", async () => {
    const ctx = context({
      env: live,
      fetch: () => {
        throw new Error("must not be called");
      },
    });
    const result = await demoTelegramAdapter.publish(listing({ ownerRole: "demo" }), ctx);
    expect(result.externalId).toMatch(/^simulated:/);
  });

  it("posts the agency's listings for real once a bot is set up", async () => {
    const calls: string[] = [];
    const fetch = (async (url: string) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ ok: true, result: { message_id: 7 } }));
    }) as unknown as typeof globalThis.fetch;
    const result = await demoTelegramAdapter.publish(
      listing({ ownerRole: "admin", photos: [] }),
      context({ env: live, fetch }),
    );
    expect(calls[0]).toContain("api.telegram.org/bot123:abc/");
    expect(result.externalId).toContain("@agency|7");
  });

  it("publishes for real a post that was only simulated before", async () => {
    let method = "";
    const fetch = (async (url: string) => {
      method = String(url).split("/").pop()!;
      return new Response(JSON.stringify({ ok: true, result: { message_id: 8 } }));
    }) as unknown as typeof globalThis.fetch;
    await demoTelegramAdapter.update(
      listing({ ownerRole: "admin", photos: [] }),
      "simulated:CB-0001",
      context({ env: live, fetch }),
    );
    expect(method).toBe("sendMessage");
  });
});
