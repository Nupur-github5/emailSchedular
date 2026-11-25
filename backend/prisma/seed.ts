import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';

// nodemailer caches createTestAccount() per process; disable so each sender is a distinct account
process.env.ETHEREAL_CACHE = 'false';

const prisma = new PrismaClient();
const SENDER_COUNT = 2;

async function main() {
  const existing = await prisma.sender.count();
  if (existing < SENDER_COUNT) {
    console.log(`Creating ${SENDER_COUNT - existing} Ethereal test account(s)...`);
    for (let i = existing + 1; i <= SENDER_COUNT; i++) {
      const acc = await nodemailer.createTestAccount();
      await prisma.sender.create({
        data: {
          name: `Sender ${i}`,
          email: acc.user,
          smtpHost: acc.smtp.host,
          smtpPort: acc.smtp.port,
          smtpUser: acc.user,
          smtpPass: acc.pass,
        },
      });
    }
  }
  const senders = await prisma.sender.findMany({ orderBy: { createdAt: 'asc' } });
  console.log('\nEthereal sender logins (open https://ethereal.email/login to view sent mail):');
  for (const s of senders) console.log(`  ${s.name}: ${s.smtpUser}  /  ${s.smtpPass}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
