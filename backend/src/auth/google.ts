import { Router } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { config } from '../config';
import { prisma } from '../lib/prisma';
import { COOKIE_NAME, requireAuth, signSession } from './jwt';

const enabled = Boolean(config.google.clientId && config.google.clientSecret && config.google.callbackUrl);

if (enabled) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.google.clientId,
        clientSecret: config.google.clientSecret,
        callbackURL: config.google.callbackUrl,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) return done(new Error('Google account has no email'));
          const data = {
            email,
            name: profile.displayName || email,
            avatarUrl: profile.photos?.[0]?.value ?? null,
          };
          const user = await prisma.user.upsert({
            where: { googleId: profile.id },
            update: data,
            create: { googleId: profile.id, ...data },
          });
          done(null, { id: user.id });
        } catch (e) {
          done(e as Error);
        }
      },
    ),
  );
} else {
  console.warn('[auth] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_CALLBACK_URL not set; login disabled');
}

const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: config.backendUrl.startsWith('https://'),
  path: '/',
};

export const authRouter = Router();

authRouter.get('/google', (req, res, next) => {
  if (!enabled) return res.status(500).send('Google OAuth is not configured on the server.');
  passport.authenticate('google', { scope: ['profile', 'email'], session: false, prompt: 'select_account' })(req, res, next);
});

authRouter.get('/google/callback', (req, res, next) => {
  if (!enabled) return res.status(500).send('Google OAuth is not configured on the server.');
  passport.authenticate('google', { session: false }, (err: unknown, user: { id: string } | false) => {
    if (err || !user) return res.redirect(`${config.frontendUrl}/?error=login_failed`);
    res.cookie(COOKIE_NAME, signSession(user.id), { ...cookieOpts, maxAge: 7 * 24 * 3600 * 1000 });
    res.redirect(`${config.frontendUrl}/dashboard`);
  })(req, res, next);
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME, cookieOpts);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    include: { slack: { select: { channel: true, teamName: true } } },
  });
  if (!user) return res.status(401).json({ error: 'User not found' });
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    slack: user.slack ? { connected: true, channel: user.slack.channel, teamName: user.slack.teamName } : { connected: false },
  });
});
