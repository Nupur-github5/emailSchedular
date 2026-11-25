import { cn } from './ui/cn';

export interface TabItem<K extends string> {
  key: K;
  label: string;
  count?: number;
}

interface Props<K extends string> {
  items: TabItem<K>[];
  active: K;
  onChange: (key: K) => void;
}

export function Tabs<K extends string>({ items, active, onChange }: Props<K>) {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-1">
      {items.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            'flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
            active === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800',
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span className={cn('rounded-full px-2 py-0.5 text-xs', active === t.key ? 'bg-brand-50 text-brand-700' : 'bg-slate-200 text-slate-600')}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
