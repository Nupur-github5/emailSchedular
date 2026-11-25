import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Field, Input, Textarea } from './ui/Field';
import { parseLeads } from '../lib/leads';
import { toLocalInputValue } from '../lib/format';
import { useCreateCampaign, useSenders } from '../hooks/queries';

interface Props {
  open: boolean;
  onClose: () => void;
}

const defaultStart = () => toLocalInputValue(new Date(Date.now() + 60_000));

export function ComposeModal({ open, onClose }: Props) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [leads, setLeads] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [startTime, setStartTime] = useState(defaultStart);
  const [delaySec, setDelaySec] = useState('5');
  const [hourlyLimit, setHourlyLimit] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const create = useCreateCampaign();
  const { data: senders } = useSenders();
  const maxLimit = senders?.maxEmailsPerHourPerSender;

  const reset = () => {
    setSubject('');
    setBody('');
    setLeads([]);
    setFileName('');
    setStartTime(defaultStart());
    setDelaySec('5');
    setHourlyLimit('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const parsed = parseLeads(await file.text());
    setFileName(file.name);
    setLeads(parsed);
    if (parsed.length === 0) toast.error('No email addresses found in that file');
  };

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (Number(delaySec) < 0 || Number.isNaN(Number(delaySec))) e.delay = 'Must be 0 or more';
    if (hourlyLimit && (!Number.isInteger(Number(hourlyLimit)) || Number(hourlyLimit) < 1)) e.limit = 'Must be a positive whole number';
    return e;
  }, [delaySec, hourlyLimit]);

  const canSubmit = subject.trim() && body.trim() && leads.length > 0 && startTime && Object.keys(errors).length === 0;

  const onSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!canSubmit) return;
    create.mutate(
      {
        subject: subject.trim(),
        body: body.trim(),
        recipients: leads,
        startTime: new Date(startTime).toISOString(),
        delayBetweenMs: Math.round(Number(delaySec) * 1000),
        hourlyLimit: hourlyLimit ? Number(hourlyLimit) : null,
      },
      {
        onSuccess: (r) => {
          toast.success(`Scheduled ${r.scheduled} email${r.scheduled === 1 ? '' : 's'}`);
          reset();
          onClose();
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Compose new email"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSubmit()} disabled={!canSubmit} loading={create.isPending}>
            Schedule
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <Field label="Subject">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Quick question about your outreach" maxLength={300} />
        </Field>
        <Field label="Body">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Hi there, …" />
        </Field>

        <Field label="Leads (CSV or text file)" hint="Any column or separator: every email address in the file is detected.">
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
            <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
              Upload file
            </Button>
            <span className="truncate text-sm text-slate-500">{fileName || 'No file selected'}</span>
            {fileName && (
              <span className="ml-auto shrink-0 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
                {leads.length} email{leads.length === 1 ? '' : 's'} detected
              </span>
            )}
            <input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden" onChange={onFile} />
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Start time">
            <Input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </Field>
          <Field label="Delay between emails (s)" error={errors.delay}>
            <Input type="number" min={0} step="0.5" value={delaySec} onChange={(e) => setDelaySec(e.target.value)} />
          </Field>
          <Field label="Hourly limit" error={errors.limit} hint={maxLimit ? `Per sender. Server max: ${maxLimit}` : 'Per sender'}>
            <Input type="number" min={1} value={hourlyLimit} placeholder={maxLimit ? String(maxLimit) : ''} onChange={(e) => setHourlyLimit(e.target.value)} />
          </Field>
        </div>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
