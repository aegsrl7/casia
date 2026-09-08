// Rende l'italiano del sito modificabile dal pannello senza toccare l'HTML:
// le pagine servite vengono riscritte al volo con i testi it della tabella
// translations (stessa semantica di i18n.js per le altre lingue). Per Google
// e per gli ospiti il risultato e' identico a testo statico.

const PAGINE = {
  '/': ['common', 'index'],
  '/index.html': ['common', 'index'],
  '/amici': ['common', 'amici'],
  '/amici.html': ['common', 'amici'],
};

const CACHE_TTL = 300; // secondi; il salvataggio dal pannello svuota comunque subito

function cacheKeyFor(origin, path) {
  return new Request(origin + '/__it-render' + (path === '/' ? '/home' : path));
}

/**
 * Serve la pagina italiana riscritta coi testi dal DB.
 * Ritorna null se la richiesta non riguarda una pagina gestita.
 */
export async function serveItalianPage(request, env, path) {
  if (request.method !== 'GET' || !PAGINE[path]) return null;

  const url = new URL(request.url);
  // L'anteprima dell'editor (?editor=1) non deve toccare la cache condivisa
  // con i visitatori reali: altrimenti una GET di anteprima in corso puo'
  // resuscitare in cache il testo vecchio subito dopo un salvataggio.
  const isEditorPreview = url.searchParams.get('editor') === '1';
  const origin = url.origin;
  const cache = caches.default;
  const key = isEditorPreview ? null : cacheKeyFor(origin, path);
  if (key) {
    const hit = await cache.match(key);
    if (hit) return hit;
  }

  const asset = await env.ASSETS.fetch(request);
  const ct = asset.headers.get('content-type') || '';
  if (!asset.ok || !ct.includes('text/html')) return asset;

  let rows;
  try {
    const pages = PAGINE[path];
    rows = (await env.DB.prepare(
      `SELECT key, value FROM translations WHERE lang = 'it' AND page IN (${pages.map(() => '?').join(',')})`
    ).bind(...pages).all()).results;
  } catch (err) {
    console.error('render-it: errore DB, servo la pagina originale:', err.message);
    return asset;
  }

  const dict = {};
  for (const r of rows) dict[r.key] = r.value;

  const attr = (nome, applica) => ({
    element(el) {
      const v = dict[el.getAttribute(nome)];
      if (v !== undefined) applica(el, v);
    },
  });

  const riscritta = new HTMLRewriter()
    .on('[data-i18n]', attr('data-i18n', (el, v) => el.setInnerContent(v)))
    .on('[data-i18n-html]', attr('data-i18n-html', (el, v) => el.setInnerContent(v, { html: true })))
    .on('[data-i18n-placeholder]', attr('data-i18n-placeholder', (el, v) => el.setAttribute('placeholder', v)))
    .on('[data-i18n-alt]', attr('data-i18n-alt', (el, v) => el.setAttribute('alt', v)))
    .on('[data-i18n-aria]', attr('data-i18n-aria', (el, v) => el.setAttribute('aria-label', v)))
    .transform(asset);

  const res = new Response(riscritta.body, riscritta);
  res.headers.set('X-It-Render', '1');

  if (key) {
    res.headers.set('Cache-Control', `public, max-age=0, s-maxage=${CACHE_TTL}`);
    try {
      await cache.put(key, res.clone());
    } catch (err) {
      console.error('render-it: cache.put fallita:', err.message);
    }
  } else {
    res.headers.set('Cache-Control', 'private, no-store');
  }
  return res;
}

/**
 * Svuota la cache delle pagine riscritte (chiamata al salvataggio traduzioni it).
 */
export async function purgeItalianPages(request) {
  const origin = new URL(request.url).origin;
  const cache = caches.default;
  for (const path of Object.keys(PAGINE)) {
    try {
      await cache.delete(cacheKeyFor(origin, path));
    } catch (err) {
      console.error('render-it: purge fallita per', path, err.message);
    }
  }
}
