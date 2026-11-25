import { DelayedError, Job } from 'bullmq';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { nextHourStart } from '../lib/time';
import { indexEmail } from '../services/search';
import { notifySlack } from '../services/slack';
import { sendViaSender } from '../services/mailer';
import { release, shouldNotify, tryConsume } from './rateLimit';
import type { EmailJobData } from './queue';

/** Offset inside the next hour so deferred emails keep their original relative order. */
const orderOffsetMs = (seq: number) => 1000 + (seq % 600_000) * 5;

export async function processEmailJob(job: Job<EmailJobData>, token?: string): Promise<void> {
  const { emailId } = job.data;

  // Idempotency: atomically claim the row. Only one worker can win; sent/failed/sending rows are skipped.
  const claimed = await prisma.$executeRaw`
    UPDATE emails SET status = 'sending', "updatedAt" = now()
    WHERE id = ${emailId} AND status IN ('scheduled', 'delayed')`;
  if (claimed === 0) {
    console.log(`[worker] skip ${emailId}: already claimed or finished`);
    return;
  }

  const email = await prisma.email.findUniqueOrThrow({
    where: { id: emailId },
    include: { sender: true, campaign: true },
  });

  // Per-sender hourly rate limit (UI value may lower the env limit, never raise it).
  const limit = Math.min(config.maxEmailsPerHourPerSender, email.campaign.hourlyLimit ?? Infinity);
  const slot = await tryConsume(email.senderId, limit);

  if (!slot.allowed) {
    const next = new Date(nextHourStart().getTime() + orderOffsetMs(email.seq));
    const updated = await prisma.email.update({
      where: { id: emailId },
      data: { status: 'delayed', scheduledAt: next },
    });
    await indexEmail(updated);

    if (await shouldNotify(email.senderId, slot.hour)) {
      await notifySlack(
        email.userId,
        `:warning: Hourly limit reached for sender *${email.sender.email}* (${limit}/hour). ` +
          `Remaining emails are delayed to the next hour window (starting ${nextHourStart().toISOString()}).`,
      );
    }

    await job.moveToDelayed(next.getTime(), token);
    throw new DelayedError();
  }

  try {
    const { previewUrl } = await sendViaSender(email.sender, email.recipient, email.subject, email.body);
    const updated = await prisma.email.update({
      where: { id: emailId },
      data: { status: 'sent', sentAt: new Date(), previewUrl, attempts: { increment: 1 }, error: null },
    });
    await indexEmail(updated);
    console.log(`[worker] sent ${emailId} -> ${email.recipient}`);
  } catch (err) {
    await release(email.senderId, slot.hour);
    const finalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
    const updated = await prisma.email.update({
      where: { id: emailId },
      // Put it back to 'scheduled' so the BullMQ retry can claim it again.
      data: {
        status: finalAttempt ? 'failed' : 'scheduled',
        attempts: { increment: 1 },
        error: (err as Error).message.slice(0, 500),
      },
    });
    await indexEmail(updated);
    throw err;
  }
}
