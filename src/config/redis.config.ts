import Redis from 'ioredis';
import { config } from './env.config';

export const redisClient = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  lazyConnect: true,
});
