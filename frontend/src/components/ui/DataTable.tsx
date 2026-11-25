import type { ReactNode } from 'react';
import { Spinner } from './Spinner';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: string | null;
  empty: ReactNode;
}

export function DataTable<T>({ columns, rows, rowKey, loading, error, empty }: Props<T>) {
  if (loading && !rows) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
        <Spinner className="text-brand-600" /> Loading…
      </div>
    );
  }
  if (error) return <div className="px-6 py-10 text-center text-sm text-red-600">{error}</div>;
  if (!rows || rows.length === 0) return <>{empty}</>;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-100 text-sm">
        <thead className="bg-slate-50/60">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={`px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 ${c.className ?? ''}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((r) => (
            <tr key={rowKey(r)} className="hover:bg-slate-50/60">
              {columns.map((c) => (
                <td key={c.key} className={`whitespace-nowrap px-6 py-3.5 text-slate-700 ${c.className ?? ''}`}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
