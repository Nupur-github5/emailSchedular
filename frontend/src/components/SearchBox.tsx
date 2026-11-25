import { useEffect, useState } from 'react';
import { Input } from './ui/Field';

export function SearchBox({ onSearch }: { onSearch: (q: string) => void }) {
  const [value, setValue] = useState('');
  useEffect(() => {
    const t = setTimeout(() => onSearch(value.trim()), 300);
    return () => clearTimeout(t);
  }, [value, onSearch]);

  return (
    <div className="relative w-full sm:w-72">
      <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
      </svg>
      <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Search emails…" className="pl-9" />
    </div>
  );
}
