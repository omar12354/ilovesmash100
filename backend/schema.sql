-- I Love Smash Burger – order database (Cloudflare D1 / SQLite)

CREATE TABLE IF NOT EXISTS orders (
  id                TEXT PRIMARY KEY,          -- random id, also used in links
  token             TEXT NOT NULL,             -- secret the customer needs to see the order status
  number            TEXT NOT NULL,             -- short number shown to customer and kitchen, e.g. "042"
  day               TEXT NOT NULL,             -- order date (Amsterdam time), YYYY-MM-DD
  created_at        TEXT NOT NULL,             -- ISO timestamp (UTC)
  pickup_at         TEXT NOT NULL,             -- requested pickup time (Amsterdam), "YYYY-MM-DD HH:MM"
  asap              INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL,             -- pending_payment | new | accepted | ready | picked_up | cancelled | payment_failed
  pay_method        TEXT NOT NULL,             -- online | at_pickup
  paid              INTEGER NOT NULL DEFAULT 0,
  sumup_checkout_id TEXT,
  sumup_tx_code     TEXT,
  name              TEXT,                      -- personal data: cleared automatically after RETENTION_DAYS
  phone             TEXT,
  email             TEXT,
  note              TEXT,
  lang              TEXT NOT NULL DEFAULT 'nl',
  items_json        TEXT NOT NULL,             -- priced order lines as calculated by the server
  total_cents       INTEGER NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_day     ON orders(day);
CREATE INDEX IF NOT EXISTS idx_orders_status  ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_checkout ON orders(sumup_checkout_id);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS day_counter (
  day  TEXT PRIMARY KEY,
  last INTEGER NOT NULL
);
