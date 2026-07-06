/**
 * CASIA Country House - i18n Module
 * Multilingual support: IT, EN, FR, DE
 */
(function() {
    'use strict';

    const SUPPORTED_LANGS = ['it', 'en', 'fr', 'de'];
    const DEFAULT_LANG = 'it';
    const STORAGE_KEY = 'casia_lang';
    const API_BASE = '/api';

    let currentLang = DEFAULT_LANG;
    let translations = {};
    let currentPage = detectPage();

    function detectPage() {
        const path = window.location.pathname;
        if (path.includes('amici')) return 'amici';
        if (path.includes('naturale')) return 'naturale';
        return 'index';
    }

    function detectLang() {
        // 1. URL param ?lang=en
        const params = new URLSearchParams(window.location.search);
        const urlLang = params.get('lang');
        if (urlLang && SUPPORTED_LANGS.includes(urlLang)) return urlLang;

        // 2. localStorage
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && SUPPORTED_LANGS.includes(stored)) return stored;

        // 3. Browser language
        const browserLang = (navigator.language || '').split('-')[0].toLowerCase();
        if (SUPPORTED_LANGS.includes(browserLang)) return browserLang;

        // 4. Default
        return DEFAULT_LANG;
    }

    async function loadTranslations(lang) {
        if (lang === DEFAULT_LANG) {
            translations = {};
            return;
        }
        try {
            // Try API first (DB-backed translations)
            const res = await fetch(`${API_BASE}/translations?lang=${lang}`);
            if (res.ok) {
                translations = await res.json();
                return;
            }
        } catch (e) {
            // Fallback to static JSON
        }
        try {
            const res = await fetch(`lang/${lang}.json`);
            if (res.ok) {
                translations = await res.json();
                return;
            }
        } catch (e) {
            console.warn(`[i18n] Could not load translations for ${lang}`);
        }
        translations = {};
    }

    function resolve(key) {
        // 1. page-specific section (index.key or amici.key)
        if (translations[currentPage] && translations[currentPage][key] !== undefined) {
            return translations[currentPage][key];
        }
        // 2. common section
        if (translations.common && translations.common[key] !== undefined) {
            return translations.common[key];
        }
        return undefined;
    }

    /**
     * Translate a key with optional interpolation
     * Supports {name} placeholders and simple plurals with ||
     * Example: t('adults_count', {count: 2}) with value "{count} adulto||{count} adulti"
     */
    function t(key, params) {
        let value = resolve(key);
        if (value === undefined) return null;

        // Handle arrays (e.g. months_short)
        if (Array.isArray(value)) return value;

        // Handle plurals: "singular||plural" split by ||
        if (typeof value === 'string' && value.includes('||') && params) {
            const parts = value.split('||');
            const count = params.count !== undefined ? params.count : 1;
            value = count === 1 ? parts[0] : parts[1];
        }

        // Interpolate {param}
        if (typeof value === 'string' && params) {
            value = value.replace(/\{(\w+)\}/g, function(match, name) {
                return params[name] !== undefined ? params[name] : match;
            });
        }

        return value;
    }

    function translateDOM(root) {
        if (currentLang === DEFAULT_LANG) return; // Italian is inline in HTML

        const el = root || document;

        // data-i18n → textContent
        el.querySelectorAll('[data-i18n]').forEach(function(node) {
            const key = node.getAttribute('data-i18n');
            const val = t(key);
            if (val !== null) node.textContent = val;
        });

        // data-i18n-html → innerHTML
        el.querySelectorAll('[data-i18n-html]').forEach(function(node) {
            const key = node.getAttribute('data-i18n-html');
            const val = t(key);
            if (val !== null) node.innerHTML = val;
        });

        // data-i18n-placeholder → placeholder
        el.querySelectorAll('[data-i18n-placeholder]').forEach(function(node) {
            const key = node.getAttribute('data-i18n-placeholder');
            const val = t(key);
            if (val !== null) node.placeholder = val;
        });

        // data-i18n-alt → alt
        el.querySelectorAll('[data-i18n-alt]').forEach(function(node) {
            const key = node.getAttribute('data-i18n-alt');
            const val = t(key);
            if (val !== null) node.alt = val;
        });

        // data-i18n-aria → aria-label
        el.querySelectorAll('[data-i18n-aria]').forEach(function(node) {
            const key = node.getAttribute('data-i18n-aria');
            const val = t(key);
            if (val !== null) node.setAttribute('aria-label', val);
        });
    }

    function updateMeta() {
        document.documentElement.lang = currentLang;

        var desc = t('meta_description');
        if (desc) {
            var metaDesc = document.querySelector('meta[name="description"]');
            if (metaDesc) metaDesc.content = desc;
        }

        var ogDesc = t('og_description');
        if (ogDesc) {
            var metaOg = document.querySelector('meta[property="og:description"]');
            if (metaOg) metaOg.content = ogDesc;
        }

        var ogTitle = t('og_title');
        if (ogTitle) {
            var metaOgTitle = document.querySelector('meta[property="og:title"]');
            if (metaOgTitle) metaOgTitle.content = ogTitle;
        }
    }

    function updateSwitcher() {
        document.querySelectorAll('.lang-btn').forEach(function(btn) {
            btn.classList.toggle('active', btn.dataset.lang === currentLang);
        });
    }

    async function switchTo(lang) {
        if (!SUPPORTED_LANGS.includes(lang)) return;
        if (lang === currentLang && Object.keys(translations).length > 0) return;

        currentLang = lang;
        localStorage.setItem(STORAGE_KEY, lang);

        // Update URL without reload (remove ?lang param if present)
        var url = new URL(window.location);
        if (url.searchParams.has('lang')) {
            url.searchParams.delete('lang');
            window.history.replaceState({}, '', url);
        }

        await loadTranslations(lang);

        if (lang === DEFAULT_LANG) {
            // Restore original Italian HTML — simplest: reload page
            window.location.reload();
            return;
        }

        translateDOM();
        updateMeta();
        updateSwitcher();

        // Remove anti-FOUC cloak
        document.documentElement.classList.remove('i18n-loading');

        // Emit event for script.js to react
        window.dispatchEvent(new CustomEvent('langchange', { detail: { lang: lang } }));
    }

    function initSwitcher() {
        document.querySelectorAll('.lang-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                switchTo(this.dataset.lang);
            });
        });
    }

    async function init() {
        currentLang = detectLang();

        if (currentLang !== DEFAULT_LANG) {
            // Add anti-FOUC cloak
            document.documentElement.classList.add('i18n-loading');
        }

        initSwitcher();
        updateSwitcher();

        if (currentLang !== DEFAULT_LANG) {
            await loadTranslations(currentLang);
            translateDOM();
            updateMeta();
            document.documentElement.classList.remove('i18n-loading');
            window.dispatchEvent(new CustomEvent('langchange', { detail: { lang: currentLang } }));
        }
    }

    // Public API
    window.I18n = {
        t: t,
        switchTo: switchTo,
        getCurrentLang: function() { return currentLang; },
        translateDOM: translateDOM,
        init: init,
    };

    // Auto-init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
