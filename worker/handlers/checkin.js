// Handler per pre-check-in online e gestione admin check-in

/**
 * GET /api/checkin/:token
 * Restituisce dati prenotazione per il form di check-in (pubblico, auth via token)
 */
export async function handleGetCheckin(token, env) {
  if (!token || token.length < 10) {
    return Response.json({ error: 'Token non valido' }, { status: 400 });
  }

  const reservation = await env.DB.prepare(`
    SELECT id, apartment, checkin, checkout, nights, adults, children,
           guest_name, guest_email, checkin_status
    FROM reservations
    WHERE checkin_token = ? AND status = 'confirmed'
  `).bind(token).first();

  if (!reservation) {
    return Response.json({ error: 'Prenotazione non trovata o non confermata' }, { status: 404 });
  }

  // Carica travelers esistenti
  const travelers = await env.DB.prepare(
    'SELECT * FROM travelers WHERE reservation_id = ? ORDER BY is_primary DESC, id ASC'
  ).bind(reservation.id).all();

  return Response.json({
    reservation: {
      id: reservation.id,
      apartment: reservation.apartment,
      apartment_name: reservation.apartment === 'oliva' ? 'Appartamento Oliva' : 'Appartamento Venica',
      checkin: reservation.checkin,
      checkout: reservation.checkout,
      nights: reservation.nights,
      adults: reservation.adults,
      children: reservation.children,
      guest_name: reservation.guest_name,
      guest_email: reservation.guest_email,
      checkin_status: reservation.checkin_status,
    },
    travelers: travelers.results,
  });
}

/**
 * POST /api/checkin/:token/travelers
 * Salva dati dei viaggiatori
 */
