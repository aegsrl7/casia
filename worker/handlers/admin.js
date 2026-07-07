import { handleSyncIcal } from './ical.js';
// Handler per API Admin (protette da password)

import { handleAdminGetCheckin, handleAdminVerify, handleAdminSendAccess, handleAlloggiatiExport } from './checkin.js';
import { handleGetSettings, handleUpdateSettings, handleCreateTouristTax, handleSendTaxLink } from './settings.js';

/**
 * Verifica autenticazione Basic Auth
 */
function checkAuth(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return false;
  }
  const decoded = atob(authHeader.split(' ')[1]);
  const [user, pass] = decoded.split(':');
  return user === 'Casia' && pass === env.ADMIN_PASSWORD;
}

/**
 * Risposta 401 con header WWW-Authenticate
 */
function unauthorized() {
  return new Response('Non autorizzato', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="CASIA Admin"' },
  });
}

/**
 * GET /api/admin/reservations?status=confirmed&apartment=oliva&from=2026-07-01&to=2026-08-31
 */
async function getReservations(request, env) {
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const apartment = url.searchParams.get('apartment');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  let query = 'SELECT * FROM reservations WHERE 1=1';
  const params = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (apartment) {
    query += ' AND apartment = ?';
    params.push(apartment);
  }
  if (from) {
    query += ' AND checkout >= ?';
    params.push(from);
  }
  if (to) {
    query += ' AND checkin <= ?';
    params.push(to);
  }

  query += ' ORDER BY checkin DESC';

  const stmt = env.DB.prepare(query);
  const result = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();

  return Response.json({ reservations: result.results });
}

/**
 * POST /api/admin/block-dates
 * Body: { apartment, dates: ["2026-07-15", "2026-07-16"], reason }
 */
async function blockDates(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Body JSON non valido' }, { status: 400 });
  }

  const { apartment, dates, reason } = body;

  if (!apartment || !['oliva', 'venica'].includes(apartment)) {
    return Response.json({ error: 'Appartamento non valido' }, { status: 400 });
  }
  if (!dates || !Array.isArray(dates) || dates.length === 0) {
    return Response.json({ error: 'Array di date richiesto' }, { status: 400 });
  }

  const inserted = [];
  const skipped = [];

  for (const date of dates) {
    try {
      await env.DB.prepare(
        'INSERT INTO blocked_dates (apartment, date, reason) VALUES (?, ?, ?)'
      ).bind(apartment, date, reason || null).run();
      inserted.push(date);
    } catch {
      // UNIQUE constraint violation - data già bloccata
      skipped.push(date);
    }
  }

  return Response.json({ inserted, skipped });
}

/**
 * DELETE /api/admin/block-dates/:id
 */
async function unblockDate(request, env, id) {
  const result = await env.DB.prepare(
    'DELETE FROM blocked_dates WHERE id = ?'
  ).bind(parseInt(id)).run();

  if (result.meta.changes === 0) {
    return Response.json({ error: 'Data bloccata non trovata' }, { status: 404 });
  }

  return Response.json({ success: true });
}

/**
 * GET /api/admin/blocked-dates?apartment=oliva
 */
async function getBlockedDates(request, env) {
  const url = new URL(request.url);
  const apartment = url.searchParams.get('apartment');

  let query = 'SELECT * FROM blocked_dates';
  const params = [];

  if (apartment) {
    query += ' WHERE apartment = ?';
    params.push(apartment);
  }

  query += ' ORDER BY date ASC';

  const stmt = env.DB.prepare(query);
  const result = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();

  return Response.json({ blocked_dates: result.results });
}

/**
 * POST /api/admin/cancel/:id
 * Cancella una prenotazione e (opzionalmente) emette refund Stripe
 */
