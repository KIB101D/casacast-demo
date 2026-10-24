/**
 * The agency mailbox, from env. Gmail by default: smtp.gmail.com to send, imap.gmail.com to read,
 * signed in with an app password. Any other provider works by overriding hosts and ports.
 */
export type MailConfig = {
  address: string;
  password: string;
  fromName: string;
  smtp: { host: string; port: number; secure: boolean };
  imap: { host: string; port: number; secure: boolean };
};

function flag(value: string | undefined, fallback: boolean) {
  if (value === undefined || value === "") return fallback;
  return value !== "false" && value !== "0";
}

/** Null when the mailbox isn't set up: replies then can't be sent, and the UI says why. */
export function readMailConfig(
  env: Record<string, string | undefined>,
  defaultFromName: string,
): MailConfig | null {
  const address = env.MAIL_ADDRESS?.trim();
  const password = env.MAIL_APP_PASSWORD?.replace(/\s+/g, ""); // Google shows it in groups of four
  if (!address || !password) return null;
  return {
    address,
    password,
    fromName: env.MAIL_FROM_NAME?.trim() || defaultFromName,
    smtp: {
      host: env.MAIL_SMTP_HOST || "smtp.gmail.com",
      port: Number(env.MAIL_SMTP_PORT || 465),
      secure: flag(env.MAIL_SMTP_SECURE, true),
    },
    imap: {
      host: env.MAIL_IMAP_HOST || "imap.gmail.com",
      port: Number(env.MAIL_IMAP_PORT || 993),
      secure: flag(env.MAIL_IMAP_SECURE, true),
    },
  };
}
