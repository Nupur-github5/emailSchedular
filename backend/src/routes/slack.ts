import { Router } from 'express';
import { config } from '../config';
import { prisma } from '../lib/prisma';
import { requireAuth, signSlackState, verifySlackState } from '../auth/jwt';
import { notifySlack } from '../services/slack';

export const slackRouter = Router();

/** Browser navigates here from the dashboard (cookie present) -> redirect to Slack authorize. */
slackRouter.get('/connect', requireAuth, (req, res) => {
  if (!config.slack.clientId || !config.slack.redirectUri) {
    return res.redirect(`${config.frontendUrl}/dashboard?slack=not_configured`);
  }
  const url = new URL('https://slack.com/oauth/v2/authorize');
  url.searchParams.set('client_id', config.slack.clientId);
  url.searchParams.set('scope', 'incoming-webhook');
  url.searchParams.set('redirect_uri', config.slack.redirectUri);
  url.searchParams.set('state', signSlackState(req.userId!));
  res.redirect(url.toString());
});

interface SlackOAuthResponse {
  ok: boolean;
  error?: string;
  team?: { name?: string };
  incoming_webhook?: { url: string; channel?: string };
}

/** Arrives via PUBLIC_URL (ngrok); identifies user from signed `state`, not the cookie. */
slackRouter.get('/callback', async (req, res) => {
  const fail = (reason: string) => res.redirect(`${config.frontendUrl}/dashboard?slack=error&reason=${encodeURIComponent(reason)}`);
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  if (req.query.error) return fail(String(req.query.error));
  const userId = verifySlackState(state);
  if (!userId) return fail('invalid_state');
  if (!code) return fail('missing_code');

  try {
    const r = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.slack.clientId,
        client_secret: config.slack.clientSecret,
        code,
        redirect_uri: config.slack.redirectUri,
      }),
    });
    const data = (await r.json()) as SlackOAuthResponse;
    if (!data.ok || !data.incoming_webhook?.url) return fail(data.error ?? 'no_webhook');

    const fields = {
      webhookUrl: data.incoming_webhook.url,
      channel: data.incoming_webhook.channel ?? null,
      teamName: data.team?.name ?? null,
    };
    await prisma.slackConnection.upsert({ where: { userId }, update: fields, create: { userId, ...fields } });
    await notifySlack(userId, ':white_check_mark: Email Scheduler connected. You will be notified here when a sender hits its hourly limit.');
    res.redirect(`${config.frontendUrl}/dashboard?slack=connected`);
  } catch (e) {
    console.warn('[slack] oauth exchange failed:', (e as Error).message);
    fail('exchange_failed');
  }
});

slackRouter.post('/disconnect', requireAuth, async (req, res) => {
  await prisma.slackConnection.deleteMany({ where: { userId: req.userId } });
  res.json({ ok: true });
});

slackRouter.post('/test', requireAuth, async (req, res) => {
  const ok = await notifySlack(req.userId!, ':bell: Test notification from Email Scheduler.');
  res.status(ok ? 200 : 400).json({ ok });
});