async function cancelReservation(request, env, id) {
  const reservation = await env.DB.prepare(
    'SELECT * FROM reservations WHERE id = ?'
  ).bind(parseInt(id)).first();

  if (!reservation) {
    return Response.json({ error: 'Prenotazione non trovata' }, { status: 404 });
  }

  if (reservation.status === 'cancelled' || reservation.status === 'refunded') {
    return Response.json({ error: 'Prenotazione già cancellata/rimborsata' }, { status: 400 });
  }

  // Se c'è un pagamento Stripe, emetti refund
  if (reservation.stripe_payment_id && reservation.status === 'confirmed') {
    try {
      const refundRes = await fetch('https://api.stripe.com/v1/refunds', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `payment_intent=${reservation.stripe_payment_id}`,
      });

      if (!refundRes.ok) {
        const err = await refundRes.text();
        console.error('Stripe refund error:', err);
        return Response.json({ error: 'Errore durante il rimborso Stripe' }, { status: 500 });
      }

      await env.DB.prepare(
        'UPDATE reservations SET status = ? WHERE id = ?'
      ).bind('refunded', parseInt(id)).run();

      return Response.json({ success: true, status: 'refunded' });
    } catch (err) {
      console.error('Refund error:', err);
      return Response.json({ error: 'Errore durante il rimborso' }, { status: 500 });
    }
  }

  // Se pending o senza pagamento, cancella direttamente
  await env.DB.prepare(
    'UPDATE reservations SET status = ? WHERE id = ?'
  ).bind('cancelled', parseInt(id)).run();

  return Response.json({ success: true, status: 'cancelled' });
}

/**
 * DELETE /api/admin/delete/:id
 * Elimina definitivamente una prenotazione (solo cancelled/refunded/pending)
 */
async function deleteReservation(request, env, id) {
  const reservation = await env.DB.prepare(
    'SELECT * FROM reservations WHERE id = ?'
  ).bind(parseInt(id)).first();

  if (!reservation) {
    return Response.json({ error: 'Prenotazione non trovata' }, { status: 404 });
  }

  if (reservation.status === 'confirmed') {
    return Response.json({ error: 'Non puoi eliminare una prenotazione confermata. Cancellala prima.' }, { status: 400 });
  }

  await env.DB.prepare('DELETE FROM reservations WHERE id = ?').bind(parseInt(id)).run();

  return Response.json({ success: true });
}

/**
 * GET /api/admin/pricing?apartment=oliva
 */
async function getPricing(request, env) {
  const url = new URL(request.url);
  const apartment = url.searchParams.get('apartment');

  let query = 'SELECT * FROM pricing';
  const params = [];

  if (apartment) {
    query += ' WHERE apartment = ?';
    params.push(apartment);
  }

  query += ' ORDER BY date_from ASC';

  const stmt = env.DB.prepare(query);
  const result = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();

  return Response.json({ pricing: result.results });
}

/**
 * POST /api/admin/pricing
 * Body: { apartment, season, date_from, date_to, price_night, min_nights }
 */
