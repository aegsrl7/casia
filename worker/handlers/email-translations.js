// Email translations for guest confirmation emails (4 languages)

const emailTexts = {
  it: {
    subject: (aptName, checkin, checkout) => `Prenotazione Confermata - ${aptName} - ${checkin}/${checkout}`,
    title: 'Prenotazione Confermata',
    greeting: (name) => `Gentile ${name},`,
    intro: 'La tua prenotazione è stata confermata. Ecco il riepilogo:',
    apartment: 'Appartamento',
    checkin: 'Check-in',
    checkout: 'Check-out',
    checkin_time: 'dalle 15:00',
    checkout_time: 'entro le 10:00',
    nights: 'Notti',
    guests: 'Ospiti',
    adults: (n) => `${n} adulti`,
    children: (n) => n > 0 ? ` + ${n} bambini` : '',
    total_label: 'Totale pagato',
    address_label: 'Indirizzo:',
    address: 'Santo Stefano, Bene Vagienna (CN)<br>Piemonte, Italia',
    directions_note: 'Le invieremo le indicazioni stradali dettagliate qualche giorno prima del suo arrivo. Per qualsiasi domanda, non esiti a contattarci.',
  },
  en: {
    subject: (aptName, checkin, checkout) => `Booking Confirmed - ${aptName} - ${checkin}/${checkout}`,
    title: 'Booking Confirmed',
    greeting: (name) => `Dear ${name},`,
    intro: 'Your booking has been confirmed. Here is a summary:',
    apartment: 'Apartment',
    checkin: 'Check-in',
    checkout: 'Check-out',
    checkin_time: 'from 3:00 PM',
    checkout_time: 'by 10:00 AM',
    nights: 'Nights',
    guests: 'Guests',
    adults: (n) => `${n} adults`,
    children: (n) => n > 0 ? ` + ${n} children` : '',
    total_label: 'Total paid',
    address_label: 'Address:',
    address: 'Santo Stefano, Bene Vagienna (CN)<br>Piedmont, Italy',
    directions_note: 'We will send you detailed directions a few days before your arrival. For any questions, please do not hesitate to contact us.',
  },
  fr: {
    subject: (aptName, checkin, checkout) => `Réservation Confirmée - ${aptName} - ${checkin}/${checkout}`,
    title: 'Réservation Confirmée',
    greeting: (name) => `Cher/Chère ${name},`,
    intro: 'Votre réservation a été confirmée. Voici le récapitulatif :',
    apartment: 'Appartement',
    checkin: 'Arrivée',
    checkout: 'Départ',
    checkin_time: 'à partir de 15h00',
    checkout_time: 'avant 10h00',
    nights: 'Nuits',
    guests: 'Voyageurs',
    adults: (n) => `${n} adultes`,
    children: (n) => n > 0 ? ` + ${n} enfants` : '',
    total_label: 'Total payé',
    address_label: 'Adresse :',
    address: 'Santo Stefano, Bene Vagienna (CN)<br>Piémont, Italie',
    directions_note: 'Nous vous enverrons les indications détaillées quelques jours avant votre arrivée. Pour toute question, n\'hésitez pas à nous contacter.',
  },
  de: {
    subject: (aptName, checkin, checkout) => `Buchungsbestätigung - ${aptName} - ${checkin}/${checkout}`,
    title: 'Buchungsbestätigung',
    greeting: (name) => `Liebe/r ${name},`,
    intro: 'Ihre Buchung wurde bestätigt. Hier ist die Zusammenfassung:',
    apartment: 'Apartment',
    checkin: 'Anreise',
    checkout: 'Abreise',
    checkin_time: 'ab 15:00 Uhr',
    checkout_time: 'bis 10:00 Uhr',
    nights: 'Nächte',
    guests: 'Gäste',
    adults: (n) => `${n} Erwachsene`,
    children: (n) => n > 0 ? ` + ${n} Kinder` : '',
    total_label: 'Gesamtbetrag',
    address_label: 'Adresse:',
    address: 'Santo Stefano, Bene Vagienna (CN)<br>Piemont, Italien',
    directions_note: 'Wir senden Ihnen einige Tage vor Ihrer Ankunft eine detaillierte Wegbeschreibung. Bei Fragen stehen wir Ihnen gerne zur Verfügung.',
  },
};

