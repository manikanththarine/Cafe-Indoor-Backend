CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  address_line1 TEXT,
  address_line2 TEXT,
  area TEXT DEFAULT 'Other',
  landmark TEXT,
  city TEXT DEFAULT 'Indore',
  pincode TEXT,
  meal_preference TEXT DEFAULT 'veg',
  special_instructions TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
