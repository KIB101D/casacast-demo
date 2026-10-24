import { describe, expect, it, vi } from "vitest";
import { telegramAdapter } from "./adapters/telegram";
import { context, failure, listing } from "./test-fixtures";
import {
  buildCaption,
  callTelegram,
  CAPTION_LIMIT,
  decodeMessageRef,
  encodeMessageRef,
  messageUrl,
} from "./telegram";
import { ChannelError } from "./types";

type Call = { method: string; body: Record<string, unknown> };

/** A fake Bot API: records calls and answers from a queue of responses. */
function fakeTelegram(...responses: unknown[]) {
  const calls: Call[] = [];
  const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({
      method: String(url).split("/").pop()!,
      body: JSON.parse(String(init?.body)) as Record<string, unknown>,
    });
    const next = responses.shift() ?? { ok: true, result: true };
    if (next instanceof Error) throw next;
    return new Response(JSON.stringify(next), { headers: { "content-type": "application/json" } });
  });
  return { calls, fetch: fetch as unknown as typeof globalThis.fetch };
}

const env = {
  TELEGRAM_BOT_TOKEN: "123:abc",
  TELEGRAM_CHAT_ID: "@casacast_agency",
  TELEGRAM_TEST_CHAT_ID: "@casacast_test",
};

describe("buildCaption", () => {
  it("has the title, price, facts and a link back to the site", () => {
    const caption = buildCaption(listing());
    expect(caption).toContain("<b>Bright flat 300 m from the beach</b>");
    expect(caption).toContain("€189,000 · Flat · 2 bed · 1 bath · 78 m² · Torrevieja");
    expect(caption).toContain('href="https://casacast.example/en/homes/cb-0001-bright-flat"');
  });

  it("stays within Telegram's caption limit, cutting the description at a word", () => {
    const long = "Sunny terrace with sea views. ".repeat(80);
    const caption = buildCaption(
      listing({ translations: [{ locale: "en", title: "Flat", description: long }] }),
    );
    expect(caption.length).toBeLessThanOrEqual(CAPTION_LIMIT);
    expect(caption).toContain("…");
  });

  it("mentions the plot of a house, and calls land's area a plot", () => {
    expect(buildCaption(listing({ type: "chalet", area: 210, plotArea: 900 }))).toContain(
      "210 m² · 900 m² plot",
    );
    expect(buildCaption(listing({ type: "land", area: 1200 }))).toContain("Land · 1200 m² plot");
  });

  it("escapes HTML in listing text", () => {
    const caption = buildCaption(
      listing({
        translations: [{ locale: "en", title: "A <b>bold</b> & big flat", description: "" }],
      }),
    );
    expect(caption).toContain("A &lt;b&gt;bold&lt;/b&gt; &amp; big flat");
  });

  it("marks a sold listing and drops the description", () => {
    const caption = buildCaption(listing(), { sold: true });
    expect(caption).toMatch(/^✅ <b>SOLD<\/b>/);
    expect(caption).toContain("<s>Bright flat 300 m from the beach</s>");
    expect(caption).not.toContain("south-facing");
  });
});

describe("message references", () => {
  it("round-trips chat, message and kind", () => {
    const ref = { chatId: "-1001234", messageId: 77, kind: "text" as const };
    expect(decodeMessageRef(encodeMessageRef(ref))).toEqual(ref);
  });

  it("links public and private channel posts", () => {
    expect(messageUrl("@casacast_test", 5)).toBe("https://t.me/casacast_test/5");
    expect(messageUrl("-1009876543", 5)).toBe("https://t.me/c/9876543/5");
  });
});

describe("callTelegram", () => {
  it("retries rate limits after Telegram's retry_after", async () => {
    const { fetch } = fakeTelegram({
      ok: false,
      error_code: 429,
      description: "Too Many Requests: retry after 30",
      parameters: { retry_after: 30 },
    });
    const error = await failure(callTelegram(fetch, "t", "sendMessage", {}));
    expect(error).toMatchObject({ retryable: true, retryAfterMs: 30_000 });
  });

  it("retries server errors and network failures", async () => {
    const server = fakeTelegram({ ok: false, error_code: 502, description: "Bad Gateway" });
    expect(await failure(callTelegram(server.fetch, "t", "x", {}))).toMatchObject({
      retryable: true,
    });
    const offline = fakeTelegram(new TypeError("fetch failed"));
    const error = await failure(callTelegram(offline.fetch, "t", "x", {}));
    expect(error).toMatchObject({ retryable: true });
    expect(error.message).toContain("Could not reach Telegram");
  });

  it("does not retry bad requests or a bad token", async () => {
    const { fetch } = fakeTelegram({ ok: false, error_code: 401, description: "Unauthorized" });
    expect(await failure(callTelegram(fetch, "t", "x", {}))).toMatchObject({
      retryable: false,
    });
  });
});