export function getEmailTexts(lang) {
  return emailTexts[lang] || emailTexts.it;
}

// ===== Email Pre-Check-in =====
const checkinEmailTexts = {
  it: {
    subject: 'CASIA · Completa il check-in online',
    title: 'Check-in Online',
    greeting: (name) => `Gentile ${name},`,
    intro: 'Per rendere il suo arrivo più rapido e piacevole, la invitiamo a completare il check-in online compilando i dati di tutti i viaggiatori.',
    details: (checkin, checkout) => `Il suo soggiorno: <strong>${checkin} → ${checkout}</strong>`,
    cta: 'Compila il check-in',
    steps: 'Dovrà inserire i dati anagrafici e un documento d\'identità per ogni viaggiatore. Dopo la verifica, riceverà le istruzioni per accedere all\'appartamento.',
    note: 'Se ha domande, non esiti a contattarci. Il link è personale: non lo condivida con altri.',
  },
  en: {
    subject: 'CASIA · Complete your online check-in',
    title: 'Online Check-in',
    greeting: (name) => `Dear ${name},`,
    intro: 'To make your arrival smoother and more pleasant, we invite you to complete the online check-in by filling in the details of all travelers.',
    details: (checkin, checkout) => `Your stay: <strong>${checkin} → ${checkout}</strong>`,
    cta: 'Complete check-in',
    steps: 'You will need to provide personal details and an ID document for each traveler. After verification, you will receive instructions to access the apartment.',
    note: 'If you have any questions, please don\'t hesitate to contact us. This link is personal: please do not share it.',
  },
  fr: {
    subject: 'CASIA · Complétez votre check-in en ligne',
    title: 'Check-in en ligne',
    greeting: (name) => `Cher/Chère ${name},`,
    intro: 'Pour rendre votre arrivée plus rapide et agréable, nous vous invitons à compléter le check-in en ligne en remplissant les informations de tous les voyageurs.',
    details: (checkin, checkout) => `Votre séjour : <strong>${checkin} → ${checkout}</strong>`,
    cta: 'Compléter le check-in',
    steps: 'Vous devrez fournir les données personnelles et un document d\'identité pour chaque voyageur. Après vérification, vous recevrez les instructions d\'accès à l\'appartement.',
    note: 'Pour toute question, n\'hésitez pas à nous contacter. Ce lien est personnel : ne le partagez pas.',
  },
  de: {
    subject: 'CASIA · Online-Check-in abschließen',
    title: 'Online-Check-in',
    greeting: (name) => `Liebe/r ${name},`,
    intro: 'Um Ihre Ankunft angenehmer zu gestalten, laden wir Sie ein, den Online-Check-in auszufüllen und die Daten aller Reisenden anzugeben.',
    details: (checkin, checkout) => `Ihr Aufenthalt: <strong>${checkin} → ${checkout}</strong>`,
    cta: 'Check-in ausfüllen',
    steps: 'Sie müssen für jeden Reisenden persönliche Daten und ein Ausweisdokument angeben. Nach der Überprüfung erhalten Sie die Zugangsinformationen zur Wohnung.',
    note: 'Bei Fragen stehen wir Ihnen gerne zur Verfügung. Dieser Link ist persönlich: bitte teilen Sie ihn nicht.',
  },
};

export function getCheckinEmailTexts(lang) {
  return checkinEmailTexts[lang] || checkinEmailTexts.it;
}

