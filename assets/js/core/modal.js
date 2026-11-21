// Shared dialog: modal on desktop, bottom sheet on mobile. Traps focus, closes on Esc and backdrop click, and returns focus.
import { el, icon } from './dom.js';
import { dialogIn, dialogOut } from './motion.js';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]';

const DRAG_CLOSE_PX = 80;

let openCount = 0;

export function isDialogOpen() {
    return openCount > 0;
}

// Titles always go through titleText: SweetAlert2 parses `title` as HTML, and some titles carry admin-set text.
function popupOptions() {
    return {
        customClass: { popup: 'ui-swal-popup', confirmButton: 'ui-btn ui-btn-danger-fill', cancelButton: 'ui-btn ui-btn-secondary', actions: 'ui-swal-actions' },
        buttonsStyling: false,
        icon: 'warning',
        iconHtml: '<i class="ph-fill ph-warning-circle" aria-hidden="true"></i>',
        showClass: { popup: 'ui-swal-in' },
        hideClass: { popup: 'ui-swal-out' },
    };
}

/** The same popup with a calm icon and an accent main button, for anything that is not destructive. */
function calmOptions(iconClasses = 'ph-fill ph-info') {
    const base = popupOptions();
    return {
        ...base,
        icon: 'info',
        iconHtml: `<i class="${iconClasses}" aria-hidden="true"></i>`,
        customClass: {
            ...base.customClass,
            icon: 'ui-swal-icon',
            confirmButton: 'ui-btn ui-btn-primary',
            denyButton: 'ui-btn ui-btn-secondary',
        },
    };
}

export function alertInfo({ title, text }) {
    return window.Swal?.fire({ ...calmOptions(), titleText: title, text, confirmButtonText: 'OK' });
}

/** Resolves to true when confirmed. */
export async function confirmAction({ title, text, confirmLabel }) {
    const Swal = window.Swal;
    if (!Swal) return false;
    const result = await Swal.fire({
        ...calmOptions(),
        titleText: title,
        text,
        showCancelButton: true,
        reverseButtons: true,
        confirmButtonText: confirmLabel,
        cancelButtonText: 'Cancel',
    });
    return result.isConfirmed;
}

/** Required text prompt. Resolves to the trimmed text, or null when cancelled. */
export async function promptText({ title, label, confirmLabel, maxLength }) {
    const Swal = window.Swal;
    if (!Swal) return null;
    const result = await Swal.fire({
        ...popupOptions(),
        icon: undefined,
        iconHtml: undefined,
        titleText: title,
        input: 'textarea',
        inputLabel: label,
        inputAttributes: { maxlength: String(maxLength), rows: '4' },
        showCancelButton: true,
        reverseButtons: true,
        confirmButtonText: confirmLabel,
        cancelButtonText: 'Cancel',
        inputValidator: (value) => (value.trim() === '' ? 'This field is required.' : null),
    });
    return result.isConfirmed ? result.value.trim() : null;
}

/** Lock warning with a live countdown (DESIGN 3.8). Resolves to 'keep', 'close', or null when closed from code. */
export async function lockWarning({ title, renderText }) {
    const Swal = window.Swal;
    if (!Swal) return 'keep';
    let timer = null;
    const result = await Swal.fire({
        ...calmOptions('ph-fill ph-warning'),
        titleText: title,
        text: renderText(),
        showDenyButton: true,
        allowOutsideClick: false,
        allowEscapeKey: false,
        confirmButtonText: 'Keep editing',
        denyButtonText: 'Save and close',
        didOpen: () => {
            timer = setInterval(() => {
                Swal.getHtmlContainer().textContent = renderText();
            }, 1000);
        },
        willClose: () => clearInterval(timer),
    });
    if (result.isConfirmed) return 'keep';
    return result.isDenied ? 'close' : null;
}

/** Lock lost (DESIGN 3.8). Copy keeps the popup open. Resolves to true for Reopen. */
/** A blue info callout for popups: icon plus plain text. */
function infoCallout(text) {
    return el('div', { className: 'ui-banner ui-banner-info', attrs: { role: 'note' } }, [icon('ph-fill ph-info'), el('p', { text })]);
}

/** callout (optional) adds a blue info box under the text, for example after the lock timed out. */
export async function lockLost({ text, onCopy, callout = null }) {
    const Swal = window.Swal;
    if (!Swal) return false;
    const body = callout ? { html: el('div', { className: 'ui-swal-stack' }, [el('p', { text }), infoCallout(callout)]) } : { text };
    const result = await Swal.fire({
        ...calmOptions('ph-fill ph-warning'),
        ...body,
        showDenyButton: true,
        allowOutsideClick: false,
        allowEscapeKey: false,
        confirmButtonText: 'Reopen',
        denyButtonText: 'Copy text',
        preDeny: () => {
            onCopy();
            return false;
        },
    });
    return result.isConfirmed;
}

