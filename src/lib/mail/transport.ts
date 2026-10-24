import "server-only";
import nodemailer from "nodemailer";
import { AGENCY_NAME } from "@/lib/constants";
import { readMailConfig, type MailConfig } from "./config";

export function mailConfig(): MailConfig | null {
  return readMailConfig(process.env, AGENCY_NAME);
}

export type OutgoingMail = {
  to: string;
  replyTo: string;
  subject: string;
  text: string;
  messageId: string;
  inReplyTo?: string;
  references?: string[];
};

/** Sends one email from the agency mailbox over SMTP. Throws with the server's message on failure. */
export async function sendMail(config: MailConfig, mail: OutgoingMail) {
  const transport = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: { user: config.address, pass: config.password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  try {
    await transport.sendMail({
      from: { name: config.fromName, address: config.address },
      to: mail.to,
      replyTo: mail.replyTo,
      subject: mail.subject,
      text: mail.text,
      messageId: `<${mail.messageId}>`,
      inReplyTo: mail.inReplyTo ? `<${mail.inReplyTo}>` : undefined,
      references: mail.references?.map((id) => `<${id}>`),
    });
  } finally {
    transport.close();
  }
}
