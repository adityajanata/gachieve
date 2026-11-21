// Small DOM builder. User and data text always goes through textContent.

export function el(tag, { className, text, attrs, on } = {}, children = []) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    for (const [name, value] of Object.entries(attrs ?? {})) {
        if (value !== null && value !== undefined && value !== false) {
            node.setAttribute(name, value === true ? '' : String(value));
        }
    }
    for (const [name, handler] of Object.entries(on ?? {})) {
        node.addEventListener(name, handler);
    }
    node.append(...children.filter(Boolean));
    return node;
}

export function icon(classes) {
    return el('i', { className: classes, attrs: { 'aria-hidden': 'true' } });
}

/** The Primogem mark next to every reward. Decorative: the number beside it carries the meaning. */
export function primogem() {
    return el('img', {
        className: 'ui-primogem',
        attrs: { src: 'assets/img/primogem.png', alt: '', width: 58, height: 58, decoding: 'async', 'aria-hidden': 'true' },
    });
}

/** Loading state (DESIGN 3.1): a spinner replaces the label and the button keeps its width. */
export function setButtonLoading(button, loading) {
    if (loading) {
        button.style.minWidth = `${button.offsetWidth}px`;
        button.dataset.label = button.textContent;
        button.replaceChildren(icon('ph ph-circle-notch ui-spin'));
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
    } else {
        button.textContent = button.dataset.label;
        button.style.minWidth = '';
        button.disabled = false;
        button.removeAttribute('aria-busy');
    }
}

export function byId(id) {
    return document.getElementById(id);
}

/** The sticky header gets its shadow once the page has scrolled. */
export function initHeaderShadow() {
    const header = byId('ui-header');
    const sentinel = el('div', { attrs: { 'aria-hidden': 'true' } });
    header.before(sentinel);
    new IntersectionObserver(([entry]) => {
        header.classList.toggle('is-stuck', !entry.isIntersecting);
    }).observe(sentinel);
}
