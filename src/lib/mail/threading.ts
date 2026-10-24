import { randomBytes } from "node:crypto";
import EmailReplyParser from "email-reply-parser";

/**
 * How a client's reply finds its enquiry. Our emails go out with
 * `Reply-To: agency+lead-<token>@gmail.com`: Gmail (like most providers) delivers "+anything"
 * to the same mailbox but keeps the address on the email, so the token survives any mail client.
 * The standard In-Reply-To / References headers are the fallback.
 */

const TOKEN_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // no 0/o, 1/l: easy to read in an address

export function newReplyToken(length = 10) {
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => TOKEN_ALPHABET[b % TOKEN_ALPHABET.length]).join("");
}

function split(address: string) {
  const at = address.lastIndexOf("@");
  return { local: address.slice(0, at), domain: address.slice(at + 1) };
}

/** casacast.agency@gmail.com + "7f3a9c" → casacast.agency+lead-7f3a9c@gmail.com */
export function replyAddress(mailbox: string, token: string) {
  const { local, domain } = split(mailbox);
  return `${local}+lead-${token}@${domain}`;
}

/** The lead token in any of the addresses an email was sent to, if it's our mailbox's. */
export function tokenFromAddresses(addresses: string[], mailbox: string): string | null {
  const { local, domain } = split(mailbox.toLowerCase());
  for (const raw of addresses) {
    const address = raw.trim().toLowerCase();
    const at = address.lastIndexOf("@");
    if (at < 0 || address.slice(at + 1) !== domain) continue;
    const match = /^(.+)\+lead-([a-z0-9]{4,32})$/.exec(address.slice(0, at));
    if (match && match[1] === local) return match[2]!;
  }
  return null;
}

/** Message-IDs without angle brackets, so stored and received ones compare equal. */
export function normalizeMessageId(id: string | null | undefined): string | null {
  const trimmed = id?.trim().replace(/^<|>$/g, "");
  return trimmed ? trimmed : null;
}

/** Every Message-ID an email refers to: In-Reply-To first, then References. */
export function referencedIds(inReplyTo?: string | null, references?: string | string[] | null) {
  const refs = Array.isArray(references) ? references.join(" ") : (references ?? "");
  return [inReplyTo ?? "", ...refs.split(/\s+/)]
    .map(normalizeMessageId)
    .filter((id): id is string => id !== null);
}

export function enquirySubject(reference: string | null, agencyName: string) {
  return reference
    ? `Your enquiry about ${reference} · ${agencyName}`
    : `Your enquiry · ${agencyName}`;
}

export function replySubject(subject: string) {
  return /^re:/i.test(subject.trim()) ? subject.trim() : `Re: ${subject.trim()}`;
}

/**
 * The line mail clients put above a quote: "On Thu, 22 Oct 2026, Casacast <a@b.c> wrote:", in the
 * client's language ("… пише:", "… escribió:"). Recognised by its verb, or by an address in it
 * together with the trailing colon.
 */
const QUOTE_HEADER =
  /(wrote|writes|пише|написав|написала|написал|escribió|escribio|a écrit|schrieb|scrisse|escreveu|napisał|napisała|schreef)\s*:\s*$/i;

function isQuoteHeader(line: string) {
  const trimmed = line.trim();
  return (
    QUOTE_HEADER.test(trimmed) ||
    (/:\s*$/.test(trimmed) && /<[^>\s]+@[^>\s]+>|\S+@\S+\.\S+/.test(trimmed))
  );
}

/** Only what the client wrote this time: quoted history, its header line and signatures cut off. */
export function extractReply(text: string) {
  const reply = new EmailReplyParser().parseReply(text.replace(/\r\n/g, "\n")).trim();
  const lines = (reply || text.trim()).split("\n");
  // The parser drops the quote but not always a localised header above it (Gmail in Ukrainian,
  // Spanish…). Long headers wrap, so the line before can belong to it too.
  while (lines.length > 1) {
    const last = lines[lines.length - 1]!;
    if (last.trim() === "") {
      lines.pop();
      continue;
    }
    if (!isQuoteHeader(last)) break;
    lines.pop();
    // A header that wrapped leaves just the verb ("escribió:") on its last line; the date and the
    // address are on the line before.
    const previous = lines[lines.length - 1];
    if (!last.includes("@") && previous !== undefined && previous.includes("@")) lines.pop();
  }
  return lines.join("\n").trim();
}

/** The email we send: the agent's text, a signature, and the message being answered, quoted. */
export function composeReply(input: {
  body: string;
  signature: string;
  quoted?: { author: string; date: string; text: string };
}) {
  const parts = [input.body.trim(), `—\n${input.signature}`];
  if (input.quoted) {
    const quote = input.quoted.text
      .trim()
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");
    parts.push(`On ${input.quoted.date}, ${input.quoted.author} wrote:\n${quote}`);
  }
  return parts.join("\n\n");
}
