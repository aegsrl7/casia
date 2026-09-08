/* ===================================================================
   CASIA Admin - Editor "Testi del sito"
   Namespace globale window.CasiaTesti, nessuna dipendenza da id di
   admin.html oltre al rootEl passato a init().
   =================================================================== */
(function () {
    'use strict';

    var SHOWKEYS_STORAGE_KEY = 'casia_testi_showkeys';
    var PREVIEW_W_KEY = 'casia_testi_preview_w';      // larghezza della colonna anteprima (px)
    var PREVIEW_MODE_KEY = 'casia_testi_preview_mode'; // 'desktop' (sito in scala) oppure 'mobile'
    var DEFAULT_PREVIEW_W = 520;
    var DESKTOP_W = 1200;   // larghezza a cui viene renderizzato il sito in modalità desktop
    var ALLOWED_HTML_TAGS = ['strong', 'em', 'br', 'a'];

    var initialized = false;
    var opened = false;
    var dataLoaded = false;
    var deps = null;
    var rootEl = null;

    // dati
    var mapping = { pages: {}, sections: [], hidden: [] };
    var db = { it: { index: {}, amici: {}, common: {} }, en: { index: {}, amici: {}, common: {} }, fr: { index: {}, amici: {}, common: {} }, de: { index: {}, amici: {}, common: {} } };
    var loadedLangs = {};

    // stato editor
    var lang = 'it';
    var pageMode = 'index';
    var keyPage = {};   // chiave -> pagina del DB su cui risolverla (sezioni con "page" fissa, per esempio email)
    function pageOf(key) { return keyPage[key] || pageMode; }
    var cur = null;
    var changes = {};
    var query = '';
    var onlyOut = false;
    var showKeys = false;
    var sections = [];
    var lastHighlightKey = null;

    // riferimenti DOM (popolati in cacheRefs)
    var navEl, fieldsEl, searchInput, langChipsEl, pageSelectEl, showKeysToggle,
        statusEl, undoBtn, saveBtn, previewFrame, previewPageLabel, previewEmpty, previewHint,
        appEl, previewBody, splitterEl, modesEl;
    var previewW = DEFAULT_PREVIEW_W;
    var previewMode = 'desktop';

    // -----------------------------------------------------------------
    // Helper generici
    // -----------------------------------------------------------------
    function esc(s) {
        var el = document.createElement('span');
        el.textContent = s === undefined || s === null ? '' : String(s);
        return el.innerHTML;
    }
    function escAttr(s) {
        return esc(s).replace(/"/g, '&quot;');
    }
    function cssEsc(v) {
        if (window.CSS && typeof CSS.escape === 'function') return CSS.escape(v);
        return String(v).replace(/([^\w-])/g, '\\$1');
    }
    function beautifyKey(k) {
        var s = String(k).replace(/_/g, ' ');
        return s.charAt(0).toUpperCase() + s.slice(1);
    }
    function arraysEqual(a, b) {
        if (a.length !== b.length) return false;
        for (var i = 0; i < a.length; i++) { if (a[i] !== b[i]) return false; }
        return true;
    }
    function parseArray(v) {
        if (typeof v !== 'string') return null;
        var t = v.trim();
        if (t.charAt(0) !== '[') return null;
        try {
            var p = JSON.parse(t);
            return Array.isArray(p) ? p : null;
        } catch (e) {
            return null;
        }
    }
    function extractPlaceholders(s) {
        var set = {};
        var re = /\{(\w+)\}/g;
        var m;
        var str = String(s === undefined || s === null ? '' : s);
        while ((m = re.exec(str))) { set[m[1]] = true; }
        return Object.keys(set).sort();
    }
    function countTags(s) {
        var m = String(s === undefined || s === null ? '' : s).match(/<[a-zA-Z][^>]*>/g);
        return m ? m.length : 0;
    }

    // Sanificazione HTML: consente solo strong, em, br, a (con solo href su a)
    function sanitizeHtml(html) {
        // Un <template> ha un documento inerte: immagini e script dentro non vengono
        // caricati né eseguiti mentre si pulisce (con un div staccato un onerror scatterebbe).
        var tpl = document.createElement('template');
        tpl.innerHTML = String(html === undefined || html === null ? '' : html);
        var tmp = tpl.content;
        (function clean(node) {
            // Scorre i figli con un puntatore live (non uno snapshot): quando un tag non ammesso
            // viene scartato, i suoi figli vengono promossi al posto suo e vanno ripassati da
            // clean() a loro volta, altrimenti restano intatti (bypass dello sanitizer).
            var child = node.firstChild;
            while (child) {
                var next = child.nextSibling;
                if (child.nodeType === 1) {
                    var tag = child.tagName.toLowerCase();
                    if (ALLOWED_HTML_TAGS.indexOf(tag) === -1) {
                        var promoted = child.firstChild;
                        while (child.firstChild) node.insertBefore(child.firstChild, child);
                        node.removeChild(child);
                        child = promoted || next;
                        continue;
                    }
                    Array.prototype.slice.call(child.attributes).forEach(function (attr) {
                        if (tag === 'a' && attr.name === 'href') return;
                        child.removeAttribute(attr.name);
                    });
                    if (tag === 'a') {
                        var href = child.getAttribute('href') || '';
                        if (!/^(https?:|mailto:|tel:|#|\/)/i.test(href)) child.removeAttribute('href');
                    }
                    clean(child);
                } else if (child.nodeType !== 3) {
                    node.removeChild(child);
                }
                child = next;
            }
        })(tmp);
        return tpl.innerHTML;
    }

    // -----------------------------------------------------------------
    // Accesso ai dati (db)
    // -----------------------------------------------------------------
    function findEntry(l, page, key) {
        if (db[l] && db[l][page] && db[l][page][key] !== undefined) {
            return { value: db[l][page][key].value, updated_at: db[l][page][key].updated_at, page: page };
        }
        if (db[l] && db[l].common && db[l].common[key] !== undefined) {
            return { value: db[l].common[key].value, updated_at: db[l].common[key].updated_at, page: 'common' };
        }
        return null;
    }
    function resolveSavePage(l, page, key) {
        var e = findEntry(l, page, key);
        if (e) return e.page;
        var eit = findEntry('it', page, key);
        if (eit) return eit.page;
        return page;
    }
    function valueFor(l, page, key) {
        var e = findEntry(l, page, key);
        return e ? e.value : '';
    }
    function curValue(key) {
        if (Object.prototype.hasOwnProperty.call(changes, key)) return changes[key];
        return valueFor(lang, pageOf(key), key);
    }
    function refValue(key) {
        return valueFor('it', pageOf(key), key);
    }
    function isMissing(key) {
        return lang !== 'it' && !findEntry(lang, pageOf(key), key);
    }
    function isOutdated(key) {
        if (lang === 'it') return false;
        var e = findEntry(lang, pageOf(key), key);
        var eit = findEntry('it', pageOf(key), key);
        if (!e || !eit) return false;
        return eit.updated_at > e.updated_at;
    }
    function needsAttention(key) {
        return isMissing(key) || isOutdated(key);
    }
    function isArrayKey(key) {
        if (parseArray(refValue(key))) return true;
        return !!parseArray(valueFor(lang, pageOf(key), key));
    }
    function isHtmlKey(key) {
        return /<\s*(strong|em|br|a)\b/i.test(String(refValue(key)));
    }

    // -----------------------------------------------------------------
    // Caricamento dati
    // -----------------------------------------------------------------
    function loadMappingData() {
        return fetch('/admin-testi-mappa.json', { cache: 'no-store' })
            .then(function (res) {
                if (!res.ok) throw new Error('mappa non trovata');
                return res.json();
            })
            .then(function (json) {
                mapping = json || {};
                if (!mapping.sections) mapping.sections = [];
                if (!mapping.hidden) mapping.hidden = [];
                if (!mapping.pages) mapping.pages = {};
                return true;
            })
            .catch(function () {
                mapping = {
                    pages: { index: { title: 'Home', preview: '/?editor=1' }, amici: { title: 'Home, versione Amici', preview: '/amici?editor=1' } },
                    sections: [],
                    hidden: []
                };
                if (deps && deps.toast) deps.toast('Mappa delle sezioni non trovata: uso solo "Altro".', 'error');
                return true;
            });
    }

    function ensureLangLoaded(l, force) {
        if (!force && loadedLangs[l]) return Promise.resolve(true);
        return deps.apiFetch('/translations?lang=' + l).then(function (res) {
            if (!res) return false;
            if (!res.ok) {
                deps.toast('Errore nel caricamento dei testi.', 'error');
                return false;
            }
            return res.json();
        }).then(function (data) {
            if (data === false || !data) return false;
            var byPage = { index: {}, amici: {}, common: {} };
            (data.translations || []).forEach(function (row) {
                if (!byPage[row.page]) byPage[row.page] = {};
                byPage[row.page][row.key] = { value: row.value, updated_at: row.updated_at };
            });
            db[l] = byPage;
            loadedLangs[l] = true;
            return true;
        }).catch(function () {
            deps.toast('Errore nel caricamento dei testi.', 'error');
            return false;
        });
    }

    // -----------------------------------------------------------------
    // Costruzione sezioni per la pagina corrente
    // -----------------------------------------------------------------
    function computeSections() {
        var page = pageMode;
        var out = [];
        var mappedKeys = {};
        var fixedPages = [];
        keyPage = {};

        (mapping.sections || []).forEach(function (s) {
            var sectionPage = s.page || page;   // sezioni legate a una pagina del DB (per esempio "email")
            if (s.page && fixedPages.indexOf(s.page) === -1) fixedPages.push(s.page);
            var candidateKeys = (s.keys || []).filter(function (x) {
                return !x.pages || x.pages.indexOf(page) !== -1;
            });
            candidateKeys.forEach(function (x) { mappedKeys[x.k] = true; if (s.page) keyPage[x.k] = s.page; });
            var existing = candidateKeys.filter(function (x) { return findEntry('it', sectionPage, x.k) !== null; });
            if (existing.length) {
                out.push({
                    id: s.id,
                    title: s.title,
                    where: s.where || '',
                    preview: s.preview !== false,
                    keys: existing
                });
            } else if (s.page && candidateKeys.length) {
                // Sezione a pagina fissa (per esempio "email") non ancora popolata in italiano
                // nel DB (seed non eseguito): la mostriamo comunque con un avviso, invece di
                // farla sparire silenziosamente come se non esistesse.
                out.push({
                    id: s.id,
                    title: s.title,
                    where: s.where || '',
                    preview: s.preview !== false,
                    keys: candidateKeys,
                    missingIt: true
                });
            }
        });

        var hiddenSet = {};
        (mapping.hidden || []).forEach(function (h) { hiddenSet[h] = true; });
        var seen = {};
        var altroKeys = [];
        function consider(k) {
            if (seen[k]) return;
            seen[k] = true;
            if (mappedKeys[k] || hiddenSet[k]) return;
            altroKeys.push({ k: k, label: beautifyKey(k) });
        }
        Object.keys(db.it[page] || {}).forEach(consider);
        Object.keys(db.it.common || {}).forEach(consider);
        fixedPages.forEach(function (fp) {
            Object.keys(db.it[fp] || {}).forEach(function (k) {
                if (!seen[k] && !mappedKeys[k] && !hiddenSet[k]) keyPage[k] = fp;
                consider(k);
            });
        });
        if (altroKeys.length) {
            altroKeys.sort(function (a, b) { return a.k.localeCompare(b.k); });
            out.push({ id: 'altro', title: 'Altro', where: 'Testi non ancora catalogati nella mappa delle sezioni.', preview: false, keys: altroKeys });
        }

        sections = out;
    }
    function firstSectionId() {
        return sections.length ? sections[0].id : null;
    }
    function currentSectionObj() {
        for (var i = 0; i < sections.length; i++) { if (sections[i].id === cur) return sections[i]; }
        return sections.length ? sections[0] : null;
    }
    function findLabelForKey(key) {
        for (var i = 0; i < sections.length; i++) {
            var s = sections[i];
            for (var j = 0; j < s.keys.length; j++) {
                if (s.keys[j].k === key) return s.keys[j].label;
            }
        }
        return beautifyKey(key);
    }

    // -----------------------------------------------------------------
    // Comunicazione con l'iframe di anteprima
    // -----------------------------------------------------------------
    function postToIframe(msg) {
        if (!previewFrame || !previewFrame.contentWindow) return;
        try { previewFrame.contentWindow.postMessage(msg, window.location.origin); } catch (e) { /* ignora */ }
    }
    function sendHighlight(key, scroll) {
        lastHighlightKey = key;
        postToIframe({ casiaEditor: true, type: 'highlight', key: key, scroll: !!scroll });
    }
    function sendSet(key, value) {
        postToIframe({ casiaEditor: true, type: 'set', key: key, value: value });
    }
    function sendSetMany(values) {
        if (!values || !Object.keys(values).length) return;
        postToIframe({ casiaEditor: true, type: 'setMany', values: values });
    }

    function onIframeReady() {
        if (Object.keys(changes).length) sendSetMany(changes);
        if (lastHighlightKey) sendHighlight(lastHighlightKey, true);
    }
    function onIframePick(key) {
        var target = null;
        for (var i = 0; i < sections.length; i++) {
            if (sections[i].keys.some(function (x) { return x.k === key; })) { target = sections[i]; break; }
        }
        if (!target) return;
        query = '';
        if (searchInput) searchInput.value = '';
        if (cur !== target.id) {
            cur = target.id;
            onlyOut = false;
            renderNav();
        }
        renderFields();
        // Subito, senza requestAnimationFrame: il browser lo sospende con la finestra coperta
        // o la scheda in secondo piano, e il focus non arriverebbe mai.
        var field = fieldsEl.querySelector('.testi-field[data-key="' + cssEsc(key) + '"]');
        if (!field) return;
        var focusable = field.querySelector('.testi-textarea') || field.querySelector('.testi-array-item');
        if (!focusable) return;
        scrollFieldIntoView(field);
        focusable.focus({ preventScroll: true });
    }
    function scrollFieldIntoView(el) {
        var r = el.getBoundingClientRect();
        var p = fieldsEl.getBoundingClientRect();
        fieldsEl.scrollTop += (r.top - p.top) - (p.height / 2) + (r.height / 2);
    }

    function onWindowMessage(e) {
        if (e.origin !== window.location.origin) return;
        var data = e.data;
        if (!data || data.casiaEditor !== true) return;
        if (previewFrame && e.source !== previewFrame.contentWindow) return;
        if (data.type === 'ready') onIframeReady();
        else if (data.type === 'pick') onIframePick(data.key);
    }

    function computePreviewSrc() {
        var p = mapping.pages && mapping.pages[pageMode];
        var base = (p && p.preview) ? p.preview : (pageMode === 'amici' ? '/amici?editor=1' : '/?editor=1');
        return base + '&lang=' + lang;
    }
    function updatePreviewHeadAndSrc() {
        var p = mapping.pages && mapping.pages[pageMode];
        previewPageLabel.textContent = p ? p.title : (pageMode === 'amici' ? 'Home, versione Amici' : 'Home');
        var src = computePreviewSrc();
        if (previewFrame.getAttribute('data-src') !== src) {
            previewFrame.setAttribute('data-src', src);
            previewFrame.src = src;
        }
    }
    function updatePreviewVisibility() {
        var showFrame;
        if (query) {
            showFrame = true;
        } else {
            var sec = currentSectionObj();
            showFrame = sec ? sec.preview !== false : true;
        }
        previewFrame.hidden = !showFrame;
        previewEmpty.hidden = showFrame;
        previewHint.hidden = !showFrame;
    }

    // -----------------------------------------------------------------
    // Rendering: navigazione
    // -----------------------------------------------------------------
    function renderNav() {
        var html = '';
        sections.forEach(function (s) {
            var out = lang !== 'it' && s.keys.some(function (x) { return needsAttention(x.k); });
            var active = s.id === cur && !query;
            html += '<button type="button" class="testi-nav-item' + (active ? ' is-active' : '') + '" data-s="' + esc(s.id) + '">'
                + '<span class="testi-nav-title">' + esc(s.title) + '</span>'
                + (out ? '<span class="testi-nav-dot" aria-hidden="true"></span>' : '')
                + '<span class="testi-nav-count">' + s.keys.length + '</span>'
                + '</button>';
        });
        navEl.innerHTML = html || '<div class="testi-empty">Nessuna sezione.</div>';
    }

    // -----------------------------------------------------------------
    // Rendering: campo singolo
    // -----------------------------------------------------------------
    function fieldTemplate(x, secLabel) {
        var key = x.k, label = x.label;
        var v = curValue(key);
        var isArr = isArrayKey(key);
        var isHtml = !isArr && isHtmlKey(key);
        var changed = Object.prototype.hasOwnProperty.call(changes, key);
        var missing = isMissing(key);
        var outdated = !missing && isOutdated(key);

        var classes = ['testi-field'];
        if (changed) classes.push('testi-field--changed');
        if (missing) classes.push('testi-field--missing');
        else if (outdated) classes.push('testi-field--outdated');

        var html = '';
        if (secLabel) html += '<div class="testi-field-sec-label">' + esc(secLabel) + '</div>';
        html += '<div class="' + classes.join(' ') + '" data-key="' + esc(key) + '">';
        html += '<div class="testi-field-head">';
        html += '<span class="testi-field-name">' + esc(label) + '</span>';
        html += '<span class="testi-field-key">' + esc(key) + '</span>';
        if (missing) html += '<span class="testi-badge testi-badge--missing">Mancante</span>';
        else if (outdated) html += '<span class="testi-badge testi-badge--warn">Da aggiornare</span>';
        if (changed) html += '<span class="testi-field-changed-mark">modificato</span>';
        html += '</div>';

        if (lang !== 'it') {
            var ref = refValue(key);
            html += '<div class="testi-field-ref"><span class="testi-field-ref-label">Italiano</span>';
            html += '<div class="testi-field-ref-text">' + (isHtml ? sanitizeHtml(ref) : esc(ref)) + '</div>';
            html += '</div>';
        }

        html += '<div class="testi-field-editor">';
        if (isArr) {
            var arr = parseArray(v) || parseArray(refValue(key)) || [];
            html += '<div class="testi-array-grid" data-key="' + esc(key) + '">';
            arr.forEach(function (item, i) {
                html += '<input type="text" class="testi-array-item" data-idx="' + i + '" value="' + escAttr(String(item)) + '">';
            });
            html += '</div>';
        } else {
            html += '<div class="testi-editor-wrap">';
            html += '<textarea class="testi-textarea" data-key="' + esc(key) + '" rows="1">' + esc(v) + '</textarea>';
            if (isHtml) html += '<button type="button" class="testi-bold-btn" title="Grassetto">G</button>';
            html += '</div>';
            if (isHtml) {
                html += '<div class="testi-field-preview"><span class="testi-field-preview-label">Anteprima</span>'
                    + '<div class="testi-field-preview-render">' + sanitizeHtml(v) + '</div></div>';
            }
        }
        html += '</div></div>';
        return html;
    }

    function visibleKeys() {
        if (query) {
            var q = query.toLowerCase();
            var res = [];
            sections.forEach(function (s) {
                s.keys.forEach(function (x) {
                    var lbl = x.label.toLowerCase();
                    var val = String(curValue(x.k)).toLowerCase();
                    var ref = String(refValue(x.k)).toLowerCase();
                    if (lbl.indexOf(q) !== -1 || val.indexOf(q) !== -1 || ref.indexOf(q) !== -1) {
                        res.push({ sec: s.title, k: x.k, label: x.label });
                    }
                });
            });
            return { mode: 'search', items: res };
        }
        var sec = currentSectionObj();
        if (!sec) return { mode: 'section', section: null, items: [] };
        var items = sec.keys;
        if (lang !== 'it' && onlyOut) items = items.filter(function (x) { return needsAttention(x.k); });
        return { mode: 'section', section: sec, items: items };
    }

    function renderFields() {
        var vk = visibleKeys();
        var headHtml, itemsHtml;

        if (vk.mode === 'search') {
            headHtml = '<div class="testi-sec-head"><h3>Risultati per &quot;' + esc(query) + '&quot;</h3>'
                + '<p>' + vk.items.length + ' frasi in tutte le sezioni</p></div>';
            itemsHtml = vk.items.map(function (x) { return fieldTemplate(x, x.sec); }).join('');
        } else {
            var sec = vk.section;
            if (!sec) {
                fieldsEl.innerHTML = '<div class="testi-empty">Nessun testo da mostrare.</div>';
                updatePreviewVisibility();
                return;
            }
            headHtml = '<div class="testi-sec-head"><h3>' + esc(sec.title) + '</h3>';
            if (sec.where) headHtml += '<p>' + esc(sec.where) + '</p>';
            if (sec.missingIt) {
                headHtml += '<p class="testi-badge testi-badge--missing">Questi testi non sono ancora stati caricati nel database in italiano: quello che scrivi qui verrà comunque salvato.</p>';
            }
            if (lang !== 'it') {
                var n = sec.keys.filter(function (x) { return needsAttention(x.k); }).length;
                if (n > 0) {
                    headHtml += '<button type="button" class="testi-filter-out">' + (onlyOut ? 'Mostra tutte' : (n + ' da aggiornare, mostra solo quelle')) + '</button>';
                }
            }
            headHtml += '</div>';
            itemsHtml = vk.items.map(function (x) { return fieldTemplate(x); }).join('');
        }

        fieldsEl.innerHTML = headHtml + itemsHtml;
        Array.prototype.forEach.call(fieldsEl.querySelectorAll('.testi-textarea'), autoResize);
        updatePreviewVisibility();
    }

    function autoResize(ta) {
        ta.style.height = 'auto';
        ta.style.height = (ta.scrollHeight + 2) + 'px';
    }

    // -----------------------------------------------------------------
    // Modifiche ai campi
    // -----------------------------------------------------------------
    function applyChange(key, nv) {
        var saved = valueFor(lang, pageOf(key), key);
        if (nv === saved) delete changes[key];
        else changes[key] = nv;
        sendSet(key, nv);
        updateBar();
    }
    function updateFieldChangedUI(field, key) {
        var changed = Object.prototype.hasOwnProperty.call(changes, key);
        field.classList.toggle('testi-field--changed', changed);
        var head = field.querySelector('.testi-field-head');
        var mark = head.querySelector('.testi-field-changed-mark');
        if (changed && !mark) {
            var span = document.createElement('span');
            span.className = 'testi-field-changed-mark';
            span.textContent = 'modificato';
            head.appendChild(span);
        } else if (!changed && mark) {
            mark.remove();
        }
    }
    function handleTextareaInput(ta) {
        var key = ta.getAttribute('data-key');
        var nv = ta.value;
        autoResize(ta);
        applyChange(key, nv);
        var field = ta.closest('.testi-field');
        var renderEl = field.querySelector('.testi-field-preview-render');
        if (renderEl) renderEl.innerHTML = sanitizeHtml(nv);
        updateFieldChangedUI(field, key);
    }
    function handleArrayInput(input) {
        var grid = input.closest('.testi-array-grid');
        var key = grid.getAttribute('data-key');
        var items = Array.prototype.map.call(grid.querySelectorAll('.testi-array-item'), function (i) { return i.value; });
        var nv = JSON.stringify(items);
        applyChange(key, nv);
        updateFieldChangedUI(grid.closest('.testi-field'), key);
    }
    function wrapSelection(ta) {
        var s = ta.selectionStart, e = ta.selectionEnd;
        var val = ta.value;
        var sel = val.slice(s, e);
        ta.value = val.slice(0, s) + '<strong>' + sel + '</strong>' + val.slice(e);
        ta.focus({ preventScroll: true });
        ta.selectionStart = s + '<strong>'.length;
        ta.selectionEnd = e + '<strong>'.length;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // -----------------------------------------------------------------
    // Barra di stato / toast
    // -----------------------------------------------------------------
    function updateBar() {
        var n = Object.keys(changes).length;
        if (n === 0) {
            statusEl.textContent = 'Tutto pubblicato';
            statusEl.classList.remove('testi-status--dirty');
        } else {
            var txt = n + (n === 1 ? ' modifica non pubblicata' : ' modifiche non pubblicate');
            if (lang === 'it') txt += ", l'italiano va online in pochi secondi";
            statusEl.textContent = txt;
            statusEl.classList.add('testi-status--dirty');
        }
        saveBtn.disabled = n === 0;
        undoBtn.disabled = n === 0;
    }
    function updateActiveChip() {
        Array.prototype.forEach.call(langChipsEl.querySelectorAll('button'), function (b) {
            b.classList.toggle('is-active', b.getAttribute('data-l') === lang);
        });
    }

    // -----------------------------------------------------------------
    // Salvataggio
    // -----------------------------------------------------------------
    function collectWarnings(keys) {
        var warnings = [];
        keys.forEach(function (key) {
            var label = findLabelForKey(key);
            var nv = changes[key];
            var saved = valueFor(lang, pageOf(key), key);
            var itRef = (lang === 'it') ? saved : refValue(key);

            if (countTags(nv) !== countTags(saved)) {
                warnings.push('"' + label + '": il numero di tag HTML è cambiato rispetto al testo precedente.');
            }
            var phNew = extractPlaceholders(nv), phRef = extractPlaceholders(itRef);
            if (!arraysEqual(phNew, phRef)) {
                warnings.push('"' + label + '": i segnaposto tra graffe non corrispondono a quelli in italiano' + (phRef.length ? (' (' + phRef.join(', ') + ')') : '') + '.');
            }
            if (String(itRef).indexOf('||') !== -1 && String(nv).indexOf('||') === -1) {
                warnings.push('"' + label + '": manca il separatore "||" per il plurale presente in italiano.');
            }
        });
        return warnings;
    }

    function doSave() {
        var keys = Object.keys(changes);
        if (!keys.length) return;
        var warnings = collectWarnings(keys);
        if (warnings.length) {
            var safeMsg = '<p>Alcune modifiche non corrispondono al testo di partenza:</p><ul style="margin:8px 0;padding-left:18px;">'
                + warnings.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('')
                + '</ul><p>Vuoi salvare comunque?</p>';
            deps.confirmModal('Controlla prima di pubblicare', safeMsg, 'Salva comunque', false).then(function (ok) {
                if (ok) performSave(keys);
            });
            return;
        }
        performSave(keys);
    }

    function performSave(keys) {
        // L'utente può continuare a digitare mentre la richiesta è in volo: catturiamo sia i
        // valori davvero inviati sia la lingua di invio, per non cancellare da "changes" una
        // modifica più recente (mai inviata) né applicare gli effetti collaterali se nel
        // frattempo si è cambiata lingua.
        var savingLang = lang;
        var sent = {};
        keys.forEach(function (k) { sent[k] = changes[k]; });
        var updates = keys.map(function (k) {
            return { lang: savingLang, page: resolveSavePage(savingLang, pageOf(k), k), key: k, value: sent[k] };
        });
        saveBtn.disabled = true;
        deps.apiFetch('/translations', { method: 'PUT', body: JSON.stringify({ updates: updates }) }).then(function (res) {
            if (!res) { saveBtn.disabled = Object.keys(changes).length === 0; return; }
            res.json().catch(function () { return null; }).then(function (data) {
                if (!res.ok || !data || !data.success) {
                    deps.toast('Errore nella pubblicazione. Riprova.', 'error');
                    saveBtn.disabled = Object.keys(changes).length === 0;
                    return;
                }
                var n = keys.length;
                deps.toast(n === 1 ? 'Pubblicato. Online tra pochi secondi.' : (n + ' testi pubblicati. Online tra pochi secondi.'), 'success');
                keys.forEach(function (k) {
                    if (changes[k] === sent[k]) delete changes[k];
                });
                var keepCur = cur;
                var keepScroll = fieldsEl.scrollTop;
                ensureLangLoaded(savingLang, true).then(function (ok) {
                    saveBtn.disabled = Object.keys(changes).length === 0;
                    if (!ok || lang !== savingLang) return;
                    computeSections();
                    cur = sections.some(function (s) { return s.id === keepCur; }) ? keepCur : firstSectionId();
                    renderNav();
                    renderFields();
                    fieldsEl.scrollTop = keepScroll;
                    updateBar();
                });
            });
        });
    }

    function undoChanges() {
        var keys = Object.keys(changes);
        if (!keys.length) return;
        var revert = {};
        keys.forEach(function (k) { revert[k] = valueFor(lang, pageOf(k), k); });
        changes = {};
        renderFields();
        sendSetMany(revert);
        updateBar();
    }

    // -----------------------------------------------------------------
    // Cambio lingua / pagina
    // -----------------------------------------------------------------
    function confirmDiscardIfDirty(actionText) {
        if (!Object.keys(changes).length) return Promise.resolve(true);
        return deps.confirmModal(
            'Modifiche non pubblicate',
            'Ci sono modifiche non pubblicate. ' + actionText + ' andranno perse. Continuare?',
            'Continua',
            true
        ).then(function (ok) {
            if (ok) { changes = {}; updateBar(); }
            return ok;
        });
    }

    function switchLang(newLang) {
        if (newLang === lang) return;
        confirmDiscardIfDirty('Cambiando lingua le modifiche').then(function (ok) {
            if (!ok) return;
            onlyOut = false;
            // "lang" resta sulla lingua precedente finché il caricamento non è andato a buon
            // fine: se cambiasse subito e il caricamento fallisse, i campi ancora in vista
            // (della lingua precedente) verrebbero salvati con la lingua sbagliata.
            ensureLangLoaded(newLang).then(function (ok2) {
                if (!ok2) {
                    updateActiveChip();
                    deps.toast('Impossibile caricare questa lingua. Riprova.', 'error');
                    return;
                }
                lang = newLang;
                updateActiveChip();
                computeSections();
                if (!sections.some(function (s) { return s.id === cur; })) cur = firstSectionId();
                renderNav();
                renderFields();
                updatePreviewHeadAndSrc();
                updateBar();
            });
        });
    }

    function switchPage(newPage) {
        if (newPage === pageMode) return;
        confirmDiscardIfDirty('Cambiando pagina le modifiche').then(function (ok) {
            if (!ok) { pageSelectEl.value = pageMode; return; }
            pageMode = newPage;
            onlyOut = false;
            query = '';
            if (searchInput) searchInput.value = '';
            computeSections();
            cur = firstSectionId();
            renderNav();
            renderFields();
            updatePreviewHeadAndSrc();
            updateBar();
        });
    }

    // -----------------------------------------------------------------
    // Costruzione DOM statica
    // -----------------------------------------------------------------
    function buildSkeleton() {
        rootEl.innerHTML =
            '<div class="testi-app">' +
            '<nav class="testi-nav" aria-label="Sezioni"></nav>' +
            '<div class="testi-main">' +
            '<div class="testi-toolbar">' +
            '<input type="search" class="testi-search" placeholder="Cerca una frase del sito..." aria-label="Cerca">' +
            '<div class="testi-langs" role="group" aria-label="Lingua">' +
            '<button type="button" data-l="it">IT</button>' +
            '<button type="button" data-l="en">EN</button>' +
            '<button type="button" data-l="fr">FR</button>' +
            '<button type="button" data-l="de">DE</button>' +
            '</div>' +
            '<select class="testi-pagesel" aria-label="Pagina">' +
            '<option value="index">Home</option>' +
            '<option value="amici">Home, versione Amici</option>' +
            '</select>' +
            '<label class="testi-showkeys"><input type="checkbox" class="testi-showkeys-cb"> Mostra chiavi tecniche</label>' +
            '</div>' +
            '<div class="testi-fields"></div>' +
            '<div class="testi-savebar">' +
            '<span class="testi-status">Tutto pubblicato</span>' +
            '<span class="testi-savebar-grow"></span>' +
            '<button type="button" class="testi-btn testi-btn-undo" disabled>Annulla</button>' +
            '<button type="button" class="testi-btn testi-btn-primary testi-btn-save" disabled>Salva e pubblica</button>' +
            '</div>' +
            '</div>' +
            '<aside class="testi-preview">' +
            '<div class="testi-splitter" title="Trascina per cambiare la larghezza dell\'anteprima. Doppio clic per tornare alla larghezza iniziale."></div>' +
            '<div class="testi-preview-head"><span>Anteprima</span>&middot;<span class="testi-preview-page">Home</span>' +
            '<span class="testi-preview-modes"><button type="button" data-mode="desktop" title="Sito come si vede da computer, in scala">Desktop</button><button type="button" data-mode="mobile" title="Sito come si vede da telefono">Mobile</button></span></div>' +
            '<div class="testi-preview-body">' +
            '<iframe class="testi-preview-frame" title="Anteprima del sito"></iframe>' +
            '<div class="testi-preview-empty" hidden>Questa sezione non compare sul sito: sono testi che si vedono solo in certe situazioni.</div>' +
            '</div>' +
            '<div class="testi-preview-hint">Clicca una frase per aprire la casella corrispondente.</div>' +
            '</aside>' +
            '</div>';
    }

    function cacheRefs() {
        navEl = rootEl.querySelector('.testi-nav');
        fieldsEl = rootEl.querySelector('.testi-fields');
        searchInput = rootEl.querySelector('.testi-search');
        langChipsEl = rootEl.querySelector('.testi-langs');
        pageSelectEl = rootEl.querySelector('.testi-pagesel');
        showKeysToggle = rootEl.querySelector('.testi-showkeys-cb');
        statusEl = rootEl.querySelector('.testi-status');
        undoBtn = rootEl.querySelector('.testi-btn-undo');
        saveBtn = rootEl.querySelector('.testi-btn-save');
        previewFrame = rootEl.querySelector('.testi-preview-frame');
        previewPageLabel = rootEl.querySelector('.testi-preview-page');
        previewEmpty = rootEl.querySelector('.testi-preview-empty');
        previewHint = rootEl.querySelector('.testi-preview-hint');
        appEl = rootEl.querySelector('.testi-app');
        previewBody = rootEl.querySelector('.testi-preview-body');
        splitterEl = rootEl.querySelector('.testi-splitter');
        modesEl = rootEl.querySelector('.testi-preview-modes');
    }

    // -----------------------------------------------------------------
    // Proporzione campi/anteprima e modalità desktop in scala
    // -----------------------------------------------------------------
    function clampPreviewW(w) {
        var max = appEl ? (appEl.clientWidth - (navEl ? navEl.offsetWidth : 200) - 380) : 900;
        if (max < 300) max = 300;
        return Math.round(Math.max(300, Math.min(max, w)));
    }
    function applyPreviewLayout() {
        if (!appEl || !previewFrame) return;
        appEl.style.setProperty('--testi-preview-w', previewW + 'px');
        if (modesEl) {
            Array.prototype.forEach.call(modesEl.querySelectorAll('button'), function (b) {
                b.classList.toggle('testi-on', b.getAttribute('data-mode') === previewMode);
            });
        }
        var w = previewBody ? previewBody.clientWidth : 0;
        var h = previewBody ? previewBody.clientHeight : 0;
        if (previewMode === 'desktop' && w > 0 && h > 0) {
            var s = w / DESKTOP_W;
            previewFrame.style.width = DESKTOP_W + 'px';
            previewFrame.style.height = Math.round(h / s) + 'px';
            previewFrame.style.transform = 'scale(' + s + ')';
        } else {
            previewFrame.style.width = '';
            previewFrame.style.height = '';
            previewFrame.style.transform = '';
        }
    }
    function setPreviewMode(mode) {
        previewMode = mode === 'mobile' ? 'mobile' : 'desktop';
        try { localStorage.setItem(PREVIEW_MODE_KEY, previewMode); } catch (e) { /* ignora */ }
        applyPreviewLayout();
    }
    function wirePreviewLayout() {
        if (modesEl) {
            modesEl.addEventListener('click', function (e) {
                var b = e.target.closest('button[data-mode]');
                if (b) setPreviewMode(b.getAttribute('data-mode'));
            });
        }
        if (splitterEl) {
            var dragging = false, startX = 0, startW = 0;
            splitterEl.addEventListener('pointerdown', function (e) {
                e.preventDefault();
                dragging = true;
                startX = e.clientX;
                startW = previewW;
                appEl.classList.add('testi-dragging');
                try { splitterEl.setPointerCapture(e.pointerId); } catch (err) { /* ignora */ }
            });
            splitterEl.addEventListener('pointermove', function (e) {
                if (!dragging) return;
                previewW = clampPreviewW(startW + (startX - e.clientX));
                applyPreviewLayout();
            });
            function endDrag() {
                if (!dragging) return;
                dragging = false;
                appEl.classList.remove('testi-dragging');
                try { localStorage.setItem(PREVIEW_W_KEY, String(previewW)); } catch (err) { /* ignora */ }
            }
            splitterEl.addEventListener('pointerup', endDrag);
            splitterEl.addEventListener('pointercancel', endDrag);
            splitterEl.addEventListener('dblclick', function () {
                previewW = clampPreviewW(DEFAULT_PREVIEW_W);
                try { localStorage.setItem(PREVIEW_W_KEY, String(previewW)); } catch (err) { /* ignora */ }
                applyPreviewLayout();
            });
        }
        if (window.ResizeObserver && previewBody) {
            var lastW = -1, lastH = -1;
            new ResizeObserver(function () {
                var w = previewBody.clientWidth, h = previewBody.clientHeight;
                if (w === lastW && h === lastH) return;
                lastW = w; lastH = h;
                applyPreviewLayout();
            }).observe(previewBody);
        } else {
            window.addEventListener('resize', applyPreviewLayout);
        }
    }

    function wireStaticEvents() {
        searchInput.addEventListener('input', function (e) {
            query = e.target.value.trim();
            renderFields();
        });

        langChipsEl.addEventListener('click', function (e) {
            var btn = e.target.closest('button[data-l]');
            if (!btn) return;
            switchLang(btn.getAttribute('data-l'));
        });

        pageSelectEl.addEventListener('change', function (e) {
            switchPage(e.target.value);
        });

        showKeysToggle.addEventListener('change', function (e) {
            showKeys = e.target.checked;
            try { localStorage.setItem(SHOWKEYS_STORAGE_KEY, showKeys ? '1' : '0'); } catch (err) { /* ignora */ }
            rootEl.querySelector('.testi-app').classList.toggle('testi-show-keys', showKeys);
        });

        navEl.addEventListener('click', function (e) {
            var btn = e.target.closest('.testi-nav-item');
            if (!btn) return;
            var id = btn.getAttribute('data-s');
            if (id === cur && !query) return;
            cur = id;
            onlyOut = false;
            query = '';
            if (searchInput) searchInput.value = '';
            renderNav();
            renderFields();
            var sec = currentSectionObj();
            if (sec && sec.keys.length) sendHighlight(sec.keys[0].k, true);
        });

        fieldsEl.addEventListener('focusin', function (e) {
            var el = e.target.closest('.testi-textarea, .testi-array-item');
            if (!el) return;
            var field = el.closest('[data-key]');
            var key = field ? field.getAttribute('data-key') : null;
            if (!key) return;
            sendHighlight(key, true);
        });

        fieldsEl.addEventListener('input', function (e) {
            var target = e.target;
            if (target.classList.contains('testi-textarea')) handleTextareaInput(target);
            else if (target.classList.contains('testi-array-item')) handleArrayInput(target);
        });

        fieldsEl.addEventListener('click', function (e) {
            var boldBtn = e.target.closest('.testi-bold-btn');
            if (!boldBtn) {
                var filterOut = e.target.closest('.testi-filter-out');
                if (filterOut) { onlyOut = !onlyOut; renderFields(); }
                return;
            }
            e.preventDefault();
            var wrap = boldBtn.closest('.testi-editor-wrap');
            var ta = wrap.querySelector('.testi-textarea');
            wrapSelection(ta);
        });

        undoBtn.addEventListener('click', undoChanges);
        saveBtn.addEventListener('click', doSave);

        window.addEventListener('message', onWindowMessage);
        window.addEventListener('beforeunload', function (e) {
            if (Object.keys(changes).length) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
    }

    // -----------------------------------------------------------------
    // API pubblica
    // -----------------------------------------------------------------
    function init(rootElArg, depsArg) {
        deps = depsArg;
        if (initialized) return;
        initialized = true;
        rootEl = rootElArg;
        try { showKeys = localStorage.getItem(SHOWKEYS_STORAGE_KEY) === '1'; } catch (e) { showKeys = false; }
        try {
            var savedW = parseInt(localStorage.getItem(PREVIEW_W_KEY), 10);
            if (savedW > 0) previewW = savedW;
            var savedMode = localStorage.getItem(PREVIEW_MODE_KEY);
            if (savedMode === 'mobile' || savedMode === 'desktop') previewMode = savedMode;
        } catch (e) { /* ignora */ }
        buildSkeleton();
        cacheRefs();
        previewW = clampPreviewW(previewW);
        applyPreviewLayout();
        wirePreviewLayout();
        showKeysToggle.checked = showKeys;
        rootEl.querySelector('.testi-app').classList.toggle('testi-show-keys', showKeys);
        updateActiveChip();
        wireStaticEvents();
    }

    function open() {
        if (!initialized || dataLoaded) return;
        opened = true;
        fieldsEl.innerHTML = '<div class="testi-loading">Caricamento...</div>';
        loadMappingData().then(function () {
            var idxOpt = pageSelectEl.querySelector('option[value="index"]');
            var amiOpt = pageSelectEl.querySelector('option[value="amici"]');
            if (mapping.pages && mapping.pages.index && idxOpt) idxOpt.textContent = mapping.pages.index.title;
            if (mapping.pages && mapping.pages.amici && amiOpt) amiOpt.textContent = mapping.pages.amici.title;
            return ensureLangLoaded('it');
        }).then(function (ok) {
            if (!ok) {
                fieldsEl.innerHTML = '<div class="testi-empty">Impossibile caricare i testi. Riprova.</div>';
                return;
            }
            dataLoaded = true;
            computeSections();
            cur = firstSectionId();
            pageSelectEl.value = pageMode;
            updateActiveChip();
            renderNav();
            renderFields();
            updatePreviewHeadAndSrc();
            updateBar();
        });
    }

    function restoreFromFiles(l) {
        var names = { it: 'italiano', en: 'inglese', fr: 'francese', de: 'tedesco' };
        var name = names[l] || l;
        deps.confirmModal(
            'Ripristina i testi',
            'Questo sovrascrive tutti i testi in ' + esc(name) + ' con quelli dei file di partenza del sito. Le modifiche fatte da qui per questa lingua andranno perse. Continuare?',
            'Ripristina',
            true
        ).then(function (ok) {
            if (!ok) return;
            fetch('/lang/' + l + '.json', { cache: 'no-store' }).then(function (res) {
                if (!res.ok) throw new Error('file non trovato');
                return res.json();
            }).then(function (json) {
                return deps.apiFetch('/translations/seed', { method: 'POST', body: JSON.stringify({ lang: l, translations: json }) });
            }).then(function (res) {
                if (!res) return;
                if (!res.ok) { deps.toast('Errore nel ripristino dei testi.', 'error'); return; }
                deps.toast('Testi in ' + name + ' ripristinati dai file.', 'success');
                delete loadedLangs[l];
                if (!dataLoaded) return;
                // L'italiano è la base per sezioni e testo di riferimento in ogni lingua:
                // se viene ripristinato va sempre ricaricato, anche se si sta guardando un'altra lingua.
                var reloads = [];
                if (l === 'it') reloads.push(ensureLangLoaded('it', true));
                if (l === lang && l !== 'it') reloads.push(ensureLangLoaded(lang, true));
                if (!reloads.length) return;
                Promise.all(reloads).then(function (results) {
                    if (results.indexOf(false) !== -1) return;
                    if (l === lang) changes = {};
                    computeSections();
                    if (!sections.some(function (s) { return s.id === cur; })) cur = firstSectionId();
                    renderNav();
                    renderFields();
                    updateBar();
                });
            }).catch(function () {
                deps.toast('Errore nel caricamento del file dei testi.', 'error');
            });
        });
    }

    window.CasiaTesti = {
        init: init,
        open: open,
        restoreFromFiles: restoreFromFiles
    };
})();
