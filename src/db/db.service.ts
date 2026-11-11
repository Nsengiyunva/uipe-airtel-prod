import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import pg from 'pg';

/** Thin wrapper around a pg Pool. Disabled (enabled=false) when DATABASE_URL is unset. */
@Injectable()
export class DbService implements OnModuleDestroy {
  private readonly logger = new Logger(DbService.name);
  readonly pool: pg.Pool | null;

  constructor() {
    const url = process.env.DATABASE_URL;
    if (url) {
      this.pool = new pg.Pool({ connectionString: url, max: Number(process.env.DATABASE_POOL_MAX ?? 5) });
      this.pool.on('error', (e) => this.logger.error(`Idle PostgreSQL client error: ${e.message}`));
    } else {
      this.pool = null;
      this.logger.warn('DATABASE_URL is not set: callbacks go to the JSONL log only');
    }
  }

  get enabled(): boolean {
    return this.pool !== null;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }
}
