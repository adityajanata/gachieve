import { readStored, writeStored } from './storage.js';
import { labels as id } from '../i18n/labels.id.js';
import { labels as en } from '../i18n/labels.en.js';

const dictionaries = { id, en };
const locales = { id: 'id-ID', en: 'en-US' };
const listeners = new Set();

let lang = readStored('lang') === 'en' ? 'en' : 'id';

export function getLang() {
    return lang;
}

export function t(key, vars = {}) {
    const text = dictionaries[lang][key] ?? key;
    return text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? vars[name] : match));
}

export function formatNumber(value) {
    return new Intl.NumberFormat(locales[lang]).format(value);
}

/** 12 Okt 2026 / 12 Oct 2026, in the viewer's local time. */
export function formatDate(timestamp) {
    return new Intl.DateTimeFormat(lang === 'id' ? 'id-ID' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(timestamp);
}

/** "Name (email)" for messages that mention a person; the name alone when the email is unknown. */
export function formatPerson(name, email) {
    return email ? `${name} (${email})` : name;
}

export function formatRatio(done, total) {
    return `${formatNumber(done)}/${formatNumber(total)}`;
}

/** Static shell text is marked with data-i18n, data-i18n-placeholder and data-i18n-aria. */
export function applyLabels(root = document) {
    document.documentElement.lang = lang;
    root.querySelectorAll('[data-i18n]').forEach((node) => {
        node.textContent = t(node.dataset.i18n);
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
        node.placeholder = t(node.dataset.i18nPlaceholder);
    });
    root.querySelectorAll('[data-i18n-aria]').forEach((node) => {
        node.setAttribute('aria-label', t(node.dataset.i18nAria));
    });
}

/** 12:04, in the viewer's local time. */
export function formatTime(timestamp) {
    return new Intl.DateTimeFormat(locales[lang], { hour: '2-digit', minute: '2-digit', hour12: false }).format(timestamp);
}

export function setLang(next) {
    if (next === lang || !dictionaries[next]) return;
    lang = next;
    writeStored('lang', lang);
    applyLabels();
    listeners.forEach((listener) => listener(lang));
}

export function onLangChange(listener) {
    listeners.add(listener);
}

/** Wires the ID | EN toggle in the header. */
export function initLangToggle(toggle) {
    const buttons = [...toggle.querySelectorAll('button')];
    const paint = () => buttons.forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.lang === lang));
    });
    toggle.addEventListener('click', (event) => {
        const next = event.target.closest('button')?.dataset.lang;
        if (next) setLang(next);
    });
    onLangChange(paint);
    paint();
}
