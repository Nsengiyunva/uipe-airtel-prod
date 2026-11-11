import { Injectable, Logger } from '@nestjs/common';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { DbService } from '../db/db.service.js';
import type { CallbackRecord, PaymentStatus } from './airtel-callback.types.js';

export type SaveResult = 'stored' | 'duplicate';

/**
 * Persists callbacks to PostgreSQL (airtel_payments + airtel_callbacks).
 * Every callback is also appended to a JSONL audit log, which doubles as a
 * fallback when the database is unreachable or DATABASE_URL is unset.
 * Set AIRTEL_CALLBACK_LOG=off to disable the file log.
 */
@Injectable()
export class AirtelCallbackStore {
  private readonly logger = new Logger(AirtelCallbackStore.name);
  /** Idempotency fallback used only when the database is unavailable. */
  private readonly final = new Map<string, PaymentStatus>();
  private readonly file = process.env.AIRTEL_CALLBACK_LOG ?? 'data/airtel-callbacks.jsonl';

  constructor(private readonly db: DbService) {}

  async save(record: CallbackRecord): Promise<SaveResult> {
    let result: SaveResult | undefined;

    if (this.db.enabled) {
      try {
        result = await this.saveToDb(record);
      } catch (e) {
        this.logger.error(`Database write failed, kept in JSONL log only: ${(e as Error).message}`);
      }
    }
    if (result === undefined) {
      result = this.final.has(record.reference) ? 'duplicate' : 'stored';
      if (record.status !== 'PENDING') this.final.set(record.reference, record.status);
    }

    await this.appendLog(record, result);
    return result;
  }

  private async saveToDb(r: CallbackRecord): Promise<SaveResult> {
    const client = await this.db.pool!.connect();
    try {
      await client.query('BEGIN');
      // Insert, or move a PENDING payment forward. A finalised payment is never overwritten.
      const upsert = await client.query<{ id: string }>(
        `INSERT INTO airtel_payments
           (reference, status, status_code, airtel_money_id, message, source_ip, raw)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (reference) DO UPDATE SET
           status = EXCLUDED.status,
           status_code = EXCLUDED.status_code,
           airtel_money_id = COALESCE(EXCLUDED.airtel_money_id, airtel_payments.airtel_money_id),
           message = EXCLUDED.message,
           source_ip = EXCLUDED.source_ip,
           raw = EXCLUDED.raw,
           updated_at = now()
         WHERE airtel_payments.status = 'PENDING'
         RETURNING id`,
        [r.reference, r.status, r.statusCode, r.airtelMoneyId ?? null, r.message ?? null, r.sourceIp, JSON.stringify(r.raw)],
      );
      const duplicate = upsert.rowCount === 0;
      const paymentId = duplicate
        ? (await client.query<{ id: string }>('SELECT id FROM airtel_payments WHERE reference = $1', [r.reference])).rows[0].id
        : upsert.rows[0].id;

      await client.query(
        `INSERT INTO airtel_callbacks
           (payment_id, reference, status_code, status, duplicate, source_ip, raw, received_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [paymentId, r.reference, r.statusCode, r.status, duplicate, r.sourceIp, JSON.stringify(r.raw), r.receivedAt],
      );
      await client.query('COMMIT');
      return duplicate ? 'duplicate' : 'stored';
    } catch (e) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw e;
    } finally {
      client.release();
    }
  }

  private async appendLog(record: CallbackRecord, result: SaveResult): Promise<void> {
    if (this.file === 'off') return;
    try {
      await mkdir(dirname(this.file), { recursive: true });
      await appendFile(this.file, JSON.stringify({ ...record, result }) + '\n');
    } catch (e) {
      this.logger.error(`Failed to write audit log: ${(e as Error).message}`);
    }
  }
}
