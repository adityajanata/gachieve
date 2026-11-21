import { readStored, writeStored } from './storage.js';

const root = document.documentElement;
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
const listeners = new Set();

function apply(theme, button) {
    root.dataset.theme = theme;
    button.querySelector('i').className = theme === 'dark' ? 'ph ph-sun' : 'ph ph-moon';
    listeners.forEach((listener) => listener(theme));
}

export function onThemeChange(listener) {
    listeners.add(listener);
}

/** The first theme is already set by theme-init.js. This wires the toggle and follows the system until the user picks. */
export function initTheme(button) {
    apply(root.dataset.theme, button);
    button.addEventListener('click', () => {
        const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
        writeStored('theme', next);
        apply(next, button);
    });
    systemDark.addEventListener('change', (event) => {
        if (!readStored('theme')) apply(event.matches ? 'dark' : 'light', button);
    });
}
