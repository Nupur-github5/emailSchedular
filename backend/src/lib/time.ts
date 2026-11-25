/** UTC hour bucket, e.g. 2026112514 */
export function hourKey(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}`;
}

export function nextHourStart(d: Date = new Date()): Date {
  const n = new Date(d);
  n.setUTCMinutes(0, 0, 0);
  n.setUTCHours(n.getUTCHours() + 1);
  return n;
}
