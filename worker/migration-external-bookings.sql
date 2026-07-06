-- Aggiunge supporto prenotazioni esterne (Booking.com, Airbnb)
ALTER TABLE reservations ADD COLUMN source TEXT DEFAULT 'direct';
ALTER TABLE reservations ADD COLUMN external_ref TEXT;
CREATE INDEX IF NOT EXISTS idx_res_source ON reservations(source);
