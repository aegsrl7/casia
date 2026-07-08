// CASIA Country House - Cloudflare Worker Entry Point
// Gestisce API di prenotazione + serve file statici

import { handleAvailability, handleCalculatePrice } from './handlers/availability.js';
import { handleCreateCheckout } from './handlers/checkout.js';
import { handleWebhook } from './handlers/webhook.js';
import { handleAdmin } from './handlers/admin.js';
import { handleGetCheckin, handleSaveTravelers, handleDocUpload } from './handlers/checkin.js';
import { syncIcal } from './handlers/ical.js';
import { handleIcalExport } from './handlers/ical-export.js';

// Header CORS per le API
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

export default {
  // Cron: sincronizzazione periodica dei calendari Booking.com
  async scheduled(event, env, ctx) {
    ctx.waitUntil(syncIcal(env));
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // --- API Routes ---
    if (path.startsWith('/api/')) {
      try {
        // Export iCal pubblico (protetto da token) per Booking.com e altri canali
        const icalMatch = path.match(/^\/api\/ical\/(oliva|venica)(?:-([a-f0-9]{16,64}))?\.ics$/);
        if ((request.method === 'GET' || request.method === 'HEAD') && icalMatch) {
          return handleIcalExport(request, env, icalMatch[1], icalMatch[2] || null);
        }

        // Disponibilità
        if (request.method === 'GET' && path === '/api/availability') {
          const res = await handleAvailability(request, env);
          return addCors(res);
        }

        // Calcolo prezzo
        if (request.method === 'POST' && path === '/api/calculate-price') {
          const res = await handleCalculatePrice(request, env);
          return addCors(res);
        }

        // Dettaglio prenotazione pubblica (per conferma)
        if (request.method === 'GET' && path.startsWith('/api/reservation/')) {
          const id = path.split('/api/reservation/')[1];
          const res = await handleGetReservation(id, env);
          return addCors(res);
        }

        // Traduzioni pubbliche (no auth)
        if (request.method === 'GET' && path === '/api/translations') {
          const res = await handleGetTranslations(request, env);
          return addCors(res);
        }

        // Crea checkout Stripe
        if (request.method === 'POST' && path === '/api/create-checkout') {
          const res = await handleCreateCheckout(request, env);
          return addCors(res);
        }

        // Webhook Stripe (NO CORS - viene da Stripe)
        if (request.method === 'POST' && path === '/api/webhook') {
          return handleWebhook(request, env);
        }

        // Check-in pubblico (auth via token UUID)
        const checkinMatch = path.match(/^\/api\/checkin\/([a-f0-9-]{36})$/);
        if (request.method === 'GET' && checkinMatch) {
          const res = await handleGetCheckin(checkinMatch[1], env);
          return addCors(res);
        }
        const checkinTravelersMatch = path.match(/^\/api\/checkin\/([a-f0-9-]{36})\/travelers$/);
        if (request.method === 'POST' && checkinTravelersMatch) {
          const res = await handleSaveTravelers(checkinTravelersMatch[1], request, env);
          return addCors(res);
        }
        const checkinUploadMatch = path.match(/^\/api\/checkin\/([a-f0-9-]{36})\/upload$/);
        if (request.method === 'POST' && checkinUploadMatch) {
          const res = await handleDocUpload(checkinUploadMatch[1], request, env);
          return addCors(res);
        }

        // Admin routes
        if (path.startsWith('/api/admin/')) {
          const res = await handleAdmin(request, env, path);
          return addCors(res);
        }

        return jsonResponse({ error: 'Endpoint non trovato' }, 404);
      } catch (err) {
        console.error('API Error:', err);
        return jsonResponse({ error: 'Errore interno del server' }, 500);
      }
    }

    // --- Static Assets ---
    // Serve i file statici dalla directory del sito
    return env.ASSETS.fetch(request);
  },
};

/**
 * Ritorna i dettagli pubblici di una prenotazione (per modal di conferma)
 */
