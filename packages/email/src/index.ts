import nodemailer from "nodemailer";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface Mailer {
  send(message: EmailMessage): Promise<void>;
}

/**
 * SMTP mailer. Local dev points at Mailpit (`smtp://localhost:1025`);
 * production uses Resend's SMTP endpoint (`smtps://resend:<key>@smtp.resend.com:465`).
 */
export function createSmtpMailer(options: { url: string; from: string }): Mailer {
  const transport = nodemailer.createTransport(options.url);
  return {
    async send(message) {
      await transport.sendMail({ from: options.from, ...message });
    },
  };
}
