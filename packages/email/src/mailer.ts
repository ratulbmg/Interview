import nodemailer, { Transporter } from "nodemailer";

let transporter: Transporter | null = null;

/** Lazily created so importing this module never requires SMTP env vars to
 * already be set — only sending an actual email does. Dev points this at
 * Mailhog (see docker-compose.dev.yml's mailhog service, no auth needed);
 * prod points it at a real SMTP relay. */
function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "localhost",
      port: Number(process.env.SMTP_PORT ?? 1025),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }
  return transporter;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  await getTransporter().sendMail({
    from:
      process.env.SMTP_FROM ??
      "Interview Platform <no-reply@interview-platform.local>",
    to,
    subject,
    html,
  });
}
