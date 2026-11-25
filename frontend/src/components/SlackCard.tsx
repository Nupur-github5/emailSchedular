import toast from 'react-hot-toast';
import type { User } from '../types';
import { urls } from '../lib/api';
import { useSlackDisconnect, useSlackTest } from '../hooks/queries';
import { Button } from './ui/Button';

export function SlackCard({ user }: { user: User }) {
  const disconnect = useSlackDisconnect();
  const test = useSlackTest();
  const { connected, channel, teamName } = user.slack;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-slate-300'}`} />
        <div>
          <div className="text-sm font-medium">Slack notifications</div>
          <div className="text-xs text-slate-500">
            {connected
              ? `Connected${teamName ? ` to ${teamName}` : ''}${channel ? ` · ${channel}` : ''}. You'll be alerted when a sender hits its hourly limit.`
              : 'Connect Slack to get alerted when a sender hits its hourly limit.'}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        {connected ? (
          <>
            <Button
              size="sm"
              variant="secondary"
              loading={test.isPending}
              onClick={() =>
                test.mutate(undefined, {
                  onSuccess: () => toast.success('Test message sent to Slack'),
                  onError: () => toast.error('Slack test failed'),
                })
              }
            >
              Send test
            </Button>
            <Button
              size="sm"
              variant="danger"
              loading={disconnect.isPending}
              onClick={() =>
                disconnect.mutate(undefined, {
                  onSuccess: () => toast.success('Slack disconnected'),
                  onError: () => toast.error('Could not disconnect Slack'),
                })
              }
            >
              Disconnect
            </Button>
          </>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => (window.location.href = urls.slackConnect)}>
            Connect Slack
          </Button>
        )}
      </div>
    </div>
  );
}
