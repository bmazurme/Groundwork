import { Controller, Get, Inject } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.constants';

@Controller('health')
export class HealthController {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  @Get()
  async check() {
    let database: 'ok' | 'down' = 'ok';
    try {
      await this.pool.query('SELECT 1');
    } catch {
      database = 'down';
    }

    return {
      status: database === 'ok' ? 'ok' : 'degraded',
      service: 'groundwork-backend',
      database,
      time: new Date().toISOString(),
    };
  }
}
