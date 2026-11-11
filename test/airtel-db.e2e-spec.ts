import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Runs only when TEST_DATABASE_URL points at a migrated PostgreSQL database.
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('Airtel callback -> PostgreSQL (e2e)', () => {
  let app: INestApplication;
  let pool: pg.Pool;
  const ref = `DBTEST-${Date.now()}`;
  const post = (body: unknown) => request(app.getHttpServer()).post('/api/payments/airtel/callback').send(body);

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.AIRTEL_CALLBACK_LOG = 'off';
    const { AirtelModule } = await import('../src/airtel/airtel.module.js');
    const mod = await Test.createTestingModule({ imports: [AirtelModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    pool = new pg.Pool({ connectionString: url });
  });
  afterAll(async () => {
    await pool.query('DELETE FROM airtel_payments WHERE reference = $1', [ref]);
    await pool.end();
    await app.close();
  });

  it('stores a pending payment, then upgrades it to SUCCESS', async () => {
    await post({ transaction: { id: ref, status_code: 'TIP' } }).expect(200);
    let p = await pool.query('SELECT status FROM airtel_payments WHERE reference = $1', [ref]);
    expect(p.rows[0].status).toBe('PENDING');

    await post({ transaction: { id: ref, status_code: 'TS', airtel_money_id: 'MP9', message: 'ok' } }).expect(200);
    p = await pool.query('SELECT status, airtel_money_id FROM airtel_payments WHERE reference = $1', [ref]);
    expect(p.rows[0]).toEqual({ status: 'SUCCESS', airtel_money_id: 'MP9' });
  });

  it('keeps a finalised payment and flags retries as duplicates', async () => {
    await post({ transaction: { id: ref, status_code: 'TF' } }).expect(200);
    const p = await pool.query('SELECT status FROM airtel_payments WHERE reference = $1', [ref]);
    expect(p.rows[0].status).toBe('SUCCESS');
    const c = await pool.query('SELECT duplicate FROM airtel_callbacks WHERE reference = $1 ORDER BY id', [ref]);
    expect(c.rows.map((r) => r.duplicate)).toEqual([false, false, true]);
  });
});
