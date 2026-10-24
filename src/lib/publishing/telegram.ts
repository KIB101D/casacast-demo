import type { Locale } from "@/db/schema";
import { formatPrice } from "@/lib/format";
import { PROPERTY_TYPE_LABELS } from "@/lib/labels";
import { ChannelError, type ListingSnapshot } from "./types";

/**
 * Telegram Bot API, called with plain fetch. Posts go to a channel where the bot is an admin.
 * The token is a secret (env only); chat ids may be "@public_channel" or a numeric "-100…" id.
 */

/** Telegram's limit for a photo caption. */
export const CAPTION_LIMIT = 1024;

const CAPTION_LOCALES: Locale[] = ["en", "es", "uk"];

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** The post text, HTML-formatted, within Telegram's caption limit. */
export function buildCaption(listing: ListingSnapshot, options: { sold?: boolean } = {}) {
  const text =
    CAPTION_LOCALES.map((l) => listing.translations.find((t) => t.locale === l)).find(Boolean) ??
    null;
  const title = text?.title ?? listing.reference;
  const facts = [
    PROPERTY_TYPE_LABELS[listing.type],
    listing.type === "land" ? null : `${listing.bedrooms} bed`,
    listing.type === "land" ? null : `${listing.bathrooms} bath`,
    listing.type === "land" ? `${listing.area} m² plot` : `${listing.area} m²`,
    listing.type !== "land" && listing.plotArea ? `${listing.plotArea} m² plot` : null,
    listing.town,
  ]
    .filter(Boolean)
    .join(" · ");

  const head = [
    options.sold ? "✅ <b>SOLD</b>" : null,
    options.sold ? `<s>${escapeHtml(title)}</s>` : `<b>${escapeHtml(title)}</b>`,
    `${escapeHtml(formatPrice(listing.price, listing.operation))} · ${escapeHtml(facts)}`,
  ]
    .filter(Boolean)
    .join("\n");
  const link = `<a href="${escapeHtml(listing.pageUrls.en)}">View the listing</a> · ${escapeHtml(listing.reference)}`;

  // The description fills whatever room is left; it is cut at a word, never mid-tag.
  const room = CAPTION_LIMIT - head.length - link.length - 4;
  let description = text?.description.trim() ?? "";
  if (options.sold) description = "";
  if (description.length > room) {
    description = description.slice(0, Math.max(0, room - 1)).replace(/\s+\S*$/, "") + "…";
  }
  return [head, description ? escapeHtml(description) : null, link].filter(Boolean).join("\n\n");
}

/** Public link to a channel post, when the channel has one. */
export function messageUrl(chatId: string, messageId: number) {
  if (chatId.startsWith("@")) return `https://t.me/${chatId.slice(1)}/${messageId}`;
  if (chatId.startsWith("-100")) return `https://t.me/c/${chatId.slice(4)}/${messageId}`;
  return null;
}

/**
 * Our id for a post: chat, message and whether it is a photo (edited with editMessageCaption) or
 * a text post (editMessageText). Kept together so a post stays editable if the chat id changes.
 */
export type MessageRef = { chatId: string; messageId: number; kind: "photo" | "text" };

export function encodeMessageRef({ chatId, messageId, kind }: MessageRef) {
  return `${chatId}|${messageId}|${kind}`;
}

export function decodeMessageRef(externalId: string): MessageRef {
  const [chatId = "", messageId = "0", kind] = externalId.split("|");
  return { chatId, messageId: Number(messageId), kind: kind === "text" ? "text" : "photo" };
}

type TelegramResponse<T> =
  | { ok: true; result: T }
  | { ok: false; error_code: number; description: string; parameters?: { retry_after?: number } };

/**
 * Calls one Bot API method and turns its failures into ChannelErrors: rate limits, server errors
 * and network trouble are worth retrying; a 400 (bad request) or 401/403 (token, rights) is not.
 */
export async function callTelegram<T>(
  fetchFn: typeof fetch,
  token: string,
  method: string,
  body: Record<string, unknown>,
): Promise<T> {
  let response: Response;
  try {
    response = await fetchFn(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new ChannelError(`Could not reach Telegram: ${reason}`, { retryable: true });
  }

  let data: TelegramResponse<T>;
  try {
    data = (await response.json()) as TelegramResponse<T>;
  } catch {
    throw new ChannelError(`Telegram answered ${response.status} without JSON`, {
      retryable: response.status >= 500,
    });
  }
  if (data.ok) return data.result;

  const retryAfter = data.parameters?.retry_after;
  throw new ChannelError(`Telegram ${data.error_code}: ${data.description}`, {
    retryable: data.error_code === 429 || data.error_code >= 500,
    retryAfterMs: retryAfter ? retryAfter * 1000 : undefined,
  });
}

/** Editing a post to exactly what it already says is an error in Telegram, but not for us. */
export function isNotModified(error: unknown) {
  return error instanceof ChannelError && /message is not modified/i.test(error.message);
}

/** A post the bot can no longer find or delete (deleted by hand, or too old to delete). */
export function isGone(error: unknown) {
  return (
    error instanceof ChannelError &&
    /message to (edit|delete) not found|message can't be (deleted|edited)/i.test(error.message)
  );
}
