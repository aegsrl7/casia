// Export iCal del calendario CASIA per i canali esterni (Booking.com, ecc.)
// GET /api/ical/{apartment}.ics?key=TOKEN
// Esporta prenotazioni confermate NON provenienti da Booking (per evitare doppioni
// quando Booking reimporta il feed) + date bloccate manualmente.

function fmtDate(d) {
  return d.replace(/-/g, '');
}

/** Comprime una lista di giorni YYYY-MM-DD in intervalli [start, endEsclusivo) */
function daysToRanges(days) {
  const sorted = [...new Set(days)].sort();
  const ranges = [];
  let start = null, prev = null;
  for (const day of sorted) {
    if (!start) { start = day; prev = day; continue; }
    const next = new Date(prev + 'T00:00:00Z');
    next.setUTCDate(next.getUTCDate() + 1);
    if (next.toISOString().split('T')[0] === day) {
      prev = day;
    } else {
      ranges.push([start, prev]);
      start = day; prev = day;
    }
  }
  if (start) ranges.push([start, prev]);
  // DTEND esclusivo: giorno successivo all'ultimo bloccato
  return ranges.map(([a, b]) => {
    const end = new Date(b + 'T00:00:00Z');
    end.setUTCDate(end.getUTCDate() + 1);
    return [a, end.toISOString().split('T')[0]];
  });
}

export async function handleIcalExport(request, env, apartment, pathKey) {
  const url = new URL(request.url);
  const key = pathKey || url.searchParams.get('key') || '';

  const setting = await env.DB.prepare(
    "SELECT value FROM settings WHERE key = 'ical_export_key'"
  ).first();

  if (!setting || !setting.value || key !== setting.value) {
    return new Response('Non autorizzato', { status: 401 });
  }
  if (!['oliva', 'venica'].includes(apartment)) {
    return new Response('Appartamento sconosciuto', { status: 404 });
  }

  // Prenotazioni confermate non importate da Booking (finestra: da 60 giorni fa in poi)
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 60);
  const from = cutoff.toISOString().split('T')[0];

  const reservations = await env.DB.prepare(
    `SELECT id, checkin, checkout FROM reservations
     WHERE apartment = ? AND status = 'confirmed' AND source != 'booking' AND checkout >= ?
     ORDER BY checkin`
  ).bind(apartment, from).all();

  const blocked = await env.DB.prepare(
    'SELECT date FROM blocked_dates WHERE apartment = ? AND date >= ? ORDER BY date'
  ).bind(apartment, from).all();

  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Casia Vacanze//Calendar Export//IT',
    'CALSCALE:GREGORIAN',
  ];

  for (const r of reservations.results) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:casia-res-${r.id}-${apartment}@casiavacanze.com`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${fmtDate(r.checkin)}`,
      `DTEND;VALUE=DATE:${fmtDate(r.checkout)}`,
      'SUMMARY:CASIA - Prenotato',
      'END:VEVENT'
    );
  }

  for (const [start, end] of daysToRanges(blocked.results.map(b => b.date))) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:casia-block-${start}-${apartment}@casiavacanze.com`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${fmtDate(start)}`,
      `DTEND;VALUE=DATE:${fmtDate(end)}`,
      'SUMMARY:CASIA - Non disponibile',
      'END:VEVENT'
    );
  }

  // Alcuni importatori rifiutano i calendari senza eventi: sentinella nel passato
  if (reservations.results.length === 0 && blocked.results.length === 0) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:casia-sentinel-${apartment}@casiavacanze.com`,
      `DTSTAMP:${now}`,
      'DTSTART;VALUE=DATE:20260101',
      'DTEND;VALUE=DATE:20260102',
      'SUMMARY:CASIA - Sincronizzazione attiva',
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');

  const body = lines.join('\r\n') + '\r\n';
  return new Response(request.method === 'HEAD' ? null : body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Length': String(new TextEncoder().encode(body).length),
      'Cache-Control': 'no-cache',
    },
  });
}
