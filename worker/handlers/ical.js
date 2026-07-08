// Sincronizzazione calendari iCal (Booking.com) → prenotazioni esterne
// Le URL dei feed si configurano nelle impostazioni: ical_url_oliva, ical_url_venica

/**
 * Parser ICS minimale: estrae gli eventi VEVENT con UID, DTSTART, DTEND, SUMMARY.
 * Gestisce il "line folding" (righe continuate che iniziano con spazio/tab).
 */
function parseIcs(text) {
  const unfolded = text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
  const events = [];
  const blocks = unfolded.split('BEGIN:VEVENT').slice(1);

  for (const block of blocks) {
    const body = block.split('END:VEVENT')[0];
    const ev = {};
    for (const line of body.split('\n')) {
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      const rawKey = line.slice(0, idx);
      const value = line.slice(idx + 1).trim();
      const key = rawKey.split(';')[0].toUpperCase();
      if (key === 'UID') ev.uid = value;
      else if (key === 'DTSTART') ev.start = icsDate(value);
      else if (key === 'DTEND') ev.end = icsDate(value);
      else if (key === 'SUMMARY') ev.summary = value;
    }
    if (ev.start && ev.end) events.push(ev);
  }
  return events;
}

/** Converte 20260715 o 20260715T140000Z in YYYY-MM-DD */
function icsDate(v) {
  const m = v.match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function nightsBetween(checkin, checkout) {
  const a = new Date(checkin + 'T00:00:00Z');
  const b = new Date(checkout + 'T00:00:00Z');
  return Math.max(1, Math.round((b - a) / 86400000));
}

/**
 * Sincronizza un singolo appartamento dal suo feed iCal.
 * Ritorna un report { imported, updated, cancelled, events }.
 */
async function syncApartment(env, apartment, url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'CASIA-sync/1.0' } });
  if (!res.ok) throw new Error(`feed ${apartment}: HTTP ${res.status}`);
  const events = parseIcs(await res.text());

  const today = new Date().toISOString().split('T')[0];

  // Protezione: se il feed è vuoto ma abbiamo prenotazioni future sincronizzate,
  // probabilmente il link è stato rigenerato o è rotto. Non cancellare nulla.
  if (events.length === 0) {
    const future = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM reservations
       WHERE source = 'booking' AND external_ref LIKE 'ical:%' AND apartment = ?
         AND checkin >= ? AND status = 'confirmed'`
    ).bind(apartment, today).first();
    if (future && future.n > 0) {
      return {
        apartment, events: 0, imported: 0, updated: 0, cancelled: 0, closedDays: 0,
        warning: `Feed vuoto ma ${future.n} prenotazioni future presenti: nessuna modifica applicata. Verificare che il link iCal sia ancora valido.`,
      };
    }
  }
  // Su Booking si prenota al massimo 16 mesi in anticipo: eventi oltre
  // quell'orizzonte sono chiusure di calendario, non soggiorni.
  const horizon = new Date();
  horizon.setUTCMonth(horizon.getUTCMonth() + 16);
  const horizonStr = horizon.toISOString().split('T')[0];

  const stays = events.filter(ev => ev.start <= horizonStr);
  const closures = events.filter(ev => ev.start > horizonStr);

  const seen = [];
  let imported = 0, updated = 0;

  for (const ev of stays) {
    if (!ev.uid) ev.uid = `${ev.start}_${ev.end}`;
    const ref = `ical:${ev.uid}`;
    seen.push(ref);

    const existing = await env.DB.prepare(
      'SELECT id, checkin, checkout, status FROM reservations WHERE source = ? AND external_ref = ? AND apartment = ?'
    ).bind('booking', ref, apartment).first();

    const guestName = ev.summary && !/closed|not available/i.test(ev.summary)
      ? ev.summary : 'Booking.com';

    if (existing) {
      if (existing.checkin !== ev.start || existing.checkout !== ev.end || existing.status === 'cancelled') {
        await env.DB.prepare(
          `UPDATE reservations SET checkin = ?, checkout = ?, nights = ?, status = 'confirmed' WHERE id = ?`
        ).bind(ev.start, ev.end, nightsBetween(ev.start, ev.end), existing.id).run();
        updated++;
      }
    } else {
      await env.DB.prepare(
        `INSERT INTO reservations
           (apartment, checkin, checkout, nights, adults, children, guest_name, guest_email,
            status, source, external_ref, source_page, admin_notes)
         VALUES (?, ?, ?, ?, 2, 0, ?, 'sync@booking.import', 'confirmed', 'booking', ?, 'ical-sync',
                 'Importata automaticamente dal calendario Booking.com')`
      ).bind(apartment, ev.start, ev.end, nightsBetween(ev.start, ev.end), guestName, ref).run();
      imported++;
    }
  }

  // Chiusure di calendario → date bloccate (ricostruite a ogni sync)
  await env.DB.prepare(
    "DELETE FROM blocked_dates WHERE apartment = ? AND reason LIKE 'Booking.com iCal%' AND date >= ?"
  ).bind(apartment, today).run();
  let closedDays = 0;
  for (const ev of closures) {
    let d = new Date(ev.start + 'T00:00:00Z');
    const end = new Date(ev.end + 'T00:00:00Z');
    while (d < end) {
      const ds = d.toISOString().split('T')[0];
      await env.DB.prepare(
        'INSERT INTO blocked_dates (apartment, date, reason) VALUES (?, ?, ?) ON CONFLICT(apartment, date) DO NOTHING'
      ).bind(apartment, ds, 'Booking.com iCal (chiusura calendario)').run();
      closedDays++;
      d.setUTCDate(d.getUTCDate() + 1);
    }
  }

  // Prenotazioni future importate in passato ma sparite dal feed → cancellate su Booking
  let cancelled = 0;
  if (events.length >= 0) {
    const rows = await env.DB.prepare(
      `SELECT id, external_ref FROM reservations
       WHERE source = 'booking' AND external_ref LIKE 'ical:%' AND apartment = ?
         AND checkin >= ? AND status = 'confirmed'`
    ).bind(apartment, today).all();

    for (const row of rows.results) {
      if (!seen.includes(row.external_ref)) {
        await env.DB.prepare(`UPDATE reservations SET status = 'cancelled' WHERE id = ?`).bind(row.id).run();
        cancelled++;
      }
    }
  }

  return { apartment, events: events.length, imported, updated, cancelled, closedDays };
}

/**
 * Sincronizza tutti gli appartamenti con un feed configurato.
 */
export async function syncIcal(env) {
  const result = await env.DB.prepare(
    "SELECT key, value FROM settings WHERE key IN ('ical_url_oliva', 'ical_url_venica')"
  ).all();

  const urls = {};
  for (const row of result.results) {
    if (row.value && row.value.startsWith('http')) {
      urls[row.key === 'ical_url_oliva' ? 'oliva' : 'venica'] = row.value;
    }
  }

  const reports = [];
  for (const [apartment, url] of Object.entries(urls)) {
    try {
      reports.push(await syncApartment(env, apartment, url));
    } catch (err) {
      reports.push({ apartment, error: String(err.message || err) });
    }
  }

  await env.DB.prepare(
    "INSERT INTO settings (key, value, updated_at) VALUES ('ical_last_sync', ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
  ).bind(JSON.stringify({ at: new Date().toISOString(), reports })).run();

  return reports;
}

/**
 * POST /api/admin/sync-ical: sincronizzazione manuale dal pannello admin.
 */
export async function handleSyncIcal(request, env) {
  const reports = await syncIcal(env);
  if (reports.length === 0) {
    return Response.json({
      ok: false,
      message: 'Nessun feed configurato. Salva le URL iCal nelle impostazioni (ical_url_oliva / ical_url_venica).',
      reports,
    });
  }
  return Response.json({ ok: true, reports });
}
