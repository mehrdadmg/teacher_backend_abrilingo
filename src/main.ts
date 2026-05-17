import 'reflect-metadata';
import 'dotenv/config';
import { AppDataSource } from './config/database.config';
import { redisClient } from './config/redis.config';
import { createApp } from './app';
import { config } from './config/env.config';

async function bootstrap() {
  await AppDataSource.initialize();
  await redisClient.ping();

  const app = createApp();

  app.listen(config.port, () => {
    console.log(`Server running on port ${config.port} [${config.nodeEnv}]`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
