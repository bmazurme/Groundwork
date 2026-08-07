import { Global, Logger, Module } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from './database.constants';
import { ensureSchema } from './schema';

const logger = new Logger('DatabaseModule');

async function connectWithRetry(
  pool: Pool,
  attempts = 10,
  delayMs = 2000,
): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (error) {
      if (attempt === attempts) throw error;
      logger.warn(
        `Postgres not ready (attempt ${attempt}/${attempts}), retrying in ${delayMs}ms`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: async () => {
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        await connectWithRetry(pool);
        await ensureSchema(pool);
        return pool;
      },
    },
  ],
  exports: [PG_POOL],
})
export class DatabaseModule {}
