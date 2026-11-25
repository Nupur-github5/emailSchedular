import IORedis, { Redis } from 'ioredis';
import { config } from '../config';

/** Single shared connection factory. BullMQ requires maxRetriesPerRequest: null. */
export function createRedis(): Redis {
  const conn = new IORedis(config.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
  conn.on('error', (err) => console.warn('[redis]', err.message));
  return conn;
}

let shared: Redis | null = null;
export function redis(): Redis {
  if (!shared) shared = createRedis();
  return shared;
}
