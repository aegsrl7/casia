-- CASIA Country House - Database Schema
-- Cloudflare D1 (SQLite)

-- Prenotazioni confermate e pending
CREATE TABLE IF NOT EXISTS reservations (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    apartment       TEXT NOT NULL CHECK (apartment IN ('oliva', 'venica')),
    checkin         TEXT NOT NULL,  -- YYYY-MM-DD
    checkout        TEXT NOT NULL,  -- YYYY-MM-DD
    nights          INTEGER NOT NULL,
    adults          INTEGER NOT NULL DEFAULT 2,
    children        INTEGER NOT NULL DEFAULT 0,
    guest_name      TEXT NOT NULL,
    guest_email     TEXT NOT NULL,
    guest_phone     TEXT,
    message         TEXT,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','confirmed','cancelled','refunded')),
    stripe_session_id   TEXT,
    stripe_payment_id   TEXT,
    total_cents         INTEGER,
    source_page         TEXT DEFAULT 'index',
    admin_notes         TEXT,
    lang                TEXT DEFAULT 'it',
    marketing_consent   INTEGER DEFAULT 0,
    checkin_token       TEXT,
    checkin_status      TEXT DEFAULT 'pending',
    access_instructions TEXT,
    source              TEXT DEFAULT 'direct',
    external_ref        TEXT
);

-- Date bloccate manualmente (manutenzione, uso personale)
CREATE TABLE IF NOT EXISTS blocked_dates (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    apartment   TEXT NOT NULL CHECK (apartment IN ('oliva', 'venica')),
    date        TEXT NOT NULL,  -- YYYY-MM-DD (una riga per giorno)
    reason      TEXT,
    UNIQUE(apartment, date)
);

-- Configurazione prezzi per stagione
CREATE TABLE IF NOT EXISTS pricing (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    apartment   TEXT NOT NULL CHECK (apartment IN ('oliva', 'venica')),
    season      TEXT NOT NULL CHECK (season IN ('low','mid','high','peak')),
    date_from   TEXT NOT NULL,  -- YYYY-MM-DD
    date_to     TEXT NOT NULL,  -- YYYY-MM-DD
    price_night INTEGER NOT NULL,  -- centesimi (es. 12000 = 120€)
    min_nights  INTEGER NOT NULL DEFAULT 1
);

-- Indici per query veloci
CREATE INDEX IF NOT EXISTS idx_res_apartment_dates ON reservations(apartment, checkin, checkout);
CREATE INDEX IF NOT EXISTS idx_res_status ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_blocked_apartment ON blocked_dates(apartment, date);
CREATE INDEX IF NOT EXISTS idx_pricing_apartment ON pricing(apartment, date_from, date_to);

-- Traduzioni i18n (gestite da admin)
CREATE TABLE IF NOT EXISTS translations (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    lang        TEXT NOT NULL,           -- 'it', 'en', 'fr', 'de'
    page        TEXT NOT NULL,           -- 'common', 'index', 'amici'
    key         TEXT NOT NULL,
    value       TEXT NOT NULL,
    updated_at  TEXT DEFAULT (datetime('now')),
    UNIQUE(lang, page, key)
);

CREATE INDEX IF NOT EXISTS idx_translations_lang ON translations(lang);
CREATE INDEX IF NOT EXISTS idx_res_checkin_token ON reservations(checkin_token);

-- Viaggiatori per check-in (Schedina Alloggiati)
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

-- Impostazioni generali (tassa di soggiorno, etc.)
CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
);

INSERT OR REPLACE INTO settings (key, value) VALUES
  ('tourist_tax_per_person_night', '150'),
  ('tourist_tax_child_min_age', '14'),
  ('tourist_tax_max_nights', '7'),
  ('tourist_tax_enabled', '1'),
  ('access_instructions_oliva', 'Benvenuto all''Appartamento Oliva!

CODICE PORTA INGRESSO: 4821#
CODICE CASSAFORTE CHIAVI: 1234 (la cassaforte si trova a destra del portone principale)

WiFi: CASIA-Guest
Password WiFi: Welcome2026!

PARCHEGGIO: Posto auto riservato nel cortile interno, accesso dal cancello laterale.

COME RAGGIUNGERCI:
Da Bene Vagienna (12041 CN):
1. Procedi verso Strada Provinciale 3 (29 m)
2. Esci dalla rotonda e prendi Strada Provinciale 3 (800 m)
3. Alla rotonda prendi la 1a uscita e prendi Via Lequio Tanaro/SP159 - Continua su SP159 (1,2 km)
4. Svolta a destra (300 m)
Destinazione: Fraz. Santo Stefano, Bene Vagienna (CN)
Tempo stimato: 3 min (2,4 km)

RACCOLTA DIFFERENZIATA: Bidoni nel locale tecnico al piano terra — vetro (verde), plastica (giallo), umido (marrone), secco (grigio).

Per qualsiasi necessità: +39 333 1234567

Buon soggiorno!'),
  ('access_instructions_venica', 'Benvenuto all''Appartamento Venica!

CODICE PORTA INGRESSO: 5937#
CODICE CASSAFORTE CHIAVI: 5678 (la cassaforte si trova a sinistra dell''ingresso)

WiFi: CASIA-Guest
Password WiFi: Welcome2026!

PARCHEGGIO: Posto auto riservato nel cortile interno, accesso dal cancello laterale.

COME RAGGIUNGERCI:
Da Bene Vagienna (12041 CN):
1. Procedi verso Strada Provinciale 3 (29 m)
2. Esci dalla rotonda e prendi Strada Provinciale 3 (800 m)
3. Alla rotonda prendi la 1a uscita e prendi Via Lequio Tanaro/SP159 - Continua su SP159 (1,2 km)
4. Svolta a destra (300 m)
Destinazione: Fraz. Santo Stefano, Bene Vagienna (CN)
Tempo stimato: 3 min (2,4 km)

RACCOLTA DIFFERENZIATA: Bidoni nel locale tecnico al piano terra — vetro (verde), plastica (giallo), umido (marrone), secco (grigio).

Per qualsiasi necessità: +39 333 1234567

Buon soggiorno!');

-- Pagamenti tassa di soggiorno
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

-- Campagne email marketing
CREATE TABLE IF NOT EXISTS email_campaigns (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    subject          TEXT NOT NULL,
    body_html        TEXT NOT NULL,
    status           TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent')),
    sent_at          TEXT,
    recipients_count INTEGER DEFAULT 0,
    created_at       TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS email_campaign_sends (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    guest_email TEXT NOT NULL,
    guest_name  TEXT,
    status      TEXT DEFAULT 'sent' CHECK (status IN ('sent','failed')),
    sent_at     TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (campaign_id) REFERENCES email_campaigns(id)
);

-- Prezzi iniziali per Appartamento Oliva (2026)
INSERT INTO pricing (apartment, season, date_from, date_to, price_night, min_nights) VALUES
    ('oliva', 'low',  '2026-01-01', '2026-03-31', 9000,  2),
    ('oliva', 'mid',  '2026-04-01', '2026-05-31', 11000, 2),
    ('oliva', 'high', '2026-06-01', '2026-09-15', 13000, 3),
    ('oliva', 'peak', '2026-07-15', '2026-08-31', 15000, 5),
    ('oliva', 'mid',  '2026-09-16', '2026-10-31', 11000, 2),
    ('oliva', 'low',  '2026-11-01', '2026-12-31', 9000,  2);
