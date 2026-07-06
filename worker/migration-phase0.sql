-- FASE 0: Prerequisiti per check-in, CRM e marketing
-- Aggiunge colonne a reservations per marketing_consent, checkin_token, checkin_status, access_instructions

ALTER TABLE reservations ADD COLUMN marketing_consent INTEGER DEFAULT 0;
ALTER TABLE reservations ADD COLUMN checkin_token TEXT;
ALTER TABLE reservations ADD COLUMN checkin_status TEXT DEFAULT 'pending';
ALTER TABLE reservations ADD COLUMN access_instructions TEXT;

CREATE INDEX IF NOT EXISTS idx_res_checkin_token ON reservations(checkin_token);
