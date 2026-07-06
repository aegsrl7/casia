// Handler per impostazioni e tassa di soggiorno

import { sendTouristTaxEmail } from './email.js';

/**
 * GET /api/admin/settings
 * Restituisce tutte le impostazioni come oggetto { key: value }
 */
export async function handleGetSettings(env) {
  const result = await env.DB.prepare('SELECT key, value FROM settings').all();

  const settings = {};
  for (const row of result.results) {
    settings[row.key] = row.value;
  }

  return Response.json({ settings });
}

/**
 * PUT /api/admin/settings
 * Body: { settings: { key: value, ... } }
 */
export async function handleUpdateSettings(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Body JSON non valido' }, { status: 400 });
  }

  const { settings } = body;
  if (!settings || typeof settings !== 'object') {
    return Response.json({ error: 'Oggetto settings richiesto' }, { status: 400 });
  }

  for (const [key, value] of Object.entries(settings)) {
    await env.DB.prepare(
      "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
    ).bind(key, String(value)).run();
  }

  return Response.json({ success: true });
}

/**
 * POST /api/admin/tourist-tax/:id
 * Calcola tassa di soggiorno e genera link pagamento Stripe
 */
export async function handleCreateTouristTax(reservationId, env) {
  const reservation = await env.DB.prepare(
    'SELECT * FROM reservations WHERE id = ? AND status = \'confirmed\''
  ).bind(parseInt(reservationId)).first();

  if (!reservation) {
    return Response.json({ error: 'Prenotazione non trovata o non confermata' }, { status: 404 });
  }

  // Controlla se esiste già un pagamento
  const existing = await env.DB.prepare(
    'SELECT * FROM tourist_tax_payments WHERE reservation_id = ? AND status IN (\'pending\', \'paid\') ORDER BY id DESC LIMIT 1'
  ).bind(parseInt(reservationId)).first();

  if (existing && existing.status === 'paid') {
    return Response.json({
      amount_cents: existing.amount_cents,
      taxable_persons: existing.taxable_persons,
      taxable_nights: existing.taxable_nights,
      status: 'paid',
      paid_at: existing.paid_at,
    });
  }

  // Leggi impostazioni
  const settingsResult = await env.DB.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  for (const row of settingsResult.results) {
    settings[row.key] = row.value;
  }

  if (settings.tourist_tax_enabled !== '1') {
    return Response.json({ error: 'Tassa di soggiorno non abilitata' }, { status: 400 });
  }

  const taxPerPersonNight = parseInt(settings.tourist_tax_per_person_night) || 150;
  const childMinAge = parseInt(settings.tourist_tax_child_min_age) || 14;
  const maxNights = parseInt(settings.tourist_tax_max_nights) || 7;

  // Calcola persone tassabili (adulti - i bambini sotto età minima sono esenti)
  // Per semplicità usiamo adults come tassabili (i bambini sono presunti sotto età esenzione)
  const taxablePersons = reservation.adults;
  const taxableNights = Math.min(reservation.nights, maxNights);
  const amountCents = taxablePersons * taxableNights * taxPerPersonNight;

  if (amountCents <= 0) {
    return Response.json({ error: 'Importo tassa non valido' }, { status: 400 });
  }

  // Se esiste un pending, cancellalo
  if (existing && existing.status === 'pending') {
    await env.DB.prepare(
      "UPDATE tourist_tax_payments SET status = 'cancelled' WHERE id = ?"
    ).bind(existing.id).run();
  }

  // Crea record pagamento
  const insertResult = await env.DB.prepare(
    'INSERT INTO tourist_tax_payments (reservation_id, amount_cents, taxable_persons, taxable_nights) VALUES (?, ?, ?, ?)'
  ).bind(parseInt(reservationId), amountCents, taxablePersons, taxableNights).run();

  const taxPaymentId = insertResult.meta.last_row_id;

  // Crea Stripe Checkout Session per la tassa
  const siteUrl = env.SITE_URL || 'https://casiavacanze.com';
  const apartmentName = reservation.apartment === 'oliva' ? 'Appartamento Oliva' : 'Appartamento Venica';

  const stripeParams = new URLSearchParams({
    'payment_method_types[]': 'card',
    'mode': 'payment',
    'customer_email': reservation.guest_email,
    'success_url': `${siteUrl}/?tax_paid=success`,
    'cancel_url': `${siteUrl}/?tax_paid=cancelled`,
    'line_items[0][price_data][currency]': 'eur',
    'line_items[0][price_data][product_data][name]': `Tassa di soggiorno — ${apartmentName}`,
    'line_items[0][price_data][product_data][description]': `${taxablePersons} persone x ${taxableNights} notti`,
    'line_items[0][price_data][unit_amount]': amountCents.toString(),
    'line_items[0][quantity]': '1',
    'metadata[type]': 'tourist_tax',
    'metadata[tax_payment_id]': taxPaymentId.toString(),
    'metadata[reservation_id]': reservationId.toString(),
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
    console.error('Stripe error (tourist tax):', err);
    await env.DB.prepare(
      "UPDATE tourist_tax_payments SET status = 'cancelled' WHERE id = ?"
    ).bind(taxPaymentId).run();
    return Response.json({ error: 'Errore creazione pagamento Stripe' }, { status: 500 });
  }

  const session = await stripeRes.json();

  // Aggiorna con session ID
  await env.DB.prepare(
    'UPDATE tourist_tax_payments SET stripe_session_id = ? WHERE id = ?'
  ).bind(session.id, taxPaymentId).run();

  return Response.json({
    amount_cents: amountCents,
    taxable_persons: taxablePersons,
    taxable_nights: taxableNights,
    payment_url: session.url,
    status: 'pending',
  });
}

/**
 * POST /api/admin/send-tax-link/:id
 * Invia email con link pagamento tassa di soggiorno
 */
export async function handleSendTaxLink(reservationId, env) {
  const reservation = await env.DB.prepare(
    'SELECT * FROM reservations WHERE id = ?'
  ).bind(parseInt(reservationId)).first();

  if (!reservation) {
    return Response.json({ error: 'Prenotazione non trovata' }, { status: 404 });
  }

  // Trova l'ultimo pagamento pending
  const taxPayment = await env.DB.prepare(
    'SELECT * FROM tourist_tax_payments WHERE reservation_id = ? AND status = \'pending\' ORDER BY id DESC LIMIT 1'
  ).bind(parseInt(reservationId)).first();

  if (!taxPayment || !taxPayment.stripe_session_id) {
    return Response.json({ error: 'Nessun pagamento tassa in sospeso. Genera prima il link.' }, { status: 400 });
  }

  // Recupera URL dalla sessione Stripe
  const stripeRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${taxPayment.stripe_session_id}`, {
    headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}` },
  });

  if (!stripeRes.ok) {
    return Response.json({ error: 'Errore recupero sessione Stripe' }, { status: 500 });
  }

  const session = await stripeRes.json();

  if (!session.url) {
    return Response.json({ error: 'Sessione Stripe scaduta, rigenera il link' }, { status: 400 });
  }

  await sendTouristTaxEmail(env, reservation, session.url, taxPayment.amount_cents, taxPayment.taxable_persons, taxPayment.taxable_nights);

  return Response.json({ success: true });
}
