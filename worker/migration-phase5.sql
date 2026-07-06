-- FASE 5: Email Marketing

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
