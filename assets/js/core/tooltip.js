// Hover and focus tooltips through tippy.js, styled by the ui theme in app.css. Content is plain text, never HTML.
import { onLangChange } from './i18n.js';

/**
 * Attaches a tooltip to an element. getText runs again when the language changes.
 * The element gets tabindex 0 when it is not focusable, so keyboard users reach the tooltip too.
 */
export function tooltip(element, getText) {
    const tippy = window.tippy;
    if (!tippy) return null;
    if (!element.matches('a[href], button, input, select, textarea, [tabindex]')) element.tabIndex = 0;
    const instance = tippy(element, {
        content: getText(),
        allowHTML: false,
        theme: 'ui',
        animation: false,
        arrow: false,
        delay: [200, 0],
        maxWidth: 280,
        placement: 'bottom',
        trigger: 'mouseenter focus',
        touch: ['hold', 400],
    });
    onLangChange(() => instance.setContent(getText()));
    return instance;
}
