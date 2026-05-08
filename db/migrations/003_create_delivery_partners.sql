CREATE TABLE IF NOT EXISTS delivery_partners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  vehicle_type TEXT DEFAULT 'bike',
  area_coverage TEXT DEFAULT '[]',
  status TEXT DEFAULT 'active',
  is_on_duty INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
