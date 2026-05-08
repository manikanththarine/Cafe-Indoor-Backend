CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subscription_id INTEGER REFERENCES subscriptions(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  meal_type TEXT NOT NULL,
  delivery_date TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  partner_id INTEGER REFERENCES delivery_partners(id),
  special_note TEXT,
  status_confirmed_at DATETIME,
  status_picked_up_at DATETIME,
  status_in_transit_at DATETIME,
  status_delivered_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_date_meal ON orders(delivery_date, meal_type);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_partner ON orders(partner_id);
