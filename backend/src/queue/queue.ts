import { Queue } from 'bullmq';
import { redis } from '../lib/redis';

export const EMAIL_QUEUE = 'email-send';

export interface EmailJobData {
  emailId: string;
}

let queue: Queue<EmailJobData> | null = null;

export function emailQueue(): Queue<EmailJobData> {
  if (!queue) {
    queue = new Queue<EmailJobData>(EMAIL_QUEUE, {
      connection: redis(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 5000 },
        removeOnFail: { count: 5000 },
      },
    });
  }
  return queue;
}

const CHUNK = 500;

/** Enqueue delayed jobs (jobId = email id, so re-adding is a no-op). */
export async function enqueueEmails(rows: { id: string; scheduledAt: Date }[]): Promise<void> {
  const q = emailQueue();
  for (let i = 0; i < rows.length; i += CHUNK) {
    const now = Date.now();
    await q.addBulk(
      rows.slice(i, i + CHUNK).map((r) => ({
        name: 'send',
        data: { emailId: r.id },
        opts: { jobId: r.id, delay: Math.max(0, r.scheduledAt.getTime() - now) },
      })),
    );
  }
}