/** New badge popup (DESIGN 3.8). */
export function badgeNotice({ title, text, iconClasses }) {
    return window.Swal?.fire({ ...calmOptions(iconClasses), titleText: title, text, confirmButtonText: 'OK' });
}

export function closePopup() {
    window.Swal?.close();
}

/** Destructive confirmation: the destructive button sits on the right. Resolves to true when confirmed. */
export async function confirmDanger({ title, text, confirmLabel }) {
    const Swal = window.Swal;
    if (!Swal) return false;
    const result = await Swal.fire({
        ...popupOptions(),
        titleText: title,
        text,
        showCancelButton: true,
        reverseButtons: true,
        confirmButtonText: confirmLabel,
        cancelButtonText: 'Cancel',
        focusCancel: true,
    });
    return result.isConfirmed;
}

export function alertDanger(text) {
    window.Swal?.fire({ ...popupOptions(), text, confirmButtonText: 'OK' });
}

/** Bottom sheet handle: drag down past the threshold to close. The close button and Esc are the non-pointer paths. */
function enableDragToClose(handle, panel, close) {
    let startY = null;
    handle.addEventListener('pointerdown', (event) => {
        startY = event.clientY;
        handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener('pointermove', (event) => {
        if (startY === null) return;
        panel.style.transform = `translateY(${Math.max(0, event.clientY - startY)}px)`;
    });
    const finish = (event) => {
        if (startY === null) return;
        const distance = event.clientY - startY;
        startY = null;
        if (event.type === 'pointerup' && distance > DRAG_CLOSE_PX) {
            close();
        } else {
            panel.style.transform = '';
        }
    };
    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', finish);
}

/** kind: 'modal' (modal on desktop, bottom sheet on mobile) or 'drawer' (right drawer on desktop, full screen on mobile). */
export function openDialog({ title, subtitle, body, footer, kind = 'modal', onClose }) {
    const drawer = kind === 'drawer';
    const axis = drawer && window.matchMedia('(min-width: 768px)').matches ? 'x' : 'y';
    const trigger = document.activeElement;
    const titleId = 'ui-dialog-title';

    const closeButton = el('button', {
        className: 'ui-icon-btn',
        attrs: { type: 'button', 'aria-label': 'Close' },
        on: { click: () => close() },
    }, [icon('ph ph-x')]);

    const handle = drawer ? null : el('div', { className: 'ui-dialog-handle', attrs: { 'aria-hidden': 'true' } });

    const panel = el('div', {
        className: `ui-dialog${drawer ? ' ui-dialog-drawer' : ''}`,
        attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
    }, [
        handle,
        el('div', { className: 'ui-dialog-head' }, [
            el('div', {}, [
                el('h2', { className: 'ui-dialog-title', text: title, attrs: { id: titleId } }),
                subtitle ? el('p', { className: 'ui-dialog-subtitle', text: subtitle }) : null,
            ]),
            closeButton,
        ]),
        el('div', { className: 'ui-dialog-body' }, [body]),
        footer ? el('div', { className: 'ui-dialog-foot' }, [footer]) : null,
    ]);

    const backdrop = el('div', { className: 'ui-dialog-backdrop', on: { click: () => close() } });
    const root = el('div', { className: `ui-dialog-root${drawer ? ' ui-dialog-root-drawer' : ''}` }, [backdrop, panel]);

    function onKeydown(event) {
        // A confirmation popup above this dialog handles its own keys.
        if (event.target.closest?.('.swal2-container')) return;
        if (event.key === 'Escape') {
            close();
            return;
        }
        if (event.key !== 'Tab') return;
        const items = [...panel.querySelectorAll(FOCUSABLE)].filter((item) => item.offsetParent !== null);
        const first = items[0];
        const last = items[items.length - 1];
        // The page behind is not inert (that costs a full style pass on a long list), so focus must never leave.
        if (!panel.contains(document.activeElement)) {
            event.preventDefault();
            first.focus();
        } else if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    let closing = null;
    /** Resolves when the dialog is gone and focus is back, so another dialog can open cleanly after it. */
    function close() {
        closing ??= new Promise((resolve) => {
            document.removeEventListener('keydown', onKeydown);
            dialogOut(backdrop, panel, axis, () => {
                onClose?.();
                root.remove();
                openCount--;
                if (openCount === 0) {
                    document.body.classList.remove('ui-scroll-lock');
                    document.body.style.paddingRight = '';
                }
                trigger?.focus?.();
                resolve();
            });
        });
        return closing;
    }

    if (handle) enableDragToClose(handle, panel, close);
    // The page keeps its width when the scrollbar goes away, and overlays still reach the screen edge.
    document.body.style.paddingRight = `${window.innerWidth - document.documentElement.clientWidth}px`;
    document.body.append(root);
    document.body.classList.add('ui-scroll-lock');
    openCount++;
    document.addEventListener('keydown', onKeydown);
    closeButton.focus();
    dialogIn(backdrop, panel, axis);

    return close;
}
