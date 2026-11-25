import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { CampaignInput, Tab } from '../types';

export const qk = {
  me: ['me'] as const,
  emails: (tab: Tab, page: number) => ['emails', tab, page] as const,
  counts: ['counts'] as const,
  search: (q: string) => ['search', q] as const,
  senders: ['senders'] as const,
};

const POLL_MS = 5000;

export const useMe = () => useQuery({ queryKey: qk.me, queryFn: api.me, retry: false, staleTime: 60_000 });

export const useEmails = (tab: Tab, page: number) =>
  useQuery({
    queryKey: qk.emails(tab, page),
    queryFn: () => api.emails(tab, page),
    refetchInterval: POLL_MS,
    placeholderData: keepPreviousData,
  });

export const useCounts = () => useQuery({ queryKey: qk.counts, queryFn: api.counts, refetchInterval: POLL_MS });

export const useSearch = (q: string) =>
  useQuery({ queryKey: qk.search(q), queryFn: () => api.search(q), enabled: q.length > 0 });

export const useSenders = () => useQuery({ queryKey: qk.senders, queryFn: api.senders, staleTime: Infinity });

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CampaignInput) => api.createCampaign(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emails'] });
      qc.invalidateQueries({ queryKey: qk.counts });
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.logout, onSettled: () => qc.clear() });
}

export function useSlackDisconnect() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: api.slackDisconnect, onSuccess: () => qc.invalidateQueries({ queryKey: qk.me }) });
}

export const useSlackTest = () => useMutation({ mutationFn: api.slackTest });
