import { Client } from '@elastic/elasticsearch';
import type { Email } from '@prisma/client';
import { config } from '../config';

const INDEX = 'emails';

const client: Client | null =
  config.esUrl && config.esApiKey
    ? new Client({ node: config.esUrl, auth: { apiKey: config.esApiKey } })
    : null;

if (!client) console.warn('[es] ELASTICSEARCH_URL / ELASTICSEARCH_API_KEY not set; search disabled');

type IndexableEmail = Pick<
  Email,
  'id' | 'userId' | 'campaignId' | 'senderId' | 'recipient' | 'subject' | 'body' | 'status' | 'scheduledAt' | 'sentAt' | 'previewUrl'
>;

function toDoc(e: IndexableEmail) {
  return {
    userId: e.userId,
    campaignId: e.campaignId,
    senderId: e.senderId,
    recipient: e.recipient,
    subject: e.subject,
    body: e.body,
    status: e.status,
    scheduledAt: e.scheduledAt,
    sentAt: e.sentAt,
    previewUrl: e.previewUrl,
  };
}

export async function ensureIndex(): Promise<void> {
  if (!client) return;
  try {
    const exists = await client.indices.exists({ index: INDEX });
    if (exists) return;
    await client.indices.create({
      index: INDEX,
      mappings: {
        properties: {
          userId: { type: 'keyword' },
          campaignId: { type: 'keyword' },
          senderId: { type: 'keyword' },
          recipient: { type: 'text', fields: { keyword: { type: 'keyword' } } },
          subject: { type: 'text' },
          body: { type: 'text' },
          status: { type: 'keyword' },
          scheduledAt: { type: 'date' },
          sentAt: { type: 'date' },
          previewUrl: { type: 'keyword', index: false },
        },
      },
    });
  } catch (err) {
    console.warn('[es] ensureIndex failed:', (err as Error).message);
  }
}

export async function indexEmail(e: IndexableEmail): Promise<void> {
  if (!client) return;
  try {
    await client.index({ index: INDEX, id: e.id, document: toDoc(e) });
  } catch (err) {
    console.warn('[es] index failed:', (err as Error).message);
  }
}

export async function indexEmails(emails: IndexableEmail[]): Promise<void> {
  if (!client || emails.length === 0) return;
  try {
    const operations = emails.flatMap((e) => [{ index: { _index: INDEX, _id: e.id } }, toDoc(e)]);
    const res = await client.bulk({ operations });
    if (res.errors) console.warn('[es] bulk index had errors');
  } catch (err) {
    console.warn('[es] bulk index failed:', (err as Error).message);
  }
}

export interface SearchHit {
  id: string;
  recipient: string;
  subject: string;
  status: string;
  scheduledAt: string;
  sentAt: string | null;
  previewUrl: string | null;
}

export async function searchEmails(userId: string, q: string, size = 50): Promise<SearchHit[] | null> {
  if (!client) return null;
  try {
    const res = await client.search<ReturnType<typeof toDoc>>({
      index: INDEX,
      size,
      query: {
        bool: {
          filter: [{ term: { userId } }],
          must: [
            {
              multi_match: {
                query: q,
                fields: ['recipient^3', 'subject^2', 'body', 'status'],
                type: 'bool_prefix',
              },
            },
          ],
        },
      },
      sort: ['_score', { scheduledAt: { order: 'desc' } }],
    });
    return res.hits.hits.map((h) => {
      const s = h._source!;
      return {
        id: h._id!,
        recipient: s.recipient,
        subject: s.subject,
        status: s.status,
        scheduledAt: new Date(s.scheduledAt).toISOString(),
        sentAt: s.sentAt ? new Date(s.sentAt).toISOString() : null,
        previewUrl: s.previewUrl,
      };
    });
  } catch (err) {
    console.warn('[es] search failed:', (err as Error).message);
    return null;
  }
}
