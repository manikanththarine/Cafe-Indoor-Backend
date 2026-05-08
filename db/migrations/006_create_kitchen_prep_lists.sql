CREATE TABLE IF NOT EXISTS kitchen_prep_lists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prep_date TEXT NOT NULL,
  meal_type TEXT NOT NULL,
  total_count INTEGER DEFAULT 0,
  veg_count INTEGER DEFAULT 0,
  nonveg_count INTEGER DEFAULT 0,
  jain_count INTEGER DEFAULT 0,
  special_count INTEGER DEFAULT 0,
  meal_data TEXT DEFAULT '{}',
  generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_manual_refresh INTEGER DEFAULT 0,
  UNIQUE(prep_date, meal_type)
);
