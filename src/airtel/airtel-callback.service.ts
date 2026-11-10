import { Injectable, Logger } from '@nestjs/common';
import { AirtelCallbackStore } from './airtel-callback.store.js';
import type { AirtelCallbackBody, PaymentStatus } from './airtel-callback.types.js';

@Injectable()
export class AirtelCallbackService {
  private readonly logger = new Logger(AirtelCallbackService.name);

  constructor(private readonly store: AirtelCallbackStore) {}

  static mapStatus(code: string): PaymentStatus {
    switch (code) {
      case 'TS':
        return 'SUCCESS';
      case 'TF': // failed
      case 'TE': // expired
        return 'FAILED';
      default: // TA ambiguous, TIP in progress, unknown
        return 'PENDING';
    }
  }

  async process(body: AirtelCallbackBody, sourceIp: string): Promise<void> {
    const { id, status_code, airtel_money_id, message } = body.transaction;

    // Idempotency: Airtel may retry; ignore repeats once finalised.
    if (this.store.isFinalised(id)) {
      this.logger.warn(`Duplicate callback ignored for ${id}`);
      return;
    }

    // TODO: confirm with Airtel's transaction-enquiry API before trusting the body.
    const status = AirtelCallbackService.mapStatus(status_code);

    await this.store.save({
      receivedAt: new Date().toISOString(),
      sourceIp,
      reference: id,
      statusCode: status_code,
      status,
      airtelMoneyId: airtel_money_id,
      message,
      raw: body,
    });

    // TODO: on SUCCESS -> mark membership/payment paid, issue receipt, etc.
    this.logger.log(`Airtel ${id} -> ${status} (${airtel_money_id ?? 'n/a'})`);
  }
}
