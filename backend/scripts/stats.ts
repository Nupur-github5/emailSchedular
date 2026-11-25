/** Prints email counts by status and checks for duplicate sends. Usage: npm run stats */
import { prisma } from '../src/lib/prisma';

async function main() {
  const byStatus = await prisma.email.groupBy({ by: ['status'], _count: true });
  console.log('Emails by status:');
  for (const g of byStatus) console.log(`  ${g.status.padEnd(10)} ${g._count}`);

  const dupes = await prisma.$queryRaw<{ campaignId: string; recipient: string; n: bigint }[]>`
    SELECT "campaignId", recipient, COUNT(*) AS n FROM emails
    WHERE status = 'sent' GROUP BY "campaignId", recipient HAVING COUNT(*) > 1`;
  console.log(dupes.length === 0 ? '\nNo duplicate sends found.' : `\nDUPLICATES: ${dupes.length}`);

  const perHour = await prisma.$queryRaw<{ sender: string; hour: Date; n: bigint }[]>`
    SELECT s.email AS sender, date_trunc('hour', e."sentAt") AS hour, COUNT(*) AS n
    FROM emails e JOIN senders s ON s.id = e."senderId"
    WHERE e.status = 'sent' GROUP BY 1, 2 ORDER BY 2 DESC, 1 LIMIT 20`;
  if (perHour.length) {
    console.log('\nSent per sender per hour (UTC, latest 20):');
    for (const r of perHour) console.log(`  ${r.hour.toISOString().slice(0, 13)}:00  ${r.sender}  ${r.n}`);
  }
}

main().finally(() => prisma.$disconnect());
