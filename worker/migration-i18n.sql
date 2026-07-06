-- Migration: i18n system
-- Aggiunge colonna lang a reservations + tabella translations

-- Colonna lingua nella prenotazione
ALTER TABLE reservations ADD COLUMN lang TEXT DEFAULT 'it';

-- Tabella traduzioni gestibili da admin
CREATE TABLE IF NOT EXISTS translations (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    lang        TEXT NOT NULL,
    page        TEXT NOT NULL,
    key         TEXT NOT NULL,
    value       TEXT NOT NULL,
    updated_at  TEXT DEFAULT (datetime('now')),
    UNIQUE(lang, page, key)
);

CREATE INDEX IF NOT EXISTS idx_translations_lang ON translations(lang);
