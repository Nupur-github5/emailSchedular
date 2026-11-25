import type { EmailStatus } from '../../types';
import { cn } from './cn';

const styles: Record<EmailStatus, string> = {
  scheduled: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  sending: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  delayed: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  sent: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  failed: 'bg-red-50 text-red-700 ring-red-600/20',
};

export function StatusBadge({ status }: { status: EmailStatus }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset', styles[status])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
