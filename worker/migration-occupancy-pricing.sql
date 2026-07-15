-- Prezzi per numero di ospiti (luglio 2026)
-- price_night_2: prezzo a notte in centesimi valido fino a 2 ospiti totali.
-- NULL = nessuna tariffa ridotta, vale il prezzo pieno price_night.
-- Applicata sul D1 remoto il 14 luglio 2026.
ALTER TABLE pricing ADD COLUMN price_night_2 INTEGER;

-- Prezzo a notte sull'annuncio Booking (per la stima ricavi nel pannello; 15 lug 2026)
ALTER TABLE pricing ADD COLUMN price_night_booking INTEGER;
