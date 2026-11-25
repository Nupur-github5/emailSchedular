import { useState } from 'react';
import { initials } from '../../lib/format';

export function Avatar({ name, src }: { name: string; src?: string | null }) {
  const [broken, setBroken] = useState(false);
  if (src && !broken) {
    return (
      <img src={src} alt={name} referrerPolicy="no-referrer" onError={() => setBroken(true)} className="h-9 w-9 rounded-full object-cover ring-2 ring-white" />
    );
  }
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
      {initials(name)}
    </span>
  );
}
