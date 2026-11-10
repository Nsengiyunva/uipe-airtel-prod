import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AirtelModule } from '../src/airtel/airtel.module.js';

describe('Airtel callback (e2e)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    process.env.AIRTEL_CALLBACK_LOG = '/tmp/airtel-test.jsonl';
    const mod = await Test.createTestingModule({ imports: [AirtelModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });
  afterAll(() => app.close());

  const body = (code = 'TS') => ({
    transaction: { id: `REF-${code}`, status_code: code, airtel_money_id: 'MP1', message: 'ok' },
  });

  it('acks a valid callback with 200', async () => {
    const res = await request(app.getHttpServer()).post('/api/payments/airtel/callback').send(body());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'received' });
  });

  it('acks a duplicate callback', async () => {
    const res = await request(app.getHttpServer()).post('/api/payments/airtel/callback').send(body());
    expect(res.status).toBe(200);
  });

  it('rejects an invalid payload with 400', async () => {
    const res = await request(app.getHttpServer()).post('/api/payments/airtel/callback').send({ foo: 1 });
    expect(res.status).toBe(400);
  });
});
