import type {
  CampaignInput,
  CampaignResult,
  Counts,
  EmailRow,
  Paginated,
  SearchResponse,
  SendersResponse,
  Tab,
  User,
} from '../types';

export const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  me: () => request<User>('/auth/me'),
  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  emails: (tab: Tab, page: number, pageSize = 25) =>
    request<Paginated<EmailRow>>(`/api/emails?status=${tab}&page=${page}&pageSize=${pageSize}`),
  counts: () => request<Counts>('/api/emails/counts'),
  search: (q: string) => request<SearchResponse>(`/api/search?q=${encodeURIComponent(q)}`),
  senders: () => request<SendersResponse>('/api/senders'),
  createCampaign: (input: CampaignInput) =>
    request<CampaignResult>('/api/campaigns', { method: 'POST', body: JSON.stringify(input) }),
  slackDisconnect: () => request<{ ok: boolean }>('/slack/disconnect', { method: 'POST' }),
  slackTest: () => request<{ ok: boolean }>('/slack/test', { method: 'POST' }),
};

export const urls = {
  googleLogin: `${API_URL}/auth/google`,
  slackConnect: `${API_URL}/slack/connect`,
  bullBoard: `${API_URL}/admin/queues`,
};