async function upsertPricing(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Body JSON non valido' }, { status: 400 });
  }

  const { id, apartment, season, date_from, date_to, price_night, min_nights } = body;

  if (!apartment || !season || !date_from || !date_to || !price_night) {
    return Response.json({ error: 'Campi obbligatori mancanti' }, { status: 400 });
  }

  if (id) {
    // Aggiorna
    await env.DB.prepare(`
      UPDATE pricing SET apartment=?, season=?, date_from=?, date_to=?, price_night=?, min_nights=?
      WHERE id=?
    `).bind(apartment, season, date_from, date_to, price_night, min_nights || 1, parseInt(id)).run();
  } else {
    // Inserisci
    await env.DB.prepare(`
      INSERT INTO pricing (apartment, season, date_from, date_to, price_night, min_nights)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(apartment, season, date_from, date_to, price_night, min_nights || 1).run();
  }

  return Response.json({ success: true });
}

/**
 * DELETE /api/admin/pricing/:id
 */
async function deletePricing(request, env, id) {
  await env.DB.prepare('DELETE FROM pricing WHERE id = ?').bind(parseInt(id)).run();
  return Response.json({ success: true });
}

/**
 * GET /api/admin/translations?lang=en&page=index
 */
async function getTranslations(request, env) {
  const url = new URL(request.url);
  const lang = url.searchParams.get('lang');
  const page = url.searchParams.get('page');

  if (!lang) {
    return Response.json({ error: 'Parametro lang richiesto' }, { status: 400 });
  }

  let query = 'SELECT id, lang, page, key, value, updated_at FROM translations WHERE lang = ?';
  const params = [lang];

  if (page) {
    query += ' AND page = ?';
    params.push(page);
  }

  query += ' ORDER BY page, key';

  const stmt = env.DB.prepare(query);
  const result = await stmt.bind(...params).all();

  return Response.json({ translations: result.results });
}

/**
 * PUT /api/admin/translations
 * Body: { updates: [{ lang, page, key, value }, ...] }
 */
async function updateTranslations(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Body JSON non valido' }, { status: 400 });
  }

  const { updates } = body;
  if (!updates || !Array.isArray(updates) || updates.length === 0) {
    return Response.json({ error: 'Array updates richiesto' }, { status: 400 });
  }

  let updated = 0;
  let inserted = 0;

  for (const u of updates) {
    if (!u.lang || !u.page || !u.key || u.value === undefined) continue;

    const result = await env.DB.prepare(`
      INSERT INTO translations (lang, page, key, value, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(lang, page, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).bind(u.lang, u.page, u.key, u.value).run();

    if (result.meta.changes > 0) {
      if (result.meta.last_row_id > 0) inserted++; else updated++;
    }
  }

  return Response.json({ success: true, updated, inserted, total: updates.length });
}

/**
 * POST /api/admin/translations/seed
 * Body: { lang: "en", translations: { common: {...}, index: {...}, amici: {...} } }
 * Importa traduzioni da JSON nel DB (upsert)
 */
async function seedTranslations(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Body JSON non valido' }, { status: 400 });
  }

  const { lang, translations } = body;
  if (!lang || !translations) {
    return Response.json({ error: 'lang e translations richiesti' }, { status: 400 });
  }

  let count = 0;

  for (const [page, keys] of Object.entries(translations)) {
    if (typeof keys !== 'object') continue;
    for (const [key, value] of Object.entries(keys)) {
      const strValue = typeof value === 'string' ? value
        : Array.isArray(value) ? JSON.stringify(value)
        : String(value);

      await env.DB.prepare(`
        INSERT INTO translations (lang, page, key, value, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'))
        ON CONFLICT(lang, page, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `).bind(lang, page, key, strValue).run();
      count++;
    }
  }

  return Response.json({ success: true, lang, keys_imported: count });
}

/**
 * GET /api/admin/customers
 * Lista clienti aggregata per email
 */
async function getCustomers(request, env) {
  const url = new URL(request.url);
  const marketingOnly = url.searchParams.get('marketing') === '1';

  let query = `
    SELECT
      guest_email as email,
      MAX(guest_name) as name,
      MAX(guest_phone) as phone,
      COUNT(*) as booking_count,
      SUM(CASE WHEN status = 'confirmed' THEN total_cents ELSE 0 END) as total_spent,
      MIN(checkin) as first_visit,
      MAX(checkin) as last_visit,
      MAX(marketing_consent) as marketing_consent
    FROM reservations
    WHERE status IN ('confirmed', 'refunded')
    GROUP BY guest_email
  `;

  if (marketingOnly) {
    query = `
      SELECT
        guest_email as email,
        MAX(guest_name) as name,
        MAX(guest_phone) as phone,
        COUNT(*) as booking_count,
        SUM(CASE WHEN status = 'confirmed' THEN total_cents ELSE 0 END) as total_spent,
        MIN(checkin) as first_visit,
        MAX(checkin) as last_visit,
        MAX(marketing_consent) as marketing_consent
      FROM reservations
      WHERE status IN ('confirmed', 'refunded')
      GROUP BY guest_email
      HAVING MAX(marketing_consent) = 1
    `;
  }

  query += ' ORDER BY last_visit DESC';

  const result = await env.DB.prepare(query).all();

  return Response.json({ customers: result.results });
}

