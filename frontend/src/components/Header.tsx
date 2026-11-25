import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import type { User } from '../types';
import { useLogout } from '../hooks/queries';
import { Avatar } from './ui/Avatar';
import { Button } from './ui/Button';
import { urls } from '../lib/api';

export function Header({ user }: { user: User }) {
  const logout = useLogout();
  const navigate = useNavigate();

  const onLogout = () =>
    logout.mutate(undefined, {
      onSuccess: () => navigate('/', { replace: true }),
      onError: () => toast.error('Logout failed'),
    });

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
            </svg>
          </span>
          <span className="text-base font-semibold">Email Scheduler</span>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <a href={urls.bullBoard} target="_blank" rel="noreferrer" className="hidden text-sm font-medium text-slate-500 hover:text-slate-800 sm:inline">
            Queue dashboard ↗
          </a>
          <div className="flex items-center gap-3">
            <Avatar name={user.name} src={user.avatarUrl} />
            <div className="hidden leading-tight sm:block">
              <div className="text-sm font-medium text-slate-900">{user.name}</div>
              <div className="text-xs text-slate-500">{user.email}</div>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={onLogout} loading={logout.isPending}>
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}
