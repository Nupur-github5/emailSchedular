import { prisma } from '../lib/prisma';

/** Posts to the user's Slack incoming webhook. Never throws. */
export async function notifySlack(userId: string, text: string): Promise<boolean> {
  try {
    const conn = await prisma.slackConnection.findUnique({ where: { userId } });
    if (!conn) return false;
    const res = await fetch(conn.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      console.warn('[slack] webhook responded', res.status);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[slack] notify failed:', (err as Error).message);
    return false;
  }
}
