// Round profile picture with the first letter underneath, which stays when there is no picture or it fails to load.
import { el } from './dom.js';

/** size is one of the .ui-avatar-N classes in app.css: 32, 40 or 48. */
export function avatar({ name, url, size }) {
    const fallback = el('span', {
        className: 'ui-avatar-letter',
        text: name.charAt(0).toUpperCase(),
        attrs: { 'aria-hidden': 'true' },
    });
    const node = el('span', { className: `ui-avatar ui-avatar-${size}` }, [fallback]);
    if (url) {
        node.append(el('img', {
            attrs: { src: url, alt: '', width: size, height: size, referrerpolicy: 'no-referrer' },
            on: { error: (event) => event.target.remove() },
        }));
    }
    return node;
}
