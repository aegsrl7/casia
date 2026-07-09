// Handler per disponibilità appartamenti

/**
 * GET /api/availability?apartment=oliva&months=2026-07,2026-08
 * Ritorna le date occupate e bloccate per un appartamento
 */
export async function handleAvailability(request, env) {
  // Cleanup: cancella prenotazioni pending più vecchie di 30 minuti (Stripe session scaduta)
  await env.DB.prepare(`
    DELETE FROM reservations
    WHERE status = 'pending'
    AND created_at < datetime('now', '-30 minutes')
  `).run();

  const url = new URL(request.url);
  const apartment = url.searchParams.get('apartment');
  const monthsParam = url.searchParams.get('months');

  if (!apartment || !['oliva', 'venica'].includes(apartment)) {
    return Response.json({ error: 'Appartamento non valido' }, { status: 400 });
  }

  if (!monthsParam) {
    return Response.json({ error: 'Parametro months richiesto (es. 2026-07,2026-08)' }, { status: 400 });
  }

  const months = monthsParam.split(',').map(m => m.trim());

  // Calcola range di date per i mesi richiesti
  let minDate = null;
  let maxDate = null;
  for (const month of months) {
    const [year, mon] = month.split('-').map(Number);
    const firstDay = `${year}-${String(mon).padStart(2, '0')}-01`;
    const lastDay = new Date(year, mon, 0); // ultimo giorno del mese
    const lastDayStr = `${year}-${String(mon).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;

    if (!minDate || firstDay < minDate) minDate = firstDay;
    if (!maxDate || lastDayStr > maxDate) maxDate = lastDayStr;
  }

  // Query prenotazioni confermate che si sovrappongono al range
  const reservations = await env.DB.prepare(`
    SELECT checkin, checkout FROM reservations
    WHERE apartment = ? AND status IN ('confirmed', 'pending')
    AND checkout > ? AND checkin <= ?
  `).bind(apartment, minDate, maxDate).all();

  // Query date bloccate nel range
  const blocked = await env.DB.prepare(`
    SELECT date, reason FROM blocked_dates
    WHERE apartment = ? AND date >= ? AND date <= ?
  `).bind(apartment, minDate, maxDate).all();

  // Espandi prenotazioni in date singole occupate
  const occupiedDates = new Set();
  for (const res of reservations.results) {
    let current = new Date(res.checkin + 'T00:00:00Z');
    const end = new Date(res.checkout + 'T00:00:00Z');
    while (current < end) {
      occupiedDates.add(current.toISOString().split('T')[0]);
      current.setUTCDate(current.getUTCDate() + 1);
    }
  }

  // Date bloccate
  const blockedDates = blocked.results.map(b => b.date);

  // Unisci tutte le date non disponibili
  const unavailableDates = [...new Set([...occupiedDates, ...blockedDates])].sort();

  return Response.json({
    apartment,
    months,
    unavailable: unavailableDates,
    blocked: blockedDates,
  });
}

/**
 * POST /api/calculate-price
 * Body: { apartment, checkin, checkout }
 * Ritorna il prezzo totale e dettagli per notte
 */
export async function handleCalculatePrice(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Body JSON non valido' }, { status: 400 });
  }

  const { apartment, checkin, checkout } = body;

  if (!apartment || !['oliva', 'venica'].includes(apartment)) {
    return Response.json({ error: 'Appartamento non valido' }, { status: 400 });
  }

  if (!checkin || !checkout) {
    return Response.json({ error: 'Date check-in e check-out richieste' }, { status: 400 });
  }

  const checkinDate = new Date(checkin + 'T00:00:00Z');
  const checkoutDate = new Date(checkout + 'T00:00:00Z');

  if (checkoutDate <= checkinDate) {
    return Response.json({ error: 'Check-out deve essere dopo check-in' }, { status: 400 });
  }

  const nights = Math.round((checkoutDate - checkinDate) / (1000 * 60 * 60 * 24));

  // Ottieni tutti i periodi di pricing applicabili
  const pricing = await env.DB.prepare(`
    SELECT season, date_from, date_to, price_night, min_nights FROM pricing
    WHERE apartment = ? AND date_from <= ? AND date_to >= ?
    ORDER BY date_from
  `).bind(apartment, checkout, checkin).all();

  if (!pricing.results.length) {
    return Response.json({ error: 'Nessun prezzo configurato per queste date' }, { status: 400 });
  }

  // Calcola prezzo per ogni notte
  const nightDetails = [];
  let totalCents = 0;
  let maxMinNights = 1;

  let current = new Date(checkinDate);
  for (let i = 0; i < nights; i++) {
    const dateStr = current.toISOString().split('T')[0];

    // Trova il prezzo più specifico per questa data (peak > high > mid > low)
    const seasonPriority = { peak: 4, high: 3, mid: 2, low: 1 };
    let bestPrice = null;
    let bestPriority = 0;

    for (const p of pricing.results) {
      if (dateStr >= p.date_from && dateStr <= p.date_to) {
        const priority = seasonPriority[p.season] || 0;
        if (priority > bestPriority) {
          bestPrice = p;
          bestPriority = priority;
        }
      }
    }

    if (bestPrice) {
      nightDetails.push({
        date: dateStr,
        season: bestPrice.season,
        price_night: bestPrice.price_night,
      });
      totalCents += bestPrice.price_night;
      if (bestPrice.min_nights > maxMinNights) {
        maxMinNights = bestPrice.min_nights;
      }
    } else {
      // Fallback: usa il prezzo mid più vicino
      const fallback = pricing.results[0];
      nightDetails.push({
        date: dateStr,
        season: 'default',
        price_night: fallback.price_night,
      });
      totalCents += fallback.price_night;
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  // Verifica soggiorno minimo, con regola "riempi-buco": se le date stanno
  // in un varco tra due occupazioni piu' corto del minimo, il minimo si
  // riduce alla lunghezza del varco (cosi' i buchi orfani restano vendibili).
  let effectiveMin = maxMinNights;
  if (nights < maxMinNights) {
    const gap = await gapLength(env, apartment, checkin, checkout, nights);
    if (gap !== null && gap < maxMinNights) {
      effectiveMin = gap;
    }
  }
  if (nights < effectiveMin) {
    return Response.json({
      error: `Soggiorno minimo di ${effectiveMin} notti per le date selezionate`,
      min_nights: effectiveMin,
    }, { status: 400 });
  }

  return Response.json({
    apartment,
    checkin,
    checkout,
    nights,
    night_details: nightDetails,
    total_cents: totalCents,
    total_formatted: (totalCents / 100).toFixed(2),
    min_nights: maxMinNights,
  });
}

/**
 * Lunghezza del varco libero contiguo che contiene il soggiorno richiesto.
 * Ritorna null se il varco e' aperto (non delimitato da occupazioni entro 30 giorni).
 */
async function gapLength(env, apartment, checkin, checkout, nights) {
  const from = shiftDate(checkin, -30);
  const to = shiftDate(checkout, 30);

  const res = await env.DB.prepare(
    `SELECT checkin, checkout FROM reservations
     WHERE apartment = ? AND status = 'confirmed' AND checkout >= ? AND checkin <= ?`
  ).bind(apartment, from, to).all();
  const blk = await env.DB.prepare(
    'SELECT date FROM blocked_dates WHERE apartment = ? AND date >= ? AND date <= ?'
  ).bind(apartment, from, to).all();

  const occupied = new Set(blk.results.map(b => b.date));
  for (const r of res.results) {
    let d = r.checkin;
    while (d < r.checkout) { occupied.add(d); d = shiftDate(d, 1); }
  }

  // Notti libere prima del check-in
  let before = 0, d = shiftDate(checkin, -1), boundedLeft = false;
  for (let i = 0; i < 30; i++) {
    if (occupied.has(d)) { boundedLeft = true; break; }
    before++; d = shiftDate(d, -1);
  }
  // Notti libere dopo il check-out
  let after = 0, e = checkout, boundedRight = false;
  for (let i = 0; i < 30; i++) {
    if (occupied.has(e)) { boundedRight = true; break; }
    after++; e = shiftDate(e, 1);
  }

  if (!boundedLeft || !boundedRight) return null;
  return before + nights + after;
}

function shiftDate(ds, days) {
  const d = new Date(ds + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}