export async function handleSaveTravelers(token, request, env) {
  const reservation = await env.DB.prepare(
    'SELECT id, adults, children FROM reservations WHERE checkin_token = ? AND status = \'confirmed\''
  ).bind(token).first();

  if (!reservation) {
    return Response.json({ error: 'Prenotazione non trovata' }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Body JSON non valido' }, { status: 400 });
  }

  const { travelers } = body;
  if (!travelers || !Array.isArray(travelers) || travelers.length === 0) {
    return Response.json({ error: 'Array travelers richiesto' }, { status: 400 });
  }

  const expectedCount = reservation.adults + reservation.children;
  if (travelers.length !== expectedCount) {
    return Response.json({ error: `Sono richiesti ${expectedCount} viaggiatori` }, { status: 400 });
  }

  // Elimina travelers precedenti
  await env.DB.prepare('DELETE FROM travelers WHERE reservation_id = ?').bind(reservation.id).run();

  // Inserisci nuovi travelers
  for (let i = 0; i < travelers.length; i++) {
    const t = travelers[i];
    if (!t.first_name || !t.last_name) {
      return Response.json({ error: `Nome e cognome obbligatori per il viaggiatore ${i + 1}` }, { status: 400 });
    }

    await env.DB.prepare(`
      INSERT INTO travelers (reservation_id, is_primary, first_name, last_name, birth_date, birth_place, birth_province, birth_country, citizenship, gender, doc_type, doc_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      reservation.id,
      i === 0 ? 1 : 0,
      t.first_name.trim(),
      t.last_name.trim(),
      t.birth_date || null,
      t.birth_place || null,
      t.birth_province || null,
      t.birth_country || 'IT',
      t.citizenship || 'IT',
      t.gender || null,
      t.doc_type || null,
      t.doc_number || null,
    ).run();
  }

  // Aggiorna stato check-in
  await env.DB.prepare(
    "UPDATE reservations SET checkin_status = 'submitted' WHERE id = ?"
  ).bind(reservation.id).run();

  return Response.json({ success: true, travelers_count: travelers.length });
}

/**
 * POST /api/checkin/:token/upload
 * Upload foto documento su R2 (multipart/form-data)
 */
export async function handleDocUpload(token, request, env) {
  const reservation = await env.DB.prepare(
    'SELECT id FROM reservations WHERE checkin_token = ? AND status = \'confirmed\''
  ).bind(token).first();

  if (!reservation) {
    return Response.json({ error: 'Prenotazione non trovata' }, { status: 404 });
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: 'Form data non valido' }, { status: 400 });
  }

  const file = formData.get('file');
  const travelerId = formData.get('traveler_id');
  const side = formData.get('side'); // 'front' o 'back'

  if (!file || !travelerId || !side) {
    return Response.json({ error: 'File, traveler_id e side richiesti' }, { status: 400 });
  }

  if (!['front', 'back'].includes(side)) {
    return Response.json({ error: 'side deve essere front o back' }, { status: 400 });
  }

  // Verifica che il traveler appartenga a questa prenotazione
  const traveler = await env.DB.prepare(
    'SELECT id FROM travelers WHERE id = ? AND reservation_id = ?'
  ).bind(parseInt(travelerId), reservation.id).first();

  if (!traveler) {
    return Response.json({ error: 'Viaggiatore non trovato' }, { status: 404 });
  }

  // Verifica tipo file
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!allowedTypes.includes(file.type)) {
    return Response.json({ error: 'Formato file non supportato. Usa JPG, PNG, WebP o PDF.' }, { status: 400 });
  }

  // Max 10MB
  if (file.size > 10 * 1024 * 1024) {
    return Response.json({ error: 'File troppo grande (max 10MB)' }, { status: 400 });
  }

  // Genera chiave R2
  const ext = file.name.split('.').pop() || 'jpg';
  const key = `checkin/${reservation.id}/${travelerId}_${side}.${ext}`;

  // Upload su R2
  await env.DOCS_BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  // Aggiorna traveler con la chiave del documento
  const column = side === 'front' ? 'doc_front_key' : 'doc_back_key';
  await env.DB.prepare(
    `UPDATE travelers SET ${column} = ? WHERE id = ?`
  ).bind(key, parseInt(travelerId)).run();

  return Response.json({ success: true, key });
}

// ===== ADMIN ENDPOINTS =====

/**
 * GET /api/admin/checkin/:id
 * Dettaglio check-in con dati travelers e URL foto documenti
 */
export async function handleAdminGetCheckin(reservationId, env) {
  const reservation = await env.DB.prepare(
    'SELECT * FROM reservations WHERE id = ?'
  ).bind(parseInt(reservationId)).first();

  if (!reservation) {
    return Response.json({ error: 'Prenotazione non trovata' }, { status: 404 });
  }

  const travelers = await env.DB.prepare(
    'SELECT * FROM travelers WHERE reservation_id = ? ORDER BY is_primary DESC, id ASC'
  ).bind(parseInt(reservationId)).all();

  // Genera URL presigned per le foto documenti
  const travelersWithUrls = await Promise.all(travelers.results.map(async (t) => {
    const result = { ...t };
    if (t.doc_front_key) {
      const obj = await env.DOCS_BUCKET.get(t.doc_front_key);
      if (obj) {
        const buf = await obj.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
        result.doc_front_data = `data:${obj.httpMetadata?.contentType || 'image/jpeg'};base64,${base64}`;
      }
    }
    if (t.doc_back_key) {
      const obj = await env.DOCS_BUCKET.get(t.doc_back_key);
      if (obj) {
        const buf = await obj.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
        result.doc_back_data = `data:${obj.httpMetadata?.contentType || 'image/jpeg'};base64,${base64}`;
      }
    }
    return result;
  }));

  return Response.json({
    reservation,
    travelers: travelersWithUrls,
  });
}

/**
 * POST /api/admin/verify/:id
 * Segna prenotazione come "verificata" per identità
 */
export async function handleAdminVerify(reservationId, env) {
  const result = await env.DB.prepare(
    "UPDATE reservations SET checkin_status = 'verified' WHERE id = ? AND checkin_status = 'submitted'"
  ).bind(parseInt(reservationId)).run();

  if (result.meta.changes === 0) {
    return Response.json({ error: 'Prenotazione non trovata o stato non valido' }, { status: 400 });
  }

  return Response.json({ success: true });
}

/**
 * POST /api/admin/send-access/:id
 * Invia istruzioni di accesso via email
 */
export async function handleAdminSendAccess(reservationId, request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Body JSON non valido' }, { status: 400 });
  }

  const { instructions } = body;
  if (!instructions) {
    return Response.json({ error: 'Istruzioni richieste' }, { status: 400 });
  }

  const reservation = await env.DB.prepare(
    'SELECT * FROM reservations WHERE id = ?'
  ).bind(parseInt(reservationId)).first();

  if (!reservation) {
    return Response.json({ error: 'Prenotazione non trovata' }, { status: 404 });
  }

  // Salva istruzioni nel DB
  await env.DB.prepare(
    'UPDATE reservations SET access_instructions = ? WHERE id = ?'
  ).bind(instructions, parseInt(reservationId)).run();

  // Invia email con istruzioni
  const { sendAccessEmail } = await import('./email.js');
  await sendAccessEmail(env, reservation, instructions);

  return Response.json({ success: true });
}

/**
 * GET /api/admin/alloggiati/:id
 * Export TXT formato Alloggiati Web (Schedina Polizia)
 */
export async function handleAlloggiatiExport(reservationId, env) {
  const reservation = await env.DB.prepare(
    'SELECT * FROM reservations WHERE id = ?'
  ).bind(parseInt(reservationId)).first();

  if (!reservation) {
    return Response.json({ error: 'Prenotazione non trovata' }, { status: 404 });
  }

  const travelers = await env.DB.prepare(
    'SELECT * FROM travelers WHERE reservation_id = ? ORDER BY is_primary DESC, id ASC'
  ).bind(parseInt(reservationId)).all();

  if (travelers.results.length === 0) {
    return Response.json({ error: 'Nessun viaggiatore registrato per questa prenotazione' }, { status: 400 });
  }

  const { generateAlloggiatiTxt } = await import('../data/alloggiati-codes.js');
  const txt = generateAlloggiatiTxt(reservation, travelers.results);

  return new Response(txt, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="alloggiati_${reservationId}.txt"`,
    },
  });
}
