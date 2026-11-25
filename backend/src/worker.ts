import { Worker } from 'bullmq';
import { config } from './config';
import { createRedis } from './lib/redis';
import { prisma } from './lib/prisma';
import { EMAIL_QUEUE, EmailJobData, enqueueEmails } from './queue/queue';
import { processEmailJob } from './queue/processor';
import { ensureIndex } from './services/search';

/**
 * Restart safety net: every email still 'scheduled'/'delayed' in Postgres must have a job.
 * jobId = email.id, so BullMQ ignores ids that already exist; only missing jobs get re-added.
 */
async function reconcile() {
  const BATCH = 1000;
  let cursor: string | undefined;
  let total = 0;
  for (;;) {
    const rows = await prisma.email.findMany({
      where: { status: { in: ['scheduled', 'delayed'] } },
      select: { id: true, scheduledAt: true },
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (rows.length === 0) break;
    await enqueueEmails(rows);
    total += rows.length;
    cursor = rows[rows.length - 1].id;
  }
  console.log(`[worker] reconcile checked ${total} pending email(s)`);
}

async function main() {
  await ensureIndex();
  await reconcile();

  const worker = new Worker<EmailJobData>(EMAIL_QUEUE, processEmailJob, {
    connection: createRedis(),
    concurrency: config.workerConcurrency,
    limiter: { max: 1, duration: config.minSendDelayMs },
  });

  worker.on('failed', (job, err) => console.warn(`[worker] job ${job?.id} failed: ${err.message}`));
  worker.on('error', (err) => console.warn('[worker] error', err.message));

  console.log(
    `[worker] started: concurrency=${config.workerConcurrency}, minDelay=${config.minSendDelayMs}ms, ` +
      `maxPerHourPerSender=${config.maxEmailsPerHourPerSender}`,
  );

  const shutdown = async () => {
    console.log('[worker] shutting down...');
    await worker.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
