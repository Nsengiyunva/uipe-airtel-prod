import { Injectable, Logger } from '@nestjs/common';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { CallbackRecord, PaymentStatus } from './airtel-callback.types.js';

/**
 * Minimal persistence: an in-memory map (for idempotency) plus an append-only
 * JSONL audit log. Replace with your DB (e.g. Prisma) when payments are modelled.
 */
@Injectable()
export class AirtelCallbackStore {
  private readonly logger = new Logger(AirtelCallbackStore.name);
  private readonly final = new Map<string, PaymentStatus>();
  private readonly file = process.env.AIRTEL_CALLBACK_LOG ?? 'data/airtel-callbacks.jsonl';

  isFinalised(reference: string): boolean {
    return this.final.has(reference);
  }

  async save(record: CallbackRecord): Promise<void> {
    if (record.status !== 'PENDING') this.final.set(record.reference, record.status);
    try {
      await mkdir(dirname(this.file), { recursive: true });
      await appendFile(this.file, JSON.stringify(record) + '\n');
    } catch (e) {
      this.logger.error(`Failed to write audit log: ${(e as Error).message}`);
    }
  }
}
