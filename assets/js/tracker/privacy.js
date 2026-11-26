// Privacy page wiring: the shared header controls only. The text for both languages is in the page.
import { byId, initHeaderShadow } from '../core/dom.js';
import { applyLabels, getLang, initLangToggle, onLangChange } from '../core/i18n.js';
import { initSky } from '../core/sky.js';
import { initTheme } from '../core/theme.js';

const titles = { id: 'Kebijakan Privasi', en: 'Privacy Policy' };
const siteName = document.title.split(' | ').pop();

function paintTitle(lang) {
    document.title = `${titles[lang]} | ${siteName}`;
}

applyLabels();
initTheme(byId('ui-theme-toggle'));
initSky();
initLangToggle(byId('ui-lang-toggle'));
initHeaderShadow();
paintTitle(getLang());
onLangChange(paintTitle);
