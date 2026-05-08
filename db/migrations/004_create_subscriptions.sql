CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  plan_type TEXT NOT NULL,
  meal_type TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  amount_paid REAL,
  payment_id TEXT,
  razorpay_order_id TEXT,
  pause_start TEXT,
  pause_end TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
