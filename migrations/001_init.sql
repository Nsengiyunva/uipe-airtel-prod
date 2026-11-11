-- One row per Airtel transaction reference (current / final state).
CREATE TABLE IF NOT EXISTS airtel_payments (
  id              BIGSERIAL PRIMARY KEY,
  reference       TEXT        NOT NULL UNIQUE,
  status          TEXT        NOT NULL CHECK (status IN ('SUCCESS', 'FAILED', 'PENDING')),
  status_code     TEXT        NOT NULL,
  airtel_money_id TEXT,
  message         TEXT,
  source_ip       TEXT,
  raw             JSONB       NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS airtel_payments_status_idx ON airtel_payments (status);

-- Append-only audit log: every callback received, including retries/duplicates.
CREATE TABLE IF NOT EXISTS airtel_callbacks (
  id          BIGSERIAL PRIMARY KEY,
  payment_id  BIGINT      NOT NULL REFERENCES airtel_payments (id) ON DELETE CASCADE,
  reference   TEXT        NOT NULL,
  status_code TEXT        NOT NULL,
  status      TEXT        NOT NULL,
  duplicate   BOOLEAN     NOT NULL DEFAULT FALSE,
  source_ip   TEXT,
  raw         JSONB       NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS airtel_callbacks_reference_idx ON airtel_callbacks (reference);
