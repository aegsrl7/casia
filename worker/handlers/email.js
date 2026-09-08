// Email handler via Resend API
import { loadEmailTexts, fill } from './email-translations.js';

// Orari standard check-in / check-out
const CHECKIN_TIME = '15:00';
const CHECKOUT_TIME = '10:00';

/**
 * Invia email tramite Resend
 */
async function sendEmail(env, { to, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Casia Vacanze <noreply@casiavacanze.com>',
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Resend error:', err);
    throw new Error(`Email send failed: ${res.status}`);
  }

  return res.json();
}

/**
 * Formatta data da YYYY-MM-DD a DD/MM/YYYY
 */
function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Formatta prezzo da centesimi a euro
 */
function formatPrice(cents) {
  return (cents / 100).toFixed(2).replace('.', ',');
}

/**
 * Email di conferma per l'ospite (multilingua)
 */
export async function sendGuestConfirmation(env, reservation) {
  const { guest_name, guest_email, apartment, checkin, checkout, nights, adults, children, total_cents, lang } = reservation;

  const t = await loadEmailTexts(env, 'conf', lang || 'it');
  const apartmentName = apartment === 'oliva' ? 'Appartamento Oliva' : 'Appartamento Venica';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Georgia, serif; color: #2D2926; margin: 0; padding: 0; background: #F8F5F0; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; }
    .header { background: #2D2926; padding: 32px; text-align: center; }
    .header h1 { color: #B8956B; font-size: 24px; margin: 0; font-weight: 400; letter-spacing: 2px; }
    .body { padding: 32px; }
    .body h2 { color: #2D2926; font-size: 20px; margin-top: 0; }
    .detail { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0ece6; }
    .detail-label { color: #5a5652; }
    .detail-value { font-weight: 600; }
    .total { background: #F8F5F0; padding: 16px; margin-top: 16px; text-align: center; }
    .total .amount { font-size: 28px; color: #B8956B; font-weight: 600; }
    .footer { padding: 24px 32px; text-align: center; color: #5a5652; font-size: 14px; border-top: 1px solid #f0ece6; }
    .footer a { color: #B8956B; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>CASIA VACANZE</h1>
    </div>
    <div class="body">
      <h2>${t.title}</h2>
      <p>${fill(t.greeting, { name: guest_name })}</p>
      <p>${t.intro}</p>

      <div class="detail">
        <span class="detail-label">${t.apartment}</span>
        <span class="detail-value">${apartmentName}</span>
      </div>
      <div class="detail">
        <span class="detail-label">${t.checkin}</span>
        <span class="detail-value">${formatDate(checkin)} · ${t.checkin_time || ('dalle ' + CHECKIN_TIME)}</span>
      </div>
      <div class="detail">
        <span class="detail-label">${t.checkout}</span>
        <span class="detail-value">${formatDate(checkout)} · ${t.checkout_time || ('entro le ' + CHECKOUT_TIME)}</span>
      </div>
      <div class="detail">
        <span class="detail-label">${t.nights}</span>
        <span class="detail-value">${nights}</span>
      </div>
      <div class="detail">
        <span class="detail-label">${t.guests}</span>
        <span class="detail-value">${fill(t.adults, { n: adults })}${children > 0 ? ' ' + fill(t.children, { n: children }) : ''}</span>
      </div>

      <div class="total">
        <div>${t.total_label}</div>
        <div class="amount">${formatPrice(total_cents)} &euro;</div>
      </div>

      <p style="margin-top: 24px;">
        <strong>${t.address_label}</strong><br>
        ${t.address}
      </p>
      <p>${t.directions_note}</p>
    </div>
    <div class="footer">
      <p>
        <a href="mailto:info@casiavacanze.com">info@casiavacanze.com</a> |
        <a href="tel:+393514321088">+39 351 432 1088</a>
      </p>
      <p>&copy; Casia Vacanze</p>
    </div>
  </div>
</body>
</html>`;

  return sendEmail(env, {
    to: guest_email,
    subject: fill(t.subject, { apt: apartmentName, checkin: formatDate(checkin), checkout: formatDate(checkout) }),
    html,
  });
}

/**
 * Email di notifica per l'host (resta in italiano)
 */
export async function sendHostNotification(env, reservation) {
  const { id, guest_name, guest_email, guest_phone, apartment, checkin, checkout, nights, adults, children, total_cents, message, source_page, lang } = reservation;

  const apartmentName = apartment === 'oliva' ? 'Appartamento Oliva' : 'Appartamento Venica';
  const siteUrl = env.SITE_URL || 'https://casiavacanze.com';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, sans-serif; color: #2D2926; margin: 0; padding: 0; background: #F8F5F0; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; }
    .header { background: #B8956B; padding: 20px 32px; }
    .header h1 { color: #fff; font-size: 18px; margin: 0; }
    .body { padding: 24px 32px; }
    .detail { padding: 6px 0; }
    .label { color: #5a5652; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; }
    .value { font-size: 16px; font-weight: 600; }
    .message-box { background: #F8F5F0; padding: 16px; margin: 16px 0; border-left: 3px solid #B8956B; }
    .btn { display: inline-block; background: #2D2926; color: #fff; padding: 12px 24px; text-decoration: none; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Nuova Prenotazione #${id}</h1>
    </div>
    <div class="body">
      <div class="detail">
        <div class="label">Ospite</div>
        <div class="value">${guest_name}</div>
      </div>
      <div class="detail">
        <div class="label">Email</div>
        <div class="value"><a href="mailto:${guest_email}">${guest_email}</a></div>
      </div>
      ${guest_phone ? `<div class="detail"><div class="label">Telefono</div><div class="value"><a href="tel:${guest_phone}">${guest_phone}</a></div></div>` : ''}
      <hr style="border: none; border-top: 1px solid #f0ece6; margin: 16px 0;">
      <div class="detail">
        <div class="label">Appartamento</div>
        <div class="value">${apartmentName}</div>
      </div>
      <div class="detail">
        <div class="label">Date</div>
        <div class="value">${formatDate(checkin)} (${CHECKIN_TIME}) → ${formatDate(checkout)} (${CHECKOUT_TIME}) · ${nights} notti</div>
      </div>
      <div class="detail">
        <div class="label">Ospiti</div>
        <div class="value">${adults} adulti${children > 0 ? ` + ${children} bambini` : ''}</div>
      </div>
      <div class="detail">
        <div class="label">Totale</div>
        <div class="value" style="color: #B8956B; font-size: 20px;">${formatPrice(total_cents)} &euro;</div>
      </div>
      <div class="detail">
        <div class="label">Lingua ospite</div>
        <div class="value">${(lang || 'it').toUpperCase()}</div>
      </div>
      ${message ? `<div class="message-box"><div class="label">Messaggio dell'ospite</div><p style="margin: 8px 0 0;">${message}</p></div>` : ''}
      <div class="detail">
        <div class="label">Pagina di origine</div>
        <div class="value">${source_page || 'index'}.html</div>
      </div>
      <a href="${siteUrl}/admin.html" class="btn">Apri Dashboard Admin</a>
    </div>
  </div>
</body>
</html>`;

  return sendEmail(env, {
    to: env.HOST_EMAIL,
    subject: `Nuova prenotazione: ${guest_name} - ${formatDate(checkin)}/${formatDate(checkout)}`,
    html,
  });
}

/**
 * Email pre-check-in con link al form (multilingua)
 */
export async function sendCheckinEmail(env, reservation) {
  const { guest_name, guest_email, checkin, checkout, checkin_token, lang } = reservation;
  const t = await loadEmailTexts(env, 'checkin', lang || 'it');
  const siteUrl = env.SITE_URL || 'https://casiavacanze.com';
  const checkinUrl = `${siteUrl}/checkin.html?token=${checkin_token}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Georgia, serif; color: #2D2926; margin: 0; padding: 0; background: #F8F5F0; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; }
    .header { background: #2D2926; padding: 32px; text-align: center; }
    .header h1 { color: #B8956B; font-size: 24px; margin: 0; font-weight: 400; letter-spacing: 2px; }
    .body { padding: 32px; }
    .body h2 { color: #2D2926; font-size: 20px; margin-top: 0; }
    .btn { display: inline-block; background: #B8956B; color: #fff; padding: 14px 32px; text-decoration: none; font-size: 16px; border-radius: 4px; margin: 16px 0; }
    .footer { padding: 24px 32px; text-align: center; color: #5a5652; font-size: 14px; border-top: 1px solid #f0ece6; }
    .footer a { color: #B8956B; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>CASIA VACANZE</h1>
    </div>
    <div class="body">
      <h2>${t.title}</h2>
      <p>${fill(t.greeting, { name: guest_name })}</p>
      <p>${t.intro}</p>
      <p>${fill(t.details, { checkin: formatDate(checkin), checkout: formatDate(checkout) })}</p>
      <p style="text-align:center;">
        <a href="${checkinUrl}" class="btn">${t.cta}</a>
      </p>
      <p>${t.steps}</p>
      <p style="font-size:14px;color:#5a5652;">${t.note}</p>
    </div>
    <div class="footer">
      <p>
        <a href="mailto:info@casiavacanze.com">info@casiavacanze.com</a> |
        <a href="tel:+393514321088">+39 351 432 1088</a>
      </p>
      <p>&copy; Casia Vacanze</p>
    </div>
  </div>
</body>
</html>`;

  return sendEmail(env, {
    to: guest_email,
    subject: t.subject,
    html,
  });
}

/**
 * Email con istruzioni di accesso (multilingua)
 */
export async function sendAccessEmail(env, reservation, instructions) {
  const { guest_name, guest_email, checkin, checkout, lang } = reservation;
  const t = await loadEmailTexts(env, 'access', lang || 'it');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Georgia, serif; color: #2D2926; margin: 0; padding: 0; background: #F8F5F0; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; }
    .header { background: #2D2926; padding: 32px; text-align: center; }
    .header h1 { color: #B8956B; font-size: 24px; margin: 0; font-weight: 400; letter-spacing: 2px; }
    .body { padding: 32px; }
    .body h2 { color: #2D2926; font-size: 20px; margin-top: 0; }
    .instructions { background: #F8F5F0; padding: 20px; border-left: 3px solid #B8956B; margin: 16px 0; white-space: pre-wrap; line-height: 1.7; }
    .footer { padding: 24px 32px; text-align: center; color: #5a5652; font-size: 14px; border-top: 1px solid #f0ece6; }
    .footer a { color: #B8956B; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>CASIA VACANZE</h1>
    </div>
    <div class="body">
      <h2>${t.title}</h2>
      <p>${fill(t.greeting, { name: guest_name })}</p>
      <p>${fill(t.intro, { checkin: formatDate(checkin), checkout: formatDate(checkout) })}</p>
      <div class="instructions">${instructions.replace(/\n/g, '<br>')}</div>
      <p>${t.contact}</p>
    </div>
    <div class="footer">
      <p>
        <a href="mailto:info@casiavacanze.com">info@casiavacanze.com</a> |
        <a href="tel:+393514321088">+39 351 432 1088</a>
      </p>
      <p>&copy; Casia Vacanze</p>
    </div>
  </div>
</body>
</html>`;

  return sendEmail(env, {
    to: guest_email,
    subject: fill(t.subject, { checkin: formatDate(checkin) }),
    html,
  });
}

/**
 * Email per pagamento tassa di soggiorno (multilingua)
 */
export async function sendTouristTaxEmail(env, reservation, paymentUrl, amountCents, taxablePersons, taxableNights) {
  const { guest_name, guest_email, checkin, checkout, lang } = reservation;
  const t = await loadEmailTexts(env, 'tax', lang || 'it');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Georgia, serif; color: #2D2926; margin: 0; padding: 0; background: #F8F5F0; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; }
    .header { background: #2D2926; padding: 32px; text-align: center; }
    .header h1 { color: #B8956B; font-size: 24px; margin: 0; font-weight: 400; letter-spacing: 2px; }
    .body { padding: 32px; }
    .body h2 { color: #2D2926; font-size: 20px; margin-top: 0; }
    .detail { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0ece6; }
    .detail-label { color: #5a5652; }
    .detail-value { font-weight: 600; }
    .total { background: #F8F5F0; padding: 16px; margin-top: 16px; text-align: center; }
    .total .amount { font-size: 28px; color: #B8956B; font-weight: 600; }
    .btn { display: inline-block; background: #B8956B; color: #fff; padding: 14px 32px; text-decoration: none; font-size: 16px; border-radius: 4px; margin: 16px 0; }
    .footer { padding: 24px 32px; text-align: center; color: #5a5652; font-size: 14px; border-top: 1px solid #f0ece6; }
    .footer a { color: #B8956B; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>CASIA VACANZE</h1>
    </div>
    <div class="body">
      <h2>${t.title}</h2>
      <p>${fill(t.greeting, { name: guest_name })}</p>
      <p>${t.intro}</p>
      <div class="detail">
        <span class="detail-label">${t.period}</span>
        <span class="detail-value">${formatDate(checkin)} · ${formatDate(checkout)}</span>
      </div>
      <div class="detail">
        <span class="detail-label">${t.persons}</span>
        <span class="detail-value">${taxablePersons}</span>
      </div>
      <div class="detail">
        <span class="detail-label">${t.nights_label}</span>
        <span class="detail-value">${taxableNights}</span>
      </div>
      <div class="total">
        <div>${t.total_label}</div>
        <div class="amount">${formatPrice(amountCents)} &euro;</div>
      </div>
      <p style="text-align:center;">
        <a href="${paymentUrl}" class="btn">${t.cta}</a>
      </p>
      <p style="font-size:14px;color:#5a5652;">${t.note}</p>
    </div>
    <div class="footer">
      <p>
        <a href="mailto:info@casiavacanze.com">info@casiavacanze.com</a> |
        <a href="tel:+393514321088">+39 351 432 1088</a>
      </p>
      <p>&copy; Casia Vacanze</p>
    </div>
  </div>
</body>
</html>`;

  return sendEmail(env, {
    to: guest_email,
    subject: t.subject,
    html,
  });
}

/**
 * Email per campagna marketing (template brand CASIA)
 */
export function buildMarketingEmail(subject, bodyHtml) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Georgia, serif; color: #2D2926; margin: 0; padding: 0; background: #F8F5F0; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; }
    .header { background: #2D2926; padding: 32px; text-align: center; }
    .header h1 { color: #B8956B; font-size: 24px; margin: 0; font-weight: 400; letter-spacing: 2px; }
    .body { padding: 32px; line-height: 1.7; }
    .footer { padding: 24px 32px; text-align: center; color: #5a5652; font-size: 13px; border-top: 1px solid #f0ece6; }
    .footer a { color: #B8956B; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>CASIA VACANZE</h1>
    </div>
    <div class="body">
      ${bodyHtml}
    </div>
    <div class="footer">
      <p>
        <a href="mailto:info@casiavacanze.com">info@casiavacanze.com</a> |
        <a href="tel:+393514321088">+39 351 432 1088</a>
      </p>
      <p>&copy; Casia Vacanze</p>
      <p style="font-size:11px;margin-top:12px;">Ricevi questa email perché hai acconsentito alle comunicazioni commerciali.<br>Per disiscriverti, rispondi a questa email.</p>
    </div>
  </div>
</body>
</html>`;
}
