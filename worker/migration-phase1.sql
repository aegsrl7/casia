-- FASE 1: Pre-check-in online - tabella travelers per dati ospiti

CREATE TABLE IF NOT EXISTS travelers (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    reservation_id  INTEGER NOT NULL,
    is_primary      INTEGER DEFAULT 0,
    first_name      TEXT NOT NULL,
    last_name       TEXT NOT NULL,
    birth_date      TEXT,
    birth_place     TEXT,
    birth_province  TEXT,
    birth_country   TEXT DEFAULT 'IT',
    citizenship     TEXT DEFAULT 'IT',
    gender          TEXT CHECK (gender IN ('M', 'F')),
    doc_type        TEXT CHECK (doc_type IN ('CI', 'PA', 'PT', 'ID')),
    doc_number      TEXT,
    doc_front_key   TEXT,
    doc_back_key    TEXT,
    created_at      TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_travelers_reservation ON travelers(reservation_id);