/**
 * GET /api/admin/customers/:email/bookings
 * Storico prenotazioni per email
 */
async function getCustomerBookings(email, env) {
  const result = await env.DB.prepare(
    'SELECT id, apartment, checkin, checkout, nights, total_cents, status, created_at FROM reservations WHERE guest_email = ? ORDER BY checkin DESC'
  ).bind(email).all();

  return Response.json({ bookings: result.results });
}

/**
 * GET /api/admin/campaigns
 */
async function getCampaigns(env) {
  const result = await env.DB.prepare(
    'SELECT * FROM email_campaigns ORDER BY id DESC'
  ).all();
  return Response.json({ campaigns: result.results });
}

/**
 * POST /api/admin/campaigns
 * Body: { subject, body_html, recipients }
 */
async function createCampaign(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Body JSON non valido' }, { status: 400 });
  }

  const { subject, body_html } = body;
  if (!subject || !body_html) {
    return Response.json({ error: 'Oggetto e corpo richiesti' }, { status: 400 });
  }

  const result = await env.DB.prepare(
    'INSERT INTO email_campaigns (subject, body_html) VALUES (?, ?)'
  ).bind(subject, body_html).run();

  return Response.json({ campaign_id: result.meta.last_row_id });
}

/**
 * POST /api/admin/campaigns/:id/send
 * Invia la campagna ai destinatari
 */
async function sendCampaign(campaignId, env) {
  const { buildMarketingEmail } = await import('./email.js');

  const campaign = await env.DB.prepare(
    'SELECT * FROM email_campaigns WHERE id = ?'
  ).bind(parseInt(campaignId)).first();

  if (!campaign) {
    return Response.json({ error: 'Campagna non trovata' }, { status: 404 });
  }

  if (campaign.status === 'sent') {
    return Response.json({ error: 'Campagna già inviata' }, { status: 400 });
  }

  // Recupera destinatari con consenso marketing
  const recipients = await env.DB.prepare(`
    SELECT guest_email as email, MAX(guest_name) as name
    FROM reservations
    WHERE status IN ('confirmed', 'refunded') AND marketing_consent = 1
    GROUP BY guest_email
  `).all();

  if (recipients.results.length === 0) {
    return Response.json({ error: 'Nessun destinatario con consenso marketing' }, { status: 400 });
  }

  const htmlTemplate = buildMarketingEmail(campaign.subject, campaign.body_html);
  let sentCount = 0;

  for (const recipient of recipients.results) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'CASIA Country House <onboarding@resend.dev>',
          to: [recipient.email],
          subject: campaign.subject,
          html: htmlTemplate,
        }),
      });

      const status = res.ok ? 'sent' : 'failed';

      await env.DB.prepare(
        'INSERT INTO email_campaign_sends (campaign_id, guest_email, guest_name, status) VALUES (?, ?, ?, ?)'
      ).bind(parseInt(campaignId), recipient.email, recipient.name, status).run();

      if (res.ok) sentCount++;
    } catch (err) {
      console.error('Campaign send error:', err.message);
      await env.DB.prepare(
        'INSERT INTO email_campaign_sends (campaign_id, guest_email, guest_name, status) VALUES (?, ?, ?, \'failed\')'
      ).bind(parseInt(campaignId), recipient.email, recipient.name).run();
    }
  }

  // Aggiorna campagna
  await env.DB.prepare(
    "UPDATE email_campaigns SET status = 'sent', sent_at = datetime('now'), recipients_count = ? WHERE id = ?"
  ).bind(sentCount, parseInt(campaignId)).run();

  return Response.json({ success: true, sent_count: sentCount, total: recipients.results.length });
}

/**
 * GET /api/admin/campaigns/:id
 * Dettaglio campagna con log invii
 */
async function getCampaignDetail(campaignId, env) {
  const campaign = await env.DB.prepare(
    'SELECT * FROM email_campaigns WHERE id = ?'
  ).bind(parseInt(campaignId)).first();

  if (!campaign) {
    return Response.json({ error: 'Campagna non trovata' }, { status: 404 });
  }

  const sends = await env.DB.prepare(
    'SELECT * FROM email_campaign_sends WHERE campaign_id = ? ORDER BY id ASC'
  ).bind(parseInt(campaignId)).all();

  return Response.json({ campaign, sends: sends.results });
}

