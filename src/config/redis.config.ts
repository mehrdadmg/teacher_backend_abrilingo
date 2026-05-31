import Redis from 'ioredis';
import { config } from './env.config';
import { logger } from './logger.config';

export const redisClient = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  lazyConnect: true,
});

// Without a listener, Node.js treats this as an uncaught exception and crashes.
redisClient.on('error', (err) => logger.error({ message: 'Redis client error', error: err }));
