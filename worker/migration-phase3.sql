-- FASE 3: Tassa di soggiorno

CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
);

INSERT OR REPLACE INTO settings (key, value) VALUES
  ('tourist_tax_per_person_night', '150'),
  ('tourist_tax_child_min_age', '14'),
  ('tourist_tax_max_nights', '7'),
  ('tourist_tax_enabled', '1');

CREATE TABLE IF NOT EXISTS tourist_tax_payments (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    reservation_id    INTEGER NOT NULL,
    amount_cents      INTEGER NOT NULL,
    taxable_persons   INTEGER NOT NULL,
    taxable_nights    INTEGER NOT NULL,
    stripe_session_id TEXT,
    stripe_payment_id TEXT,
    status            TEXT DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled')),
    created_at        TEXT DEFAULT (datetime('now')),
    paid_at           TEXT,
    FOREIGN KEY (reservation_id) REFERENCES reservations(id)
);
