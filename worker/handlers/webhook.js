// Handler per Stripe Webhook

import { sendGuestConfirmation, sendHostNotification, sendCheckinEmail } from './email.js';

/**
 * Verifica la firma del webhook Stripe usando Web Crypto API
 */
async function verifyStripeSignature(payload, sigHeader, secret) {
  const parts = sigHeader.split(',').reduce((acc, part) => {
    const [key, value] = part.split('=');
    acc[key] = value;
    return acc;
  }, {});

  const timestamp = parts['t'];
  const signature = parts['v1'];

  if (!timestamp || !signature) {
    throw new Error('Firma webhook mancante');
  }

  // Verifica che il timestamp non sia troppo vecchio (5 minuti)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    throw new Error('Timestamp webhook troppo vecchio');
  }

  // Calcola firma attesa
  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
  const expectedSig = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('');

  // Confronto costante per evitare timing attack
  if (expectedSig.length !== signature.length) {
    throw new Error('Firma webhook non valida');
  }
  let mismatch = 0;
  for (let i = 0; i < expectedSig.length; i++) {
    mismatch |= expectedSig.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  if (mismatch !== 0) {
    throw new Error('Firma webhook non valida');
  }

  return JSON.parse(payload);
}

/**
 * POST /api/webhook
 * Gestisce gli eventi Stripe
 */
export async function handleWebhook(request, env) {
  const sigHeader = request.headers.get('stripe-signature');
  if (!sigHeader) {
    return new Response('Firma mancante', { status: 400 });
  }

  const payload = await request.text();
  let event;

  try {
    event = await verifyStripeSignature(payload, sigHeader, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook verification failed:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // Gestisci checkout.session.completed
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const metadataType = session.metadata?.type;

    // Pagamento tassa di soggiorno
    if (metadataType === 'tourist_tax') {
      const taxId = session.metadata?.tax_payment_id;
      if (taxId) {
        await env.DB.prepare(`
          UPDATE tourist_tax_payments
          SET status = 'paid', stripe_payment_id = ?, paid_at = datetime('now')
          WHERE id = ? AND status = 'pending'
        `).bind(session.payment_intent || session.id, parseInt(taxId)).run();
      }
      return new Response('OK', { status: 200 });
    }

    // Pagamento prenotazione (default)
    const reservationId = session.metadata?.reservation_id;

    if (!reservationId) {
      console.error('Webhook: reservation_id mancante nei metadata');
      return new Response('OK', { status: 200 });
    }

    // Aggiorna prenotazione a confirmed
    await env.DB.prepare(`
      UPDATE reservations
      SET status = 'confirmed',
          stripe_payment_id = ?,
          stripe_session_id = ?
      WHERE id = ? AND status = 'pending'
    `).bind(
      session.payment_intent || session.id,
      session.id,
      parseInt(reservationId)
    ).run();

    // Recupera la prenotazione aggiornata
    const reservation = await env.DB.prepare(
      'SELECT * FROM reservations WHERE id = ?'
    ).bind(parseInt(reservationId)).first();

    if (reservation && reservation.status === 'confirmed') {
      // Invia email in parallelo (non bloccare la risposta al webhook)
      try {
        await Promise.all([
          sendGuestConfirmation(env, reservation),
          sendHostNotification(env, reservation),
        ]);
      } catch (emailErr) {
        console.error('Errore invio email:', emailErr.message);
      }

      // Invia email pre-check-in (separata, non blocca il webhook)
      if (reservation.checkin_token) {
        try {
          await sendCheckinEmail(env, reservation);
        } catch (err) {
          console.error('Errore invio email check-in:', err.message);
        }
      }
    }
  }

  // Gestisci cancellazioni/refund
  if (event.type === 'charge.refunded') {
    const charge = event.data.object;
    const paymentIntent = charge.payment_intent;

    if (paymentIntent) {
      await env.DB.prepare(`
        UPDATE reservations SET status = 'refunded'
        WHERE stripe_payment_id = ?
      `).bind(paymentIntent).run();
    }
  }

  return new Response('OK', { status: 200 });
}
