import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { config } from './config';
import { authRouter } from './auth/google';
import { slackRouter } from './routes/slack';
import { apiRouter } from './routes/api';
import { emailQueue } from './queue/queue';
import { ensureIndex } from './services/search';

const app = express();
app.set('trust proxy', 1);
app.use(cors({ origin: config.frontendUrl, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());
app.use(passport.initialize());

app.get('/health', (_req, res) => res.json({ ok: true }));

const boardAdapter = new ExpressAdapter();
boardAdapter.setBasePath('/admin/queues');
createBullBoard({ queues: [new BullMQAdapter(emailQueue())], serverAdapter: boardAdapter });
app.use('/admin/queues', boardAdapter.getRouter());

app.use('/auth', authRouter);
app.use('/slack', slackRouter);
app.use('/api', apiRouter);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[api]', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(config.port, () => {
  console.log(`[api] listening on ${config.backendUrl} (port ${config.port})`);
  console.log(`[api] Bull Board: ${config.backendUrl}/admin/queues`);
  void ensureIndex();
});
