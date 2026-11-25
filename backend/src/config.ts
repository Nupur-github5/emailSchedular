import 'dotenv/config';

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}
function opt(name: string): string {
  return process.env[name] ?? '';
}
function int(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const config = {
  databaseUrl: req('DATABASE_URL'),
  redisUrl: req('REDIS_URL'),
  esUrl: opt('ELASTICSEARCH_URL'),
  esApiKey: opt('ELASTICSEARCH_API_KEY'),
  port: int('PORT', 4000),
  backendUrl: req('BACKEND_URL'),
  publicUrl: opt('PUBLIC_URL'),
  frontendUrl: req('FRONTEND_URL'),
  jwtSecret: req('JWT_SECRET'),
  google: {
    clientId: opt('GOOGLE_CLIENT_ID'),
    clientSecret: opt('GOOGLE_CLIENT_SECRET'),
    callbackUrl: opt('GOOGLE_CALLBACK_URL'),
  },
  slack: {
    clientId: opt('SLACK_CLIENT_ID'),
    clientSecret: opt('SLACK_CLIENT_SECRET'),
    redirectUri: opt('SLACK_REDIRECT_URI'),
  },
  workerConcurrency: int('WORKER_CONCURRENCY', 5),
  minSendDelayMs: int('MIN_SEND_DELAY_MS', 2000),
  maxEmailsPerHourPerSender: int('MAX_EMAILS_PER_HOUR_PER_SENDER', 50),
};