// ===== Email Istruzioni Accesso =====
const accessEmailTexts = {
  it: {
    subject: (checkin) => `CASIA · Istruzioni di accesso per il ${checkin}`,
    title: 'Istruzioni di Accesso',
    greeting: (name) => `Gentile ${name},`,
    intro: (checkin, checkout) => `Ecco le istruzioni per accedere all'appartamento per il suo soggiorno dal <strong>${checkin}</strong> al <strong>${checkout}</strong>:`,
    contact: 'Per qualsiasi necessità, non esiti a contattarci. Buon soggiorno!',
  },
  en: {
    subject: (checkin) => `CASIA · Access instructions for ${checkin}`,
    title: 'Access Instructions',
    greeting: (name) => `Dear ${name},`,
    intro: (checkin, checkout) => `Here are the instructions to access the apartment for your stay from <strong>${checkin}</strong> to <strong>${checkout}</strong>:`,
    contact: 'For any needs, please don\'t hesitate to contact us. Enjoy your stay!',
  },
  fr: {
    subject: (checkin) => `CASIA · Instructions d'accès pour le ${checkin}`,
    title: 'Instructions d\'Accès',
    greeting: (name) => `Cher/Chère ${name},`,
    intro: (checkin, checkout) => `Voici les instructions pour accéder à l'appartement pour votre séjour du <strong>${checkin}</strong> au <strong>${checkout}</strong> :`,
    contact: 'Pour tout besoin, n\'hésitez pas à nous contacter. Bon séjour !',
  },
  de: {
    subject: (checkin) => `CASIA · Zugangsinformationen für den ${checkin}`,
    title: 'Zugangsinformationen',
    greeting: (name) => `Liebe/r ${name},`,
    intro: (checkin, checkout) => `Hier sind die Zugangsinformationen zur Wohnung für Ihren Aufenthalt vom <strong>${checkin}</strong> bis <strong>${checkout}</strong>:`,
    contact: 'Bei Fragen stehen wir Ihnen gerne zur Verfügung. Schönen Aufenthalt!',
  },
};

export function getAccessEmailTexts(lang) {
  return accessEmailTexts[lang] || accessEmailTexts.it;
}

// ===== Email Tassa di Soggiorno =====
const taxEmailTexts = {
  it: {
    subject: 'CASIA · Pagamento tassa di soggiorno',
    title: 'Tassa di Soggiorno',
    greeting: (name) => `Gentile ${name},`,
    intro: 'Come previsto dalla normativa comunale, è richiesto il pagamento della tassa di soggiorno per il suo pernottamento.',
    period: 'Periodo',
    persons: 'Persone soggette',
    nights_label: 'Notti tassabili',
    total_label: 'Importo dovuto',
    cta: 'Paga la tassa di soggiorno',
    note: 'Il pagamento è sicuro e gestito da Stripe. L\'importo è stabilito dal Comune.',
  },
  en: {
    subject: 'CASIA · Tourist tax payment',
    title: 'Tourist Tax',
    greeting: (name) => `Dear ${name},`,
    intro: 'As required by local regulations, a tourist tax payment is required for your stay.',
    period: 'Period',
    persons: 'Taxable persons',
    nights_label: 'Taxable nights',
    total_label: 'Amount due',
    cta: 'Pay tourist tax',
    note: 'Payment is secure and handled by Stripe. The amount is set by the Municipality.',
  },
  fr: {
    subject: 'CASIA · Paiement de la taxe de séjour',
    title: 'Taxe de Séjour',
    greeting: (name) => `Cher/Chère ${name},`,
    intro: 'Conformément à la réglementation municipale, le paiement de la taxe de séjour est requis pour votre séjour.',
    period: 'Période',
    persons: 'Personnes assujetties',
    nights_label: 'Nuits taxables',
    total_label: 'Montant dû',
    cta: 'Payer la taxe de séjour',
    note: 'Le paiement est sécurisé et géré par Stripe. Le montant est fixé par la Commune.',
  },
  de: {
    subject: 'CASIA · Zahlung der Kurtaxe',
    title: 'Kurtaxe',
    greeting: (name) => `Liebe/r ${name},`,
    intro: 'Gemäß den örtlichen Vorschriften ist die Zahlung der Kurtaxe für Ihren Aufenthalt erforderlich.',
    period: 'Zeitraum',
    persons: 'Steuerpflichtige Personen',
    nights_label: 'Steuerpflichtige Nächte',
    total_label: 'Fälliger Betrag',
    cta: 'Kurtaxe bezahlen',
    note: 'Die Zahlung ist sicher und wird von Stripe abgewickelt. Der Betrag wird von der Gemeinde festgelegt.',
  },
};

export function getTaxEmailTexts(lang) {
  return taxEmailTexts[lang] || taxEmailTexts.it;
}

