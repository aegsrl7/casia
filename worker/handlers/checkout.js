// Handler per creazione sessione Stripe Checkout
import { computeStayPrice, guestsForPricing, gapLength } from './availability.js';

/**
 * POST /api/create-checkout
 * Body: { apartment, checkin, checkout, adults, children, guest_name, guest_email, guest_phone, message, source_page }
 */
export async function handleCreateCheckout(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Body JSON non valido' }, { status: 400 });
  }

  const { apartment, checkin, checkout, adults, children, guest_name, guest_email, guest_phone, message, marketing_consent, source_page, lang } = body;
  const guestLang = ['it', 'en', 'fr', 'de'].includes(lang) ? lang : 'it';
  const checkinToken = crypto.randomUUID();

  // Validazione
  if (!apartment || !['oliva', 'venica'].includes(apartment)) {
    return Response.json({ error: 'Appartamento non valido' }, { status: 400 });
  }
  if (!checkin || !checkout) {
    return Response.json({ error: 'Date richieste' }, { status: 400 });
  }
  if (!guest_name || !guest_email || !guest_phone) {
    return Response.json({ error: 'Nome, email e telefono richiesti' }, { status: 400 });
  }

  // Validazione email base
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest_email)) {
    return Response.json({ error: 'Email non valida' }, { status: 400 });
  }

  const checkinDate = new Date(checkin + 'T00:00:00Z');
  const checkoutDate = new Date(checkout + 'T00:00:00Z');
  const nights = Math.round((checkoutDate - checkinDate) / (1000 * 60 * 60 * 24));

  if (nights < 1) {
    return Response.json({ error: 'Soggiorno minimo 1 notte' }, { status: 400 });
  }

  // Verifica date bloccate
  const blockedConflict = await env.DB.prepare(`
    SELECT id FROM blocked_dates
    WHERE apartment = ? AND date >= ? AND date < ?
    LIMIT 1
  `).bind(apartment, checkin, checkout).first();

  if (blockedConflict) {
    return Response.json({ error: 'Alcune date selezionate sono bloccate' }, { status: 409 });
  }

  // Calcola prezzo (stessa logica del preventivo, ospiti inclusi)
  const pricing = await env.DB.prepare(`
    SELECT season, date_from, date_to, price_night, price_night_2, min_nights FROM pricing
    WHERE apartment = ? AND date_from <= ? AND date_to >= ?
    ORDER BY date_from
  `).bind(apartment, checkout, checkin).all();

  const guestCount = guestsForPricing(adults, children);
  const { totalCents, maxMinNights } = computeStayPrice(pricing.results, checkinDate, nights, guestCount);

  // Soggiorno minimo con regola riempi-buco, come nel preventivo
  let effectiveMin = maxMinNights;
  if (nights < maxMinNights) {
    const gap = await gapLength(env, apartment, checkin, checkout, nights);
    if (gap !== null && gap < maxMinNights) {
      effectiveMin = gap;
    }
  }
  if (nights < effectiveMin) {
    return Response.json({ error: `Soggiorno minimo di ${effectiveMin} notti` }, { status: 400 });
  }

  if (totalCents <= 0) {
    return Response.json({ error: 'Impossibile calcolare il prezzo' }, { status: 500 });
  }

  // Crea prenotazione pending SOLO se non ci sono conflitti (atomico)
  const apartmentName = apartment === 'oliva' ? 'Appartamento Oliva' : 'Appartamento Venica';
  const siteUrl = env.SITE_URL || 'https://casiavacanze.com';

  const insertResult = await env.DB.prepare(`
    INSERT INTO reservations (apartment, checkin, checkout, nights, adults, children, guest_name, guest_email, guest_phone, message, status, total_cents, source_page, lang, marketing_consent, checkin_token)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?
    WHERE NOT EXISTS (
      SELECT 1 FROM reservations
      WHERE apartment = ? AND status IN ('confirmed', 'pending')
      AND checkout > ? AND checkin < ?
    )
  `).bind(
    apartment, checkin, checkout, nights, adults || 2, children || 0,
    guest_name, guest_email, guest_phone || null, message || null,
    totalCents, source_page || 'index', guestLang,
    marketing_consent ? 1 : 0, checkinToken,
    apartment, checkin, checkout
  ).run();

  // Se l'INSERT non ha scritto righe, le date sono occupate
  if (insertResult.meta.changes === 0) {
    return Response.json({ error: 'Le date selezionate non sono più disponibili' }, { status: 409 });
  }

  const reservationId = insertResult.meta.last_row_id;

  // Formatta date per Stripe description
  const formatDate = (d) => { const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}`; };

  // Crea Stripe Checkout Session via API HTTP
  const stripeParams = new URLSearchParams({
    'payment_method_types[]': 'card',
    'mode': 'payment',
    'customer_email': guest_email,
    'success_url': `${siteUrl}/?booking=success&id=${reservationId}&lang=${guestLang}`,
    'cancel_url': `${siteUrl}/?booking=cancelled&lang=${guestLang}`,
    'line_items[0][price_data][currency]': 'eur',
    'line_items[0][price_data][product_data][name]': `${apartmentName} — ${nights} notti`,
    'line_items[0][price_data][product_data][description]': `${formatDate(checkin)} → ${formatDate(checkout)} | ${adults || 2} adulti${children ? ` + ${children} bambini` : ''}`,
    'line_items[0][price_data][unit_amount]': totalCents.toString(),
    'line_items[0][quantity]': '1',
    'metadata[reservation_id]': reservationId.toString(),
    'metadata[type]': 'booking',
    'metadata[apartment]': apartment,
    'metadata[checkin]': checkin,
    'metadata[checkout]': checkout,
    'expires_at': (Math.floor(Date.now() / 1000) + 30 * 60).toString(),
  });

  const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: stripeParams.toString(),
  });

  if (!stripeRes.ok) {
    const err = await stripeRes.text();
    console.error('Stripe error:', err);
    // Cancella la prenotazione pending
    await env.DB.prepare('DELETE FROM reservations WHERE id = ?').bind(reservationId).run();
    return Response.json({ error: 'Errore nella creazione del pagamento' }, { status: 500 });
  }

  const session = await stripeRes.json();

  // Aggiorna prenotazione con session ID
  await env.DB.prepare(`
    UPDATE reservations SET stripe_session_id = ? WHERE id = ?
  `).bind(session.id, reservationId).run();

  return Response.json({
    checkout_url: session.url,
    session_id: session.id,
    reservation_id: reservationId,
  });
}