describe("telegramAdapter", () => {
  it("posts the cover photo with the caption to the agency channel", async () => {
    const tg = fakeTelegram({ ok: true, result: { message_id: 10 } });
    const result = await telegramAdapter.publish(listing(), context({ env, fetch: tg.fetch }));
    expect(tg.calls[0]).toMatchObject({
      method: "sendPhoto",
      body: { chat_id: "@casacast_agency", parse_mode: "HTML" },
    });
    expect(result).toEqual({
      externalId: "@casacast_agency|10|photo",
      url: "https://t.me/casacast_agency/10",
      detail: "Posted to the channel",
    });
  });

  it("sends demo listings to the test channel only", async () => {
    const tg = fakeTelegram({ ok: true, result: { message_id: 3 } });
    const result = await telegramAdapter.publish(
      listing({ ownerRole: "demo" }),
      context({ env, fetch: tg.fetch }),
    );
    expect(tg.calls[0]!.body.chat_id).toBe("@casacast_test");
    expect(result.detail).toBe("Posted to the test channel");
  });

  it("falls back to a text post when the photo isn't public (local development)", async () => {
    const tg = fakeTelegram({ ok: true, result: { message_id: 4 } });
    const result = await telegramAdapter.publish(
      listing({ photos: ["http://localhost:3000/uploads/a.webp"] }),
      context({ env, fetch: tg.fetch }),
    );
    expect(tg.calls[0]!.method).toBe("sendMessage");
    expect(result.externalId).toBe("@casacast_agency|4|text");
  });

  it("explains what's missing when Telegram isn't configured, without retrying", async () => {
    const error = await failure(
      telegramAdapter.publish(
        listing({ ownerRole: "demo" }),
        context({ env: { TELEGRAM_BOT_TOKEN: "x" } }),
      ),
    );
    expect(error).toBeInstanceOf(ChannelError);
    expect(error.retryable).toBe(false);
    expect(error.message).toContain("TELEGRAM_TEST_CHAT_ID");
  });

  it("edits the caption on update, and ignores 'message is not modified'", async () => {
    const tg = fakeTelegram({
      ok: false,
      error_code: 400,
      description: "Bad Request: message is not modified",
    });
    const result = await telegramAdapter.update(
      listing(),
      "@casacast_agency|10|photo",
      context({ env, fetch: tg.fetch }),
    );
    expect(tg.calls[0]).toMatchObject({ method: "editMessageCaption", body: { message_id: 10 } });
    expect(result.detail).toBe("Post updated");
  });

  it("posts again when the old post was deleted by hand", async () => {
    const tg = fakeTelegram(
      { ok: false, error_code: 400, description: "Bad Request: message to edit not found" },
      { ok: true, result: { message_id: 11 } },
    );
    const result = await telegramAdapter.update(
      listing(),
      "@casacast_agency|10|photo",
      context({ env, fetch: tg.fetch }),
    );
    expect(tg.calls.map((c) => c.method)).toEqual(["editMessageCaption", "sendPhoto"]);
    expect(result.externalId).toBe("@casacast_agency|11|photo");
  });

  it("marks a sold listing's post as sold and keeps it", async () => {
    const tg = fakeTelegram();
    const result = await telegramAdapter.unpublish(
      listing(),
      "@casacast_agency|10|text",
      "sold",
      context({ env, fetch: tg.fetch }),
    );
    expect(tg.calls[0]!.method).toBe("editMessageText");
    expect(String(tg.calls[0]!.body.text)).toContain("SOLD");
    expect(result.externalId).toBe("@casacast_agency|10|text");
  });

  it("deletes the post when a listing is withdrawn", async () => {
    const tg = fakeTelegram();
    const result = await telegramAdapter.unpublish(
      listing(),
      "@casacast_agency|10|photo",
      "withdrawn",
      context({ env, fetch: tg.fetch }),
    );
    expect(tg.calls[0]).toMatchObject({ method: "deleteMessage", body: { message_id: 10 } });
    expect(result.externalId).toBeNull();
  });
});
