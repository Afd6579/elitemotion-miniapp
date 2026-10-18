CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  telegram_user_id INTEGER NOT NULL,
  product_ids_json TEXT NOT NULL,
  currency TEXT NOT NULL CHECK (currency = 'XTR'),
  amount_stars INTEGER NOT NULL CHECK (amount_stars > 0),
  invoice_payload TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid_pending_delivery', 'delivered', 'refunded', 'cancelled')),
  telegram_payment_charge_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at TEXT,
  delivered_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_orders_user_created
  ON orders (telegram_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status_created
  ON orders (status, created_at);
