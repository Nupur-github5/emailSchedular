import { useCallback, useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import type { Tab } from '../types';
import { useCounts, useEmails, useMe, useSearch } from '../hooks/queries';
import { Header } from '../components/Header';
import { SlackCard } from '../components/SlackCard';
import { Tabs } from '../components/Tabs';
import { EmailTable } from '../components/EmailTable';
import { ComposeModal } from '../components/ComposeModal';
import { SearchBox } from '../components/SearchBox';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Pagination } from '../components/ui/Pagination';
import { FullPageSpinner } from './LoginPage';

const EMPTY_COPY: Record<Tab, { title: string; description: string }> = {
  scheduled: { title: 'No scheduled emails', description: 'Compose a new email and upload your leads to schedule a campaign.' },
  sent: { title: 'No sent emails yet', description: 'Emails appear here once the worker has sent them.' },
};

export function DashboardPage() {
  const { data: user, isLoading } = useMe();
  const [tab, setTab] = useState<Tab>('scheduled');
  const [page, setPage] = useState(1);
  const [composeOpen, setComposeOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [params, setParams] = useSearchParams();

  const emails = useEmails(tab, page);
  const counts = useCounts();
  const search = useSearch(query);
  const onSearch = useCallback((q: string) => setQuery(q), []);

  useEffect(() => {
    const slack = params.get('slack');
    if (!slack) return;
    if (slack === 'connected') toast.success('Slack connected');
    else if (slack === 'not_configured') toast.error('Slack is not configured on the server');
    else toast.error(`Slack connection failed${params.get('reason') ? `: ${params.get('reason')}` : ''}`);
    setParams({}, { replace: true });
  }, [params, setParams]);

  if (isLoading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/" replace />;

  const changeTab = (t: Tab) => {
    setTab(t);
    setPage(1);
  };
  const searching = query.length > 0;
  const compose = <Button onClick={() => setComposeOpen(true)}>Compose New Email</Button>;

  return (
    <div className="min-h-screen">
      <Header user={user} />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Emails</h1>
            <p className="mt-1 text-sm text-slate-500">Schedule campaigns and track delivery in real time.</p>
          </div>
          <Button
            onClick={() => setComposeOpen(true)}
            icon={
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
              </svg>
            }
          >
            Compose New Email
          </Button>
        </div>

        <SlackCard user={user} />

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            {searching ? (
              <div className="text-sm font-medium text-slate-700">
                Search results for “{query}”{search.data && ` · ${search.data.items.length}`}
              </div>
            ) : (
              <Tabs
                active={tab}
                onChange={changeTab}
                items={[
                  { key: 'scheduled', label: 'Scheduled Emails', count: counts.data?.scheduled },
                  { key: 'sent', label: 'Sent Emails', count: counts.data?.sent },
                ]}
              />
            )}
            <SearchBox onSearch={onSearch} />
          </div>

          {searching ? (
            <EmailTable
              tab="search"
              rows={search.data?.items}
              loading={search.isLoading}
              error={search.error?.message ?? (search.data && !search.data.available ? 'Search is unavailable (Elasticsearch not reachable).' : null)}
              empty={<EmptyState title="No matches" description="Try a different email address or subject keyword." />}
            />
          ) : (
            <>
              <EmailTable
                tab={tab}
                rows={emails.data?.items}
                loading={emails.isLoading}
                error={emails.error?.message ?? null}
                empty={<EmptyState {...EMPTY_COPY[tab]} action={tab === 'scheduled' ? compose : undefined} />}
              />
              {emails.data && <Pagination page={page} pageSize={emails.data.pageSize} total={emails.data.total} onChange={setPage} />}
            </>
          )}
        </section>
      </main>
      <ComposeModal open={composeOpen} onClose={() => setComposeOpen(false)} />
    </div>
  );
}
