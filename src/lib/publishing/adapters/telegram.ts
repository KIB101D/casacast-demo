import {
  buildCaption,
  callTelegram,
  decodeMessageRef,
  encodeMessageRef,
  isGone,
  isNotModified,
  messageUrl,
  type MessageRef,
} from "../telegram";
import {
  ChannelError,
  type AdapterResult,
  type ChannelAdapter,
  type ChannelContext,
  type ListingSnapshot,
} from "../types";

/**
 * Posts to a Telegram channel through a bot. Listings created by the demo account go to the test
 * channel only, so visitors trying the demo never post to the agency's real channel.
 */
function target(listing: ListingSnapshot, ctx: ChannelContext) {
  const token = ctx.env.TELEGRAM_BOT_TOKEN;
  const demo = listing.ownerRole === "demo";
  const chatId = demo ? ctx.env.TELEGRAM_TEST_CHAT_ID : ctx.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    throw new ChannelError(
      demo
        ? "Telegram isn't set up for demo listings: set TELEGRAM_BOT_TOKEN and TELEGRAM_TEST_CHAT_ID."
        : "Telegram isn't set up: set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.",
      { retryable: false },
    );
  }
  return { token, chatId, label: demo ? "the test channel" : "the channel" };
}

/** Telegram fetches photos by URL itself, so only public https URLs work (not localhost). */
function publicPhoto(listing: ListingSnapshot) {
  const url = listing.photos[0];
  if (!url) return null;
  const { protocol, hostname } = new URL(url);
  return protocol === "https:" && hostname !== "localhost" ? url : null;
}

function result(ref: MessageRef, detail: string): AdapterResult {
  return { externalId: encodeMessageRef(ref), url: messageUrl(ref.chatId, ref.messageId), detail };
}

async function post(listing: ListingSnapshot, ctx: ChannelContext): Promise<AdapterResult> {
  const { token, chatId, label } = target(listing, ctx);
  const caption = buildCaption(listing);
  const photo = publicPhoto(listing);
  const message = photo
    ? await callTelegram<{ message_id: number }>(ctx.fetch, token, "sendPhoto", {
        chat_id: chatId,
        photo,
        caption,
        parse_mode: "HTML",
      })
    : await callTelegram<{ message_id: number }>(ctx.fetch, token, "sendMessage", {
        chat_id: chatId,
        text: caption,
        parse_mode: "HTML",
      });
  return result(
    { chatId, messageId: message.message_id, kind: photo ? "photo" : "text" },
    `Posted to ${label}`,
  );
}

async function edit(ref: MessageRef, text: string, ctx: ChannelContext, token: string) {
  try {
    await callTelegram(
      ctx.fetch,
      token,
      ref.kind === "photo" ? "editMessageCaption" : "editMessageText",
      {
        chat_id: ref.chatId,
        message_id: ref.messageId,
        parse_mode: "HTML",
        ...(ref.kind === "photo" ? { caption: text } : { text }),
      },
    );
  } catch (error) {
    if (!isNotModified(error)) throw error;
  }
}

export const telegramAdapter: ChannelAdapter = {
  type: "telegram",
  mode: "remote",
  publish: post,
  async update(listing, externalId, ctx) {
    const { token } = target(listing, ctx);
    const ref = decodeMessageRef(externalId);
    try {
      await edit(ref, buildCaption(listing), ctx, token);
    } catch (error) {
      // Someone deleted the post by hand: post it again rather than fail forever.
      if (isGone(error)) return post(listing, ctx);
      throw error;
    }
    return result(ref, "Post updated");
  },
  async unpublish(listing, externalId, reason, ctx) {
    const { token } = target(listing, ctx);
    const ref = decodeMessageRef(externalId);

    if (reason === "sold") {
      // Sold posts stay, marked as sold: the channel's history is part of the agency's track record.
      try {
        await edit(ref, buildCaption(listing, { sold: true }), ctx, token);
      } catch (error) {
        if (isGone(error)) return { externalId: null, url: null, detail: "Post was already gone" };
        throw error;
      }
      return result(ref, "Post marked as sold");
    }

    try {
      await callTelegram(ctx.fetch, token, "deleteMessage", {
        chat_id: ref.chatId,
        message_id: ref.messageId,
      });
    } catch (error) {
      if (!isGone(error)) throw error;
    }
    return { externalId: null, url: null, detail: "Post deleted" };
  },
};
