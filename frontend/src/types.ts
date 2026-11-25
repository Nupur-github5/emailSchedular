export type EmailStatus = 'scheduled' | 'sending' | 'delayed' | 'sent' | 'failed';
export type Tab = 'scheduled' | 'sent';

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  slack: { connected: boolean; channel?: string | null; teamName?: string | null };
}

export interface EmailRow {
  id: string;
  recipient: string;
  subject: string;
  status: EmailStatus;
  scheduledAt: string;
  sentAt: string | null;
  previewUrl: string | null;
  error?: string | null;
  senderEmail?: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Counts {
  scheduled: number;
  sent: number;
}

export interface SearchResponse {
  items: EmailRow[];
  available: boolean;
}

export interface SendersResponse {
  items: { id: string; name: string; email: string }[];
  maxEmailsPerHourPerSender: number;
  minSendDelayMs: number;
}

export interface CampaignInput {
  subject: string;
  body: string;
  recipients: string[];
  startTime: string;
  delayBetweenMs: number;
  hourlyLimit?: number | null;
}

export interface CampaignResult {
  campaignId: string;
  scheduled: number;
  skippedInvalidOrDuplicate: number;
  firstAt: string;
  lastAt: string;
}