// ===== Testi email modificabili dal pannello (page = 'email' nella tabella translations) =====
// Chiavi con prefisso di gruppo: conf_, checkin_, access_, tax_. I valori con parametri usano
// segnaposto tra graffe ({apt}, {checkin}, {checkout}, {name}, {n}). Questi oggetti sono i
// fallback usati quando manca la riga nel DB (o env.DB non è disponibile).
const emailFallbacks = {
  conf: {
    it: {
      subject: 'Prenotazione Confermata - {apt} - {checkin}/{checkout}',
      title: 'Prenotazione Confermata',
      greeting: 'Gentile {name},',
      intro: 'La tua prenotazione è stata confermata. Ecco il riepilogo:',
      apartment: 'Appartamento',
      checkin: 'Check-in',
      checkout: 'Check-out',
      checkin_time: 'dalle 15:00',
      checkout_time: 'entro le 10:00',
      nights: 'Notti',
      guests: 'Ospiti',
      adults: '{n} adulti',
      children: '+ {n} bambini',
      total_label: 'Totale pagato',
      address_label: 'Indirizzo:',
      address: 'Santo Stefano, Bene Vagienna (CN)<br>Piemonte, Italia',
      directions_note: 'Le invieremo le indicazioni stradali dettagliate qualche giorno prima del suo arrivo. Per qualsiasi domanda, non esiti a contattarci.',
    },
    en: {
      subject: 'Booking Confirmed - {apt} - {checkin}/{checkout}',
      title: 'Booking Confirmed',
      greeting: 'Dear {name},',
      intro: 'Your booking has been confirmed. Here is a summary:',
      apartment: 'Apartment',
      checkin: 'Check-in',
      checkout: 'Check-out',
      checkin_time: 'from 3:00 PM',
      checkout_time: 'by 10:00 AM',
      nights: 'Nights',
      guests: 'Guests',
      adults: '{n} adults',
      children: '+ {n} children',
      total_label: 'Total paid',
      address_label: 'Address:',
      address: 'Santo Stefano, Bene Vagienna (CN)<br>Piedmont, Italy',
      directions_note: 'We will send you detailed directions a few days before your arrival. For any questions, please do not hesitate to contact us.',
    },
    fr: {
      subject: 'Réservation Confirmée - {apt} - {checkin}/{checkout}',
      title: 'Réservation Confirmée',
      greeting: 'Cher/Chère {name},',
      intro: 'Votre réservation a été confirmée. Voici le récapitulatif :',
      apartment: 'Appartement',
      checkin: 'Arrivée',
      checkout: 'Départ',
      checkin_time: 'à partir de 15h00',
      checkout_time: 'avant 10h00',
      nights: 'Nuits',
      guests: 'Voyageurs',
      adults: '{n} adultes',
      children: '+ {n} enfants',
      total_label: 'Total payé',
      address_label: 'Adresse :',
      address: 'Santo Stefano, Bene Vagienna (CN)<br>Piémont, Italie',
      directions_note: 'Nous vous enverrons les indications détaillées quelques jours avant votre arrivée. Pour toute question, n\'hésitez pas à nous contacter.',
    },
    de: {
      subject: 'Buchungsbestätigung - {apt} - {checkin}/{checkout}',
      title: 'Buchungsbestätigung',
      greeting: 'Liebe/r {name},',
      intro: 'Ihre Buchung wurde bestätigt. Hier ist die Zusammenfassung:',
      apartment: 'Apartment',
      checkin: 'Anreise',
      checkout: 'Abreise',
      checkin_time: 'ab 15:00 Uhr',
      checkout_time: 'bis 10:00 Uhr',
      nights: 'Nächte',
      guests: 'Gäste',
      adults: '{n} Erwachsene',
      children: '+ {n} Kinder',
      total_label: 'Gesamtbetrag',
      address_label: 'Adresse:',
      address: 'Santo Stefano, Bene Vagienna (CN)<br>Piemont, Italien',
      directions_note: 'Wir senden Ihnen einige Tage vor Ihrer Ankunft eine detaillierte Wegbeschreibung. Bei Fragen stehen wir Ihnen gerne zur Verfügung.',
    },
  },
  checkin: {
    it: {
      subject: 'CASIA · Completa il check-in online',
      title: 'Check-in Online',
      greeting: 'Gentile {name},',
      intro: 'Per rendere il suo arrivo più rapido e piacevole, la invitiamo a completare il check-in online compilando i dati di tutti i viaggiatori.',
      details: 'Il suo soggiorno: <strong>{checkin} → {checkout}</strong>',
      cta: 'Compila il check-in',
      steps: 'Dovrà inserire i dati anagrafici e un documento d\'identità per ogni viaggiatore. Dopo la verifica, riceverà le istruzioni per accedere all\'appartamento.',
      note: 'Se ha domande, non esiti a contattarci. Il link è personale: non lo condivida con altri.',
    },
    en: {
      subject: 'CASIA · Complete your online check-in',
      title: 'Online Check-in',
      greeting: 'Dear {name},',
      intro: 'To make your arrival smoother and more pleasant, we invite you to complete the online check-in by filling in the details of all travelers.',
      details: 'Your stay: <strong>{checkin} → {checkout}</strong>',
      cta: 'Complete check-in',
      steps: 'You will need to provide personal details and an ID document for each traveler. After verification, you will receive instructions to access the apartment.',
      note: 'If you have any questions, please don\'t hesitate to contact us. This link is personal: please do not share it.',
    },
    fr: {
      subject: 'CASIA · Complétez votre check-in en ligne',
      title: 'Check-in en ligne',
      greeting: 'Cher/Chère {name},',
      intro: 'Pour rendre votre arrivée plus rapide et agréable, nous vous invitons à compléter le check-in en ligne en remplissant les informations de tous les voyageurs.',
      details: 'Votre séjour : <strong>{checkin} → {checkout}</strong>',
      cta: 'Compléter le check-in',
      steps: 'Vous devrez fournir les données personnelles et un document d\'identité pour chaque voyageur. Après vérification, vous recevrez les instructions d\'accès à l\'appartement.',
      note: 'Pour toute question, n\'hésitez pas à nous contacter. Ce lien est personnel : ne le partagez pas.',
    },
    de: {
      subject: 'CASIA · Online-Check-in abschließen',
      title: 'Online-Check-in',
      greeting: 'Liebe/r {name},',
      intro: 'Um Ihre Ankunft angenehmer zu gestalten, laden wir Sie ein, den Online-Check-in auszufüllen und die Daten aller Reisenden anzugeben.',
      details: 'Ihr Aufenthalt: <strong>{checkin} → {checkout}</strong>',
      cta: 'Check-in ausfüllen',
      steps: 'Sie müssen für jeden Reisenden persönliche Daten und ein Ausweisdokument angeben. Nach der Überprüfung erhalten Sie die Zugangsinformationen zur Wohnung.',
      note: 'Bei Fragen stehen wir Ihnen gerne zur Verfügung. Dieser Link ist persönlich: bitte teilen Sie ihn nicht.',
    },
  },
  access: {
    it: {
      subject: 'CASIA · Istruzioni di accesso per il {checkin}',
      title: 'Istruzioni di Accesso',
      greeting: 'Gentile {name},',
      intro: 'Ecco le istruzioni per accedere all\'appartamento per il suo soggiorno dal <strong>{checkin}</strong> al <strong>{checkout}</strong>:',
      contact: 'Per qualsiasi necessità, non esiti a contattarci. Buon soggiorno!',
    },
    en: {
      subject: 'CASIA · Access instructions for {checkin}',
      title: 'Access Instructions',
      greeting: 'Dear {name},',
      intro: 'Here are the instructions to access the apartment for your stay from <strong>{checkin}</strong> to <strong>{checkout}</strong>:',
      contact: 'For any needs, please don\'t hesitate to contact us. Enjoy your stay!',
    },
    fr: {
      subject: 'CASIA · Instructions d\'accès pour le {checkin}',
      title: 'Instructions d\'Accès',
      greeting: 'Cher/Chère {name},',
      intro: 'Voici les instructions pour accéder à l\'appartement pour votre séjour du <strong>{checkin}</strong> au <strong>{checkout}</strong> :',
      contact: 'Pour tout besoin, n\'hésitez pas à nous contacter. Bon séjour !',
    },
    de: {
      subject: 'CASIA · Zugangsinformationen für den {checkin}',
      title: 'Zugangsinformationen',
      greeting: 'Liebe/r {name},',
      intro: 'Hier sind die Zugangsinformationen zur Wohnung für Ihren Aufenthalt vom <strong>{checkin}</strong> bis <strong>{checkout}</strong>:',
      contact: 'Bei Fragen stehen wir Ihnen gerne zur Verfügung. Schönen Aufenthalt!',
    },
  },
  tax: {
    it: {
      subject: 'CASIA · Pagamento tassa di soggiorno',
      title: 'Tassa di Soggiorno',
      greeting: 'Gentile {name},',
      intro: 'Come previsto dalla normativa comunale, è richiesto il pagamento della tassa di soggiorno per il suo pernottamento.',
      period: 'Periodo',
      persons: 'Persone soggette',
      nights_label: 'Notti tassabili',
      total_label: 'Importo dovuto',
      cta: 'Paga la tassa di soggiorno',
      note: 'Il pagamento è sicuro e gestito da Stripe. L\'importo è stabilito dal Comune.',
    },
    en: {
      subject: 'CASIA · Tourist tax payment',
      title: 'Tourist Tax',
      greeting: 'Dear {name},',
      intro: 'As required by local regulations, a tourist tax payment is required for your stay.',
      period: 'Period',
      persons: 'Taxable persons',
      nights_label: 'Taxable nights',
      total_label: 'Amount due',
      cta: 'Pay tourist tax',
      note: 'Payment is secure and handled by Stripe. The amount is set by the Municipality.',
    },
    fr: {
      subject: 'CASIA · Paiement de la taxe de séjour',
      title: 'Taxe de Séjour',
      greeting: 'Cher/Chère {name},',
      intro: 'Conformément à la réglementation municipale, le paiement de la taxe de séjour est requis pour votre séjour.',
      period: 'Période',
      persons: 'Personnes assujetties',
      nights_label: 'Nuits taxables',
      total_label: 'Montant dû',
      cta: 'Payer la taxe de séjour',
      note: 'Le paiement est sécurisé et géré par Stripe. Le montant est fixé par la Commune.',
    },
    de: {
      subject: 'CASIA · Zahlung der Kurtaxe',
      title: 'Kurtaxe',
      greeting: 'Liebe/r {name},',
      intro: 'Gemäß den örtlichen Vorschriften ist die Zahlung der Kurtaxe für Ihren Aufenthalt erforderlich.',
      period: 'Zeitraum',
      persons: 'Steuerpflichtige Personen',
      nights_label: 'Steuerpflichtige Nächte',
      total_label: 'Fälliger Betrag',
      cta: 'Kurtaxe bezahlen',
      note: 'Die Zahlung ist sicher und wird von Stripe abgewickelt. Der Betrag wird von der Gemeinde festgelegt.',
    },
  },
};

