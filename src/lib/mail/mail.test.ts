import { describe, expect, it } from "vitest";
import { readMailConfig } from "./config";
import {
  composeReply,
  enquirySubject,
  extractReply,
  newReplyToken,
  normalizeMessageId,
  referencedIds,
  replyAddress,
  replySubject,
  tokenFromAddresses,
} from "./threading";

const MAILBOX = "casacast.agency@gmail.com";

describe("reply addresses", () => {
  it("puts the lead token after a plus", () => {
    expect(replyAddress(MAILBOX, "7f3a9c")).toBe("casacast.agency+lead-7f3a9c@gmail.com");
  });

  it("reads the token back from any recipient, ignoring case", () => {
    expect(
      tokenFromAddresses(["someone@else.com", "Casacast.Agency+lead-7F3A9C@Gmail.com"], MAILBOX),
    ).toBe("7f3a9c");
  });

  it("ignores other mailboxes and other plus tags", () => {
    expect(tokenFromAddresses(["other+lead-7f3a9c@gmail.com"], MAILBOX)).toBeNull();
    expect(tokenFromAddresses(["casacast.agency+lead-7f3a9c@other.com"], MAILBOX)).toBeNull();
    expect(tokenFromAddresses(["casacast.agency+news@gmail.com"], MAILBOX)).toBeNull();
    expect(tokenFromAddresses([MAILBOX], MAILBOX)).toBeNull();
  });

  it("makes readable, unique-enough tokens", () => {
    const tokens = new Set(Array.from({ length: 500 }, () => newReplyToken()));
    expect(tokens.size).toBe(500);
    for (const token of tokens) expect(token).toMatch(/^[a-km-np-z2-9]{10}$/);
  });
});

describe("threading headers", () => {
  it("compares Message-IDs without angle brackets", () => {
    expect(normalizeMessageId(" <abc@gmail.com> ")).toBe("abc@gmail.com");
    expect(normalizeMessageId("")).toBeNull();
  });

  it("collects In-Reply-To first, then References", () => {
    expect(referencedIds("<b@x>", "<a@x> <b@x>")).toEqual(["b@x", "a@x", "b@x"]);
    expect(referencedIds(undefined, ["<a@x>", "<c@x>"])).toEqual(["a@x", "c@x"]);
    expect(referencedIds(null, null)).toEqual([]);
  });
});

describe("subjects", () => {
  it("names the listing in the first subject", () => {
    expect(enquirySubject("CB-0003", "Casacast")).toBe("Your enquiry about CB-0003 · Casacast");
    expect(enquirySubject(null, "Casacast")).toBe("Your enquiry · Casacast");
  });

  it("adds Re: once", () => {
    expect(replySubject("Your enquiry")).toBe("Re: Your enquiry");
    expect(replySubject("RE: Your enquiry")).toBe("RE: Your enquiry");
  });
});

describe("extractReply", () => {
  it("keeps only the new text of a reply", () => {
    const email = [
      "Saturday at 11 works for me, thanks!",
      "",
      "On Thu, 22 Oct 2026 at 14:00, Casacast <casacast.agency@gmail.com> wrote:",
      "> Hello Olena, the flat is still available.",
      "> Would Saturday suit you?",
    ].join("\n");
    expect(extractReply(email)).toBe("Saturday at 11 works for me, thanks!");
  });

  it("drops a quote header in the client's language (Gmail in Ukrainian)", () => {
    const email = [
      "What is the price?",
      "",
      "чт, 22 жовт. 2026 р. о 16:49 Casacast <casacast.agency@gmail.com> пише:",
      "> Hi, we have a flat for you",
    ].join("\n");
    expect(extractReply(email)).toBe("What is the price?");
  });

  it("drops a quote header that wrapped over two lines", () => {
    const email = [
      "¿Tiene garaje?",
      "",
      "El jue, 22 oct 2026 a las 16:49, Casacast (<casacast.agency@gmail.com>)",
      "escribió:",
      "> Hola, el piso está disponible.",
    ].join("\n");
    expect(extractReply(email)).toBe("¿Tiene garaje?");
  });

  it("keeps the client's last line above a header, numbers and all", () => {
    const email =
      "Call me on 600 000 000\n\nOn Thu, Casacast <casacast.agency@gmail.com> wrote:\n> Hi";
    expect(extractReply(email)).toBe("Call me on 600 000 000");
  });

  it("keeps a client's own line that ends with a colon", () => {
    expect(extractReply("Two questions:\n1. Parking?\n2. Pets?")).toBe(
      "Two questions:\n1. Parking?\n2. Pets?",
    );
  });

  it("keeps the whole text when nothing is quoted", () => {
    expect(extractReply("Just a question about parking.")).toBe("Just a question about parking.");
  });
});

describe("composeReply", () => {
  it("adds the signature and quotes the message being answered", () => {
    const text = composeReply({
      body: "Hello Olena, the flat is still available.",
      signature: "Casacast\n+34 600 000 000 · https://casacast.example",
      quoted: { author: "Olena", date: "22 Oct, 13:45", text: "Is it available?\nThanks" },
    });
    expect(text).toBe(
      [
        "Hello Olena, the flat is still available.",
        "",
        "—\nCasacast\n+34 600 000 000 · https://casacast.example",
        "",
        "On 22 Oct, 13:45, Olena wrote:\n> Is it available?\n> Thanks",
      ].join("\n"),
    );
  });
});

describe("readMailConfig", () => {
  it("is off without an address and app password", () => {
    expect(readMailConfig({}, "Casacast")).toBeNull();
    expect(readMailConfig({ MAIL_ADDRESS: MAILBOX }, "Casacast")).toBeNull();
  });

  it("defaults to Gmail over TLS, and strips the spaces Google shows in app passwords", () => {
    expect(
      readMailConfig(
        { MAIL_ADDRESS: MAILBOX, MAIL_APP_PASSWORD: "abcd efgh ijkl mnop" },
        "Casacast",
      ),
    ).toEqual({
      address: MAILBOX,
      password: "abcdefghijklmnop",
      fromName: "Casacast",
      smtp: { host: "smtp.gmail.com", port: 465, secure: true },
      imap: { host: "imap.gmail.com", port: 993, secure: true },
    });
  });

  it("takes other servers for other providers or local testing", () => {
    const config = readMailConfig(
      {
        MAIL_ADDRESS: "agency@local.test",
        MAIL_APP_PASSWORD: "pw",
        MAIL_SMTP_HOST: "127.0.0.1",
        MAIL_SMTP_PORT: "2525",
        MAIL_SMTP_SECURE: "false",
        MAIL_IMAP_PORT: "1143",
        MAIL_IMAP_SECURE: "0",
      },
      "Casacast",
    );
    expect(config?.smtp).toEqual({ host: "127.0.0.1", port: 2525, secure: false });
    expect(config?.imap).toEqual({ host: "imap.gmail.com", port: 1143, secure: false });
  });
});
