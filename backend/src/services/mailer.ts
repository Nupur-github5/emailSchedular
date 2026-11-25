import nodemailer, { Transporter } from 'nodemailer';
import type { Sender } from '@prisma/client';

const transporters = new Map<string, Transporter>();

export function transporterFor(sender: Sender): Transporter {
  let t = transporters.get(sender.id);
  if (!t) {
    t = nodemailer.createTransport({
      host: sender.smtpHost,
      port: sender.smtpPort,
      secure: sender.smtpPort === 465,
      auth: { user: sender.smtpUser, pass: sender.smtpPass },
    });
    transporters.set(sender.id, t);
  }
  return t;
}

export async function sendViaSender(sender: Sender, to: string, subject: string, body: string) {
  const info = await transporterFor(sender).sendMail({
    from: `"${sender.name}" <${sender.email}>`,
    to,
    subject,
    text: body,
  });
  return { messageId: info.messageId, previewUrl: nodemailer.getTestMessageUrl(info) || null };
}