/**
 * Carica i testi di un gruppo di email (conf, checkin, access, tax) per una lingua,
 * leggendo le eventuali sovrascritture dalla tabella translations (page = 'email') e
 * completando con i fallback qui sopra. Se env.DB manca o la query fallisce, usa solo
 * i fallback e registra un avviso.
 */
export async function loadEmailTexts(env, group, lang) {
  const fallbacks = emailFallbacks[group] || {};
  const base = fallbacks[lang] || fallbacks.it || {};
  const result = { ...base };

  if (!env || !env.DB) {
    console.warn(`loadEmailTexts: env.DB non disponibile, uso i testi predefiniti per il gruppo "${group}" (${lang})`);
    return result;
  }

  try {
    const prefix = `${group}_`;
    const { results } = await env.DB.prepare(
      "SELECT key, value FROM translations WHERE lang = ? AND page = 'email' AND key LIKE ?"
    ).bind(lang, `${prefix}%`).all();

    for (const row of results || []) {
      if (row && typeof row.key === 'string' && row.key.startsWith(prefix)) {
        result[row.key.slice(prefix.length)] = row.value;
      }
    }
  } catch (err) {
    console.warn(`loadEmailTexts: query fallita per il gruppo "${group}" (${lang}), uso i testi predefiniti`, err);
  }

  return result;
}

/**
 * Sostituisce i segnaposto {chiave} in una stringa con i valori di params.
 * Se il segnaposto non ha un valore corrispondente, resta invariato.
 */
export function fill(str, params) {
  if (typeof str !== 'string') return str;
  return str.replace(/\{(\w+)\}/g, (match, name) => {
    const value = params ? params[name] : undefined;
    return value === undefined || value === null ? match : String(value);
  });
}
