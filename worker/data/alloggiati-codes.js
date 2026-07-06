// Mapping codici per export Schedina Alloggiati Web (Portale Questura)
// Formato: record di 126 caratteri per riga

// Tipo alloggiato
const TIPO_ALLOGGIATO = {
  primary: '16', // Capogruppo
  member: '19',  // Membro del gruppo
  single: '20',  // Ospite singolo
};

// Tipo documento
const DOC_TYPE_MAP = {
  CI: 'IDENT',  // Carta d'identità
  PA: 'PASOR',  // Passaporto ordinario
  PT: 'PATEN',  // Patente di guida
  ID: 'IDENT',  // Documento identità generico
};

// Principali codici stato ISO -> codice Alloggiati (3 cifre)
const COUNTRY_CODES = {
  IT: '100',
  DE: '203',
  FR: '212',
  GB: '219',
  ES: '209',
  CH: '227',
  AT: '201',
  BE: '202',
  NL: '214',
  PT: '218',
  US: '400',
  CA: '401',
  BR: '416',
  AR: '415',
  AU: '700',
  CN: '514',
  JP: '515',
  KR: '519',
  IN: '504',
  RU: '226',
  PL: '217',
  CZ: '207',
  HR: '250',
  SI: '251',
  RO: '235',
  HU: '244',
  SK: '255',
  BG: '238',
  SE: '225',
  NO: '215',
  DK: '204',
  FI: '211',
  IE: '205',
  GR: '220',
  TR: '351',
  IL: '330',
  EG: '302',
  ZA: '313',
  MX: '412',
  CO: '417',
  CL: '418',
  NZ: '701',
};

// Province italiane (sigla -> codice Alloggiati)
const PROVINCE_CODES = {
  AG: '084', AL: '006', AN: '042', AO: '007', AP: '044', AQ: '066',
  AR: '051', AT: '005', AV: '064', BA: '072', BG: '016', BI: '096',
  BL: '025', BN: '062', BO: '037', BR: '074', BS: '017', BT: '110',
  BZ: '021', CA: '092', CB: '070', CE: '061', CH: '069', CI: '107',
  CL: '085', CN: '004', CO: '013', CR: '019', CS: '078', CT: '087',
  CZ: '079', EN: '086', FC: '040', FE: '038', FG: '071', FI: '048',
  FM: '109', FR: '060', GE: '010', GO: '031', GR: '053', IM: '008',
  IS: '094', KR: '101', LC: '097', LE: '075', LI: '049', LO: '098',
  LT: '059', LU: '046', MB: '108', MC: '043', ME: '083', MI: '015',
  MN: '020', MO: '036', MS: '045', MT: '077', NA: '063', NO: '003',
  NU: '091', OG: '105', OR: '095', OT: '104', PA: '082', PC: '033',
  PD: '028', PE: '068', PG: '054', PI: '050', PN: '093', PO: '100',
  PR: '034', PT: '047', PU: '041', PV: '018', PZ: '076', RA: '039',
  RC: '080', RE: '035', RG: '088', RI: '057', RM: '058', RN: '099',
  RO: '029', SA: '065', SI: '052', SO: '014', SP: '011', SR: '089',
  SS: '090', SU: '111', SV: '009', TA: '073', TE: '067', TN: '022',
  TO: '001', TP: '081', TR: '055', TS: '032', TV: '026', UD: '030',
  VA: '012', VB: '103', VC: '002', VE: '027', VI: '024', VR: '023',
  VS: '106', VT: '056', VV: '102',
};

/**
 * Pad string a destra con spazi fino alla lunghezza desiderata
 */
function pad(str, len) {
  const s = (str || '').toString();
  return s.substring(0, len).padEnd(len, ' ');
}

/**
 * Formatta data da YYYY-MM-DD a GG/MM/AAAA
 */
function formatDateAlloggiati(dateStr) {
  if (!dateStr) return '          ';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Genera file TXT nel formato Alloggiati Web
 * Ogni record: 126 caratteri fissi
 *
 * Formato per ogni riga:
 * - Tipo alloggiato (2)
 * - Data arrivo GG/MM/AAAA (10)
 * - Permanenza in gg (2)
 * - Cognome (50)
 * - Nome (30)
 * - Sesso M/F (1)
 * - Data nascita GG/MM/AAAA (10)
 * - Comune/Luogo nascita (26)  per italiani: "codice catastale" / per stranieri: codice stato
 * - Provincia nascita (2) per italiani
 * - Stato nascita (9)
 * - Cittadinanza (9)
 * - Tipo documento (5)
 * - Numero documento (20)
 *
 * NOTA: Il formato esatto può variare tra le questure.
 * Questo genera un formato base compatibile.
 */
export function generateAlloggiatiTxt(reservation, travelers) {
  const checkinDate = reservation.checkin;
  const nights = reservation.nights;
  const lines = [];

  travelers.forEach((t, i) => {
    let tipoAlloggiato;
    if (travelers.length === 1) {
      tipoAlloggiato = TIPO_ALLOGGIATO.single;
    } else {
      tipoAlloggiato = t.is_primary ? TIPO_ALLOGGIATO.primary : TIPO_ALLOGGIATO.member;
    }

    const countryCode = COUNTRY_CODES[t.birth_country] || COUNTRY_CODES[t.citizenship] || '100';
    const citizenshipCode = COUNTRY_CODES[t.citizenship] || '100';
    const provinceCode = t.birth_province ? (PROVINCE_CODES[t.birth_province.toUpperCase()] || '  ') : '  ';
    const docTypeCode = DOC_TYPE_MAP[t.doc_type] || '     ';

    const line = [
      pad(tipoAlloggiato, 2),
      formatDateAlloggiati(checkinDate),
      pad(String(nights).padStart(2, '0'), 2),
      pad((t.last_name || '').toUpperCase(), 50),
      pad((t.first_name || '').toUpperCase(), 30),
      pad(t.gender || ' ', 1),
      formatDateAlloggiati(t.birth_date),
      pad((t.birth_place || '').toUpperCase(), 26),
      pad(t.birth_country === 'IT' ? (t.birth_province || '').toUpperCase() : '', 2),
      pad(countryCode, 9),
      pad(citizenshipCode, 9),
      pad(docTypeCode, 5),
      pad((t.doc_number || '').toUpperCase(), 20),
    ].join('');

    lines.push(line);
  });

  return lines.join('\r\n');
}