async function handleGetReservation(id, env) {
  if (!id || isNaN(id)) {
    return Response.json({ error: 'ID non valido' }, { status: 400 });
  }

  const reservation = await env.DB.prepare(`
    SELECT apartment, checkin, checkout, nights, adults, children,
           guest_name, guest_email, total_cents, status, created_at
    FROM reservations WHERE id = ?
  `).bind(parseInt(id)).first();

  if (!reservation) {
    return Response.json({ error: 'Prenotazione non trovata' }, { status: 404 });
  }

  return Response.json({
    id: parseInt(id),
    apartment: reservation.apartment,
    apartment_name: reservation.apartment === 'oliva' ? 'Appartamento Oliva' : 'Appartamento Venica',
    checkin: reservation.checkin,
    checkout: reservation.checkout,
    nights: reservation.nights,
    adults: reservation.adults,
    children: reservation.children,
    guest_name: reservation.guest_name,
    guest_email: reservation.guest_email,
    total_cents: reservation.total_cents,
    total_formatted: (reservation.total_cents / 100).toFixed(2),
    status: reservation.status,
    created_at: reservation.created_at,
  });
}

/**
 * GET /api/translations?lang=en
 * Ritorna tutte le traduzioni per una lingua in formato { common: {...}, index: {...}, amici: {...} }
 */
async function handleGetTranslations(request, env) {
  const url = new URL(request.url);
  const lang = url.searchParams.get('lang');

  if (!lang || !['it', 'en', 'fr', 'de'].includes(lang)) {
    return Response.json({ error: 'Parametro lang richiesto (it, en, fr, de)' }, { status: 400 });
  }

  const result = await env.DB.prepare(
    'SELECT page, key, value FROM translations WHERE lang = ?'
  ).bind(lang).all();

  const translations = { common: {}, index: {}, amici: {} };

  for (const row of result.results) {
    if (translations[row.page]) {
      translations[row.page][row.key] = row.value;
    }
  }

  return Response.json(translations, {
    headers: { 'Cache-Control': 'public, max-age=300' },
  });
}

/**
 * Pagina Coming Soon per maintenance mode
 */
function comingSoonPage() {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>CASIA Country House — Coming Soon</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300&family=Jost:wght@300;400;500&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #2D2926;
      color: #F8F5F0;
      font-family: 'Jost', sans-serif;
      text-align: center;
      padding: 40px 24px;
    }
    .container { max-width: 560px; }
    .logo {
      font-family: 'Cormorant Garamond', serif;
      font-size: clamp(2rem, 5vw, 3.2rem);
      font-weight: 300;
      letter-spacing: 6px;
      text-transform: uppercase;
      color: #B8956B;
      margin-bottom: 8px;
    }
    .sub {
      font-family: 'Cormorant Garamond', serif;
      font-size: 1.1rem;
      font-weight: 300;
      font-style: italic;
      color: #d4c5b0;
      letter-spacing: 3px;
      margin-bottom: 48px;
    }
    .divider {
      width: 60px;
      height: 1px;
      background: #B8956B;
      margin: 0 auto 48px;
    }
    h1 {
      font-family: 'Cormorant Garamond', serif;
      font-size: clamp(1.4rem, 3vw, 2rem);
      font-weight: 300;
      color: #F8F5F0;
      margin-bottom: 20px;
      letter-spacing: 1px;
    }
    p {
      font-size: 0.95rem;
      font-weight: 300;
      color: #a89e94;
      line-height: 1.8;
      margin-bottom: 40px;
    }
    .contact a {
      color: #B8956B;
      text-decoration: none;
      font-weight: 400;
      transition: opacity 0.3s;
    }
    .contact a:hover { opacity: 0.7; }
    .contact span { color: #5a5652; margin: 0 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">CASIA</div>
    <div class="sub">Country House</div>
    <div class="divider"></div>
    <h1>Stiamo preparando qualcosa di speciale</h1>
    <p>Il nostro sito web sarà presto online.<br>Nel frattempo, non esitate a contattarci per informazioni e prenotazioni.</p>
    <div class="contact">
      <a href="mailto:info@casiavacanze.com">info@casiavacanze.com</a>
      <span>|</span>
      <a href="tel:+393514321088">+39 351 432 1088</a>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Aggiunge header CORS alla risposta
 */
function addCors(response) {
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    newHeaders.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
