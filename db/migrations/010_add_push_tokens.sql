ALTER TABLE customers ADD COLUMN push_token TEXT;
ALTER TABLE delivery_partners ADD COLUMN push_token TEXT;

CREATE TABLE IF NOT EXISTS notification_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_type TEXT NOT NULL,
  recipient_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data TEXT DEFAULT '{}',
  status TEXT DEFAULT 'sent',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
