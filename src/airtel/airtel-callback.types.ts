export interface AirtelTransaction {
  id: string;
  message?: string;
  status_code: string;
  airtel_money_id?: string;
}

export interface AirtelCallbackBody {
  transaction: AirtelTransaction;
  hash?: string;
}

export type PaymentStatus = 'SUCCESS' | 'FAILED' | 'PENDING';

export interface CallbackRecord {
  receivedAt: string;
  sourceIp: string;
  reference: string;
  statusCode: string;
  status: PaymentStatus;
  airtelMoneyId?: string;
  message?: string;
  raw: unknown;
}
