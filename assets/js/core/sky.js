// The living sky behind every page: stars that twinkle at night, clouds that drift by day.
// Each star and cloud gets its own random tempo, so the sky never pulses in step.
// Everything stops under prefers-reduced-motion (the CSS sets the animations to none).
import { el } from './dom.js';
import { onThemeChange } from './theme.js';

// svg-clouds (MIT, Ethan Morrill-Ploum): SVG filter clouds. Its own shape animation stays off; CSS moves the clouds.
const CLOUD_SCRIPT = {
    src: 'https://cdn.jsdelivr.net/npm/svg-clouds@1.0.1/src/index.js',
    integrity: 'sha384-1uf9A+dwyA6SD19ic36kkv6J6YPXYbSxnJ2RqcUD8TYw49d9QfiY6khHzek2Sb34',
};
const CLOUD_LAYERS = ['back', 'mid', 'front'];

const SMALL_SCREEN = window.matchMedia('(max-width: 767px)');
// Every star twinkles, so these counts alone set how full the night sky looks.
const COUNTS = { stars: [150, 75], clouds: [4, 2] }; // [wider screens, phones]

let cloudScript = null;
let sky = null;
let build = 0;

const random = (min, max) => min + Math.random() * (max - min);
const count = (kind) => COUNTS[kind][SMALL_SCREEN.matches ? 1 : 0];

/** Three tempos: a few very slow stars, most at an easy pace, a few quick ones. Some burn bright. */
function star() {
    const tempo = Math.random();
    const duration = tempo < 0.3 ? random(7, 14) : tempo < 0.85 ? random(2.5, 5) : random(0.9, 1.8);
    const bright = Math.random() < 0.12;
    const size = bright ? random(2.6, 3.6) : random(1, 2.2);
    const node = el('span', { className: bright ? 'ui-star is-bright' : 'ui-star' });
    node.style.cssText = [
        `left: ${random(0, 100).toFixed(2)}%`,
        `top: ${random(0, 100).toFixed(2)}%`,
        `width: ${size.toFixed(1)}px`,
        `height: ${size.toFixed(1)}px`,
        `--twinkle: ${duration.toFixed(2)}s`,
        `--delay: -${random(0, duration).toFixed(2)}s`,
        `--peak: ${bright ? 1 : random(0.45, 0.9).toFixed(2)}`,
    ].join('; ');
    return node;
}

function loadCloudScript() {
    cloudScript ??= new Promise((resolve, reject) => {
        if (customElements.get('svg-cloud')) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = CLOUD_SCRIPT.src;
        script.integrity = CLOUD_SCRIPT.integrity;
        script.crossOrigin = 'anonymous';
        script.addEventListener('load', () => resolve());
        script.addEventListener('error', () => reject(new Error('Cloud script failed to load')));
        document.head.append(script);
    });
    return cloudScript;
}

/** One cloud: a lane that drifts across the sky, holding svg-clouds' three layers. */
async function cloud(container) {
    const drift = random(80, 150);
    const lane = el('div', { className: 'ui-cloud' });
    lane.style.cssText = [
        `top: ${random(2, 62).toFixed(1)}%`,
        `--drift: ${drift.toFixed(1)}s`,
        `--delay: -${random(0, drift).toFixed(1)}s`,
        `--scale: ${random(0.6, 1.1).toFixed(2)}`,
        `--x: ${random(-10, 90).toFixed(1)}vw`,
    ].join('; ');
    const body = document.createElement('svg-cloud');
    body.className = 'ui-cloud-body';
    lane.append(body);
    container.append(lane);

    // svg-clouds builds a part's filter from a MutationObserver on its parent, so the parent is connected first.
    const parts = CLOUD_LAYERS.map((layer) => {
        const part = document.createElement('svg-cloud-part');
        part.className = `ui-cloud-${layer}`;
        body.append(part);
        return part;
    });
    await Promise.resolve();
    const seed = Math.floor(random(1, 1000));
    parts.forEach((part) => {
        if (part.hasAttribute('data-uuid')) part.options = { animate: false, seed };
    });
}

async function fill() {
    const current = ++build;
    sky.replaceChildren();
    if (document.documentElement.dataset.theme === 'dark') {
        sky.append(...Array.from({ length: count('stars') }, star));
        return;
    }
    // The filter needs crypto.randomUUID, which only secure origins (https, localhost) have.
    if (!window.crypto?.randomUUID) return;
    try {
        await loadCloudScript();
    } catch (error) {
        console.error(error);
        return;
    }
    if (current !== build) return;
    for (let index = 0; index < count('clouds'); index++) {
        await cloud(sky);
    }
}

export function initSky() {
    const page = document.querySelector('.ui-page');
    if (!page || sky) return;
    sky = el('div', { className: 'ui-sky', attrs: { 'aria-hidden': 'true' } });
    page.prepend(sky);
    onThemeChange(fill);
    SMALL_SCREEN.addEventListener('change', fill);
    fill();
}