/**
 * Router admin - gestisce tutte le rotte /api/admin/*
 */
/**
 * POST /api/admin/external-booking
 * Crea una prenotazione esterna (Booking.com, Airbnb)
 */
async function createExternalBooking(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Body JSON non valido' }, { status: 400 });
  }

  const { source, apartment, checkin, checkout, external_ref, guest_name, guest_email, guest_phone, adults, children } = body;

  if (!source || !['booking', 'airbnb'].includes(source)) {
    return Response.json({ error: 'Source deve essere booking o airbnb' }, { status: 400 });
  }
  if (!apartment || !['oliva', 'venica'].includes(apartment)) {
    return Response.json({ error: 'Appartamento non valido' }, { status: 400 });
  }
  if (!checkin || !checkout) {
    return Response.json({ error: 'Date check-in e check-out obbligatorie' }, { status: 400 });
  }

  const ciDate = new Date(checkin + 'T00:00:00');
  const coDate = new Date(checkout + 'T00:00:00');
  const nights = Math.round((coDate - ciDate) / (1000 * 60 * 60 * 24));

  if (nights <= 0) {
    return Response.json({ error: 'Check-out deve essere successivo al check-in' }, { status: 400 });
  }

  const result = await env.DB.prepare(`
    INSERT INTO reservations (apartment, checkin, checkout, nights, adults, children,
      guest_name, guest_email, guest_phone, status, source, external_ref, lang)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, 'it')
  `).bind(
    apartment, checkin, checkout, nights,
    adults || 2, children || 0,
    guest_name || 'Ospite ' + source.charAt(0).toUpperCase() + source.slice(1),
    guest_email || '',
    guest_phone || '',
    source,
    external_ref || null
  ).run();

  return Response.json({ success: true, id: result.meta.last_row_id });
}

