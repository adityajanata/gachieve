// What every Studio page shares: labels, theme, language, the account menu, the mobile nav and the flash toast.
import { byId, el, initHeaderShadow } from '../core/dom.js';
import { applyLabels, initLangToggle, onLangChange } from '../core/i18n.js';
import { openDialog } from '../core/modal.js';
import { readStored, writeStored } from '../core/storage.js';
import { initSky } from '../core/sky.js';
import { initTheme } from '../core/theme.js';
import { toastSuccess } from '../core/toast.js';
import { createAccount } from '../tracker/account.js';

const FLASH_KEY = 'adminFlash';

function goTracker() {
    window.location.assign(document.baseURI);
}

/** Moves to another Studio page and shows the toast there. */
export function leaveWithToast(path, message) {
    writeStored(FLASH_KEY, message);
    window.location.assign(new URL(path, document.baseURI).href);
}

function showFlash() {
    const message = readStored(FLASH_KEY);
    if (message) {
        writeStored(FLASH_KEY, null);
        toastSuccess(message);
    }
}

function initMobileNav() {
    byId('adm-menu-open').addEventListener('click', () => {
        const links = byId('adm-nav').cloneNode(true);
        links.removeAttribute('id');
        openDialog({ title: 'Studio', body: el('div', {}, [links]) });
    });
}

/** Resolves to the page context once the session is known. The page shell has already checked the role on the server. */
export async function bootAdmin() {
    applyLabels();
    initTheme(byId('ui-theme-toggle'));
    initSky();
    initLangToggle(byId('ui-lang-toggle'));
    initHeaderShadow();
    initMobileNav();

    const account = createAccount({ onSignedIn: () => {}, onSignedOut: goTracker });
    const user = await account.boot();
    if (!user) {
        goTracker();
        return new Promise(() => {});
    }
    showFlash();
    return {
        user,
        isAdmin: user.role === 'administrator',
        handleSessionError: (error) => account.handleSessionError(error),
    };
}

/** Runs a page's render now and again whenever the language changes. */
export function renderOnLang(render) {
    onLangChange(render);
    render();
}
