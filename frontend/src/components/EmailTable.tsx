import type { EmailRow, Tab } from '../types';
import { formatDateTime } from '../lib/format';
import { DataTable, type Column } from './ui/DataTable';
import { StatusBadge } from './ui/StatusBadge';
import type { ReactNode } from 'react';

const emailCol: Column<EmailRow> = {
  key: 'email',
  header: 'Email',
  render: (r) => <span className="font-medium text-slate-900">{r.recipient}</span>,
};
const subjectCol: Column<EmailRow> = {
  key: 'subject',
  header: 'Subject',
  className: 'max-w-xs truncate',
  render: (r) => <span title={r.subject}>{r.subject}</span>,
};
const statusCol: Column<EmailRow> = {
  key: 'status',
  header: 'Status',
  render: (r) => (
    <span title={r.error ?? undefined}>
      <StatusBadge status={r.status} />
    </span>
  ),
};
const previewCol: Column<EmailRow> = {
  key: 'preview',
  header: '',
  className: 'text-right',
  render: (r) =>
    r.previewUrl ? (
      <a href={r.previewUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-600 hover:underline">
        Preview ↗
      </a>
    ) : null,
};

export const columnsFor = (tab: Tab | 'search'): Column<EmailRow>[] => {
  if (tab === 'scheduled') {
    return [emailCol, subjectCol, { key: 'time', header: 'Scheduled time', render: (r) => formatDateTime(r.scheduledAt) }, statusCol];
  }
  if (tab === 'sent') {
    return [emailCol, subjectCol, { key: 'time', header: 'Sent time', render: (r) => formatDateTime(r.sentAt) }, statusCol, previewCol];
  }
  return [
    emailCol,
    subjectCol,
    { key: 'time', header: 'Scheduled / sent', render: (r) => formatDateTime(r.sentAt ?? r.scheduledAt) },
    statusCol,
    previewCol,
  ];
};

interface Props {
  tab: Tab | 'search';
  rows: EmailRow[] | undefined;
  loading: boolean;
  error: string | null;
  empty: ReactNode;
}

export function EmailTable({ tab, ...rest }: Props) {
  return <DataTable columns={columnsFor(tab)} rowKey={(r) => r.id} {...rest} />;
}