export async function handleAdmin(request, env, path) {
  if (!checkAuth(request, env)) {
    return unauthorized();
  }

  const method = request.method;

  // GET /api/admin/reservations
  if (method === 'GET' && path === '/api/admin/reservations') {
    return getReservations(request, env);
  }

  // POST /api/admin/sync-ical
  if (method === 'POST' && path === '/api/admin/sync-ical') {
    return handleSyncIcal(request, env);
  }

  // POST /api/admin/external-booking
  if (method === 'POST' && path === '/api/admin/external-booking') {
    return createExternalBooking(request, env);
  }

  // GET /api/admin/blocked-dates
  if (method === 'GET' && path === '/api/admin/blocked-dates') {
    return getBlockedDates(request, env);
  }

  // POST /api/admin/block-dates
  if (method === 'POST' && path === '/api/admin/block-dates') {
    return blockDates(request, env);
  }

  // DELETE /api/admin/block-dates/:id
  const unblockMatch = path.match(/^\/api\/admin\/block-dates\/(\d+)$/);
  if (method === 'DELETE' && unblockMatch) {
    return unblockDate(request, env, unblockMatch[1]);
  }

  // POST /api/admin/cancel/:id
  const cancelMatch = path.match(/^\/api\/admin\/cancel\/(\d+)$/);
  if (method === 'POST' && cancelMatch) {
    return cancelReservation(request, env, cancelMatch[1]);
  }

  // DELETE /api/admin/delete/:id
  const deleteMatch = path.match(/^\/api\/admin\/delete\/(\d+)$/);
  if (method === 'DELETE' && deleteMatch) {
    return deleteReservation(request, env, deleteMatch[1]);
  }

  // GET /api/admin/pricing
  if (method === 'GET' && path === '/api/admin/pricing') {
    return getPricing(request, env);
  }

  // POST /api/admin/pricing
  if (method === 'POST' && path === '/api/admin/pricing') {
    return upsertPricing(request, env);
  }

  // DELETE /api/admin/pricing/:id
  const pricingDeleteMatch = path.match(/^\/api\/admin\/pricing\/(\d+)$/);
  if (method === 'DELETE' && pricingDeleteMatch) {
    return deletePricing(request, env, pricingDeleteMatch[1]);
  }

  // GET /api/admin/translations
  if (method === 'GET' && path === '/api/admin/translations') {
    return getTranslations(request, env);
  }

  // PUT /api/admin/translations
  if (method === 'PUT' && path === '/api/admin/translations') {
    return updateTranslations(request, env);
  }

  // POST /api/admin/translations/seed
  if (method === 'POST' && path === '/api/admin/translations/seed') {
    return seedTranslations(request, env);
  }

  // GET /api/admin/checkin/:id
  const checkinMatch = path.match(/^\/api\/admin\/checkin\/(\d+)$/);
  if (method === 'GET' && checkinMatch) {
    return handleAdminGetCheckin(checkinMatch[1], env);
  }

  // POST /api/admin/verify/:id
  const verifyMatch = path.match(/^\/api\/admin\/verify\/(\d+)$/);
  if (method === 'POST' && verifyMatch) {
    return handleAdminVerify(verifyMatch[1], env);
  }

  // POST /api/admin/send-access/:id
  const accessMatch = path.match(/^\/api\/admin\/send-access\/(\d+)$/);
  if (method === 'POST' && accessMatch) {
    return handleAdminSendAccess(accessMatch[1], request, env);
  }

  // GET /api/admin/alloggiati/:id
  const alloggiatiMatch = path.match(/^\/api\/admin\/alloggiati\/(\d+)$/);
  if (method === 'GET' && alloggiatiMatch) {
    return handleAlloggiatiExport(alloggiatiMatch[1], env);
  }

  // GET /api/admin/settings
  if (method === 'GET' && path === '/api/admin/settings') {
    return handleGetSettings(env);
  }

  // PUT /api/admin/settings
  if (method === 'PUT' && path === '/api/admin/settings') {
    return handleUpdateSettings(request, env);
  }

  // POST /api/admin/tourist-tax/:id
  const taxMatch = path.match(/^\/api\/admin\/tourist-tax\/(\d+)$/);
  if (method === 'POST' && taxMatch) {
    return handleCreateTouristTax(taxMatch[1], env);
  }

  // POST /api/admin/send-tax-link/:id
  const taxLinkMatch = path.match(/^\/api\/admin\/send-tax-link\/(\d+)$/);
  if (method === 'POST' && taxLinkMatch) {
    return handleSendTaxLink(taxLinkMatch[1], env);
  }

  // GET /api/admin/customers
  if (method === 'GET' && path === '/api/admin/customers') {
    return getCustomers(request, env);
  }

  // GET /api/admin/customers/:email/bookings
  const customerBookingsMatch = path.match(/^\/api\/admin\/customers\/(.+)\/bookings$/);
  if (method === 'GET' && customerBookingsMatch) {
    return getCustomerBookings(decodeURIComponent(customerBookingsMatch[1]), env);
  }

  // GET /api/admin/campaigns
  if (method === 'GET' && path === '/api/admin/campaigns') {
    return getCampaigns(env);
  }

  // POST /api/admin/campaigns
  if (method === 'POST' && path === '/api/admin/campaigns') {
    return createCampaign(request, env);
  }

  // POST /api/admin/campaigns/:id/send
  const campaignSendMatch = path.match(/^\/api\/admin\/campaigns\/(\d+)\/send$/);
  if (method === 'POST' && campaignSendMatch) {
    return sendCampaign(campaignSendMatch[1], env);
  }

  // GET /api/admin/campaigns/:id
  const campaignDetailMatch = path.match(/^\/api\/admin\/campaigns\/(\d+)$/);
  if (method === 'GET' && campaignDetailMatch) {
    return getCampaignDetail(campaignDetailMatch[1], env);
  }

  return Response.json({ error: 'Endpoint non trovato' }, { status: 404 });
}
