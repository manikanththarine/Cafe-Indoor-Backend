CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO settings (key, value, description) VALUES
  ('lunch_cutoff', '09:00', 'Lunch order cutoff time (HH:MM IST)'),
  ('dinner_cutoff', '16:00', 'Dinner order cutoff time (HH:MM IST)'),
  ('monthly_both_price', '480000', 'Monthly both meals price in paise'),
  ('monthly_single_price', '288000', 'Monthly single meal price in paise'),
  ('trial_both_price', '140000', 'Trial both meals price in paise'),
  ('trial_single_price', '84000', 'Trial single meal price in paise'),
  ('closed_dates', '[]', 'JSON array of closed dates YYYY-MM-DD'),
  ('coupons', '[{"code":"INDOORI10","type":"percent","value":10},{"code":"TRIAL50","type":"flat","value":5000}]', 'Active coupons JSON');
