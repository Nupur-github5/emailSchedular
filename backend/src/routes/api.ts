import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import type { EmailStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { requireAuth } from '../auth/jwt';
import { enqueueEmails } from '../queue/queue';
import { indexEmails, searchEmails } from '../services/search';

export const apiRouter = Router();
apiRouter.use(requireAuth);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_RECIPIENTS = 10_000;

const campaignSchema = z.object({
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(50_000),
  recipients: z.array(z.string()).min(1).max(MAX_RECIPIENTS),
  startTime: z.string().datetime({ offset: true }),
  delayBetweenMs: z.number().int().min(0).max(24 * 3600 * 1000),
  hourlyLimit: z.number().int().positive().nullish(),
});

apiRouter.post('/campaigns', async (req, res) => {
  const parsed = campaignSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  const input = parsed.data;

  const recipients = [...new Set(input.recipients.map((r) => r.trim().toLowerCase()))].filter((r) => EMAIL_RE.test(r));
  if (recipients.length === 0) return res.status(400).json({ error: 'No valid email addresses' });

  const senders = await prisma.sender.findMany({ orderBy: { createdAt: 'asc' } });
  if (senders.length === 0) return res.status(500).json({ error: 'No senders configured. Run the seed: npm run db:setup' });

  const userId = req.userId!;
  const start = new Date(Math.max(new Date(input.startTime).getTime(), Date.now()));
  const hourlyLimit = input.hourlyLimit ? Math.min(input.hourlyLimit, config.maxEmailsPerHourPerSender) : null;

  const campaign = await prisma.campaign.create({
    data: {
      userId,
      subject: input.subject,
      body: input.body,
      startTime: start,
      delayBetweenMs: input.delayBetweenMs,
      hourlyLimit,
      totalEmails: recipients.length,
    },
  });

  const rows: Prisma.EmailCreateManyInput[] = recipients.map((recipient, i) => ({
    id: randomUUID(),
    campaignId: campaign.id,
    userId,
    senderId: senders[i % senders.length].id, // round-robin
    recipient,
    subject: input.subject,
    body: input.body,
    status: 'scheduled',
    seq: i,
    scheduledAt: new Date(start.getTime() + i * input.delayBetweenMs),
  }));

  for (let i = 0; i < rows.length; i += 1000) {
    await prisma.email.createMany({ data: rows.slice(i, i + 1000) });
  }

  const jobs = rows.map((r) => ({ id: r.id!, scheduledAt: r.scheduledAt as Date }));
  await enqueueEmails(jobs);

  // Index in ES (non-blocking for the response; failures are logged only).
  void (async () => {
    for (let i = 0; i < rows.length; i += 500) {
      await indexEmails(
        rows.slice(i, i + 500).map((r) => ({
          id: r.id!,
          userId,
          campaignId: campaign.id,
          senderId: r.senderId,
          recipient: r.recipient,
          subject: r.subject,
          body: r.body,
          status: 'scheduled' as EmailStatus,
          scheduledAt: r.scheduledAt as Date,
          sentAt: null,
          previewUrl: null,
        })),
      );
    }
  })();

  res.status(201).json({
    campaignId: campaign.id,
    scheduled: rows.length,
    skippedInvalidOrDuplicate: input.recipients.length - recipients.length,
    firstAt: rows[0].scheduledAt,
    lastAt: rows[rows.length - 1].scheduledAt,
  });
});

const TAB_STATUSES: Record<'scheduled' | 'sent', EmailStatus[]> = {
  scheduled: ['scheduled', 'delayed', 'sending'],
  sent: ['sent', 'failed'],
};

apiRouter.get('/emails', async (req, res) => {
  const tab = req.query.status === 'sent' ? 'sent' : 'scheduled';
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
  const where: Prisma.EmailWhereInput = { userId: req.userId, status: { in: TAB_STATUSES[tab] } };

  const [items, total] = await Promise.all([
    prisma.email.findMany({
      where,
      orderBy: tab === 'sent' ? [{ updatedAt: 'desc' }] : [{ scheduledAt: 'asc' }, { seq: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        recipient: true,
        subject: true,
        status: true,
        scheduledAt: true,
        sentAt: true,
        previewUrl: true,
        error: true,
        sender: { select: { email: true } },
      },
    }),
    prisma.email.count({ where }),
  ]);

  res.json({
    items: items.map(({ sender, ...e }) => ({ ...e, senderEmail: sender.email })),
    total,
    page,
    pageSize,
  });
});

apiRouter.get('/emails/counts', async (req, res) => {
  const groups = await prisma.email.groupBy({ by: ['status'], where: { userId: req.userId }, _count: true });
  const by = Object.fromEntries(groups.map((g) => [g.status, g._count])) as Partial<Record<EmailStatus, number>>;
  const sum = (s: EmailStatus[]) => s.reduce((n, k) => n + (by[k] ?? 0), 0);
  res.json({ scheduled: sum(TAB_STATUSES.scheduled), sent: sum(TAB_STATUSES.sent), byStatus: by });
});

apiRouter.get('/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) return res.json({ items: [], available: true });
  const hits = await searchEmails(req.userId!, q);
  if (hits === null) return res.json({ items: [], available: false });
  res.json({ items: hits, available: true });
});

apiRouter.get('/senders', async (_req, res) => {
  const senders = await prisma.sender.findMany({ select: { id: true, name: true, email: true }, orderBy: { createdAt: 'asc' } });
  res.json({ items: senders, maxEmailsPerHourPerSender: config.maxEmailsPerHourPerSender, minSendDelayMs: config.minSendDelayMs });
});
