import { redis } from '../lib/redis';
import { hourKey } from '../lib/time';

/**
 * Atomically reserve one send slot for sender in the current UTC hour.
 * Redis-backed, so it is safe across any number of workers / processes.
 */
export async function tryConsume(senderId: string, limit: number, now = new Date()) {
  const hour = hourKey(now);
  const key = `rl:${senderId}:${hour}`;
  const r = redis();
  const count = await r.incr(key);
  if (count === 1) await r.expire(key, 7200);
  if (count > limit) {
    await r.decr(key);
    return { allowed: false as const, hour, count: limit };
  }
  return { allowed: true as const, hour, count };
}

/** Release a slot (e.g. when the send itself failed). */
export async function release(senderId: string, hour: string) {
  await redis().decr(`rl:${senderId}:${hour}`);
}

/** Returns true exactly once per sender-hour. */
export async function shouldNotify(senderId: string, hour: string): Promise<boolean> {
  const ok = await redis().set(`notified:${senderId}:${hour}`, '1', 'EX', 7200, 'NX');
  return ok === 'OK';
}
