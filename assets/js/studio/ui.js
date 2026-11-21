// Shared admin pieces, built once (DESIGN 4.5): table, pagination, status chip, button, loading and error panels.
import { el, icon, setButtonLoading } from '../core/dom.js';
import { formatDate, t } from '../core/i18n.js';
import { toastError } from '../core/toast.js';

const STATUS_LABELS = {
    draft: 'statusDraft',
    pending_review: 'statusPending',
    published: 'statusPublished',
    rejected: 'statusRejected',
    replaced: 'statusReplaced',
};

export function statusChip(status) {
    const node = el('span', { className: `adm-status adm-status-${status}`, text: t(STATUS_LABELS[status] ?? status) });
    node.dataset.i18n = STATUS_LABELS[status] ?? '';
    return node;
}

export function dateText(iso) {
    return iso ? formatDate(new Date(iso)) : '-';
}

export function button(label, variant, onClick, { compact = true, attrs = {} } = {}) {
    return el('button', {
        className: `ui-btn ui-btn-${variant}${compact ? ' adm-btn-compact' : ''}`,
        text: label,
        attrs: { type: 'button', ...attrs },
        on: { click: onClick },
    });
}

/** A ui-check checkbox with an aria label. Returns the input (to read and listen to) and the node to place. */
export function checkbox(checked, label) {
    const input = el('input', { attrs: { type: 'checkbox', 'aria-label': label } });
    input.checked = checked;
    return {
        input,
        node: el('label', { className: 'ui-check' }, [input, el('span', { className: 'ui-check-box' }, [icon('ph-bold ph-check')])]),
    };
}

/**
 * Runs an action with the button in its loading state. Errors become a toast, unless onError(error) returns true
 * because it showed its own. Resolves to true on success.
 */
export async function runAction(trigger, action, onError = null) {
    if (trigger) setButtonLoading(trigger, true);
    try {
        await action();
        return true;
    } catch (error) {
        if (!onError?.(error)) toastError(error.message);
        return false;
    } finally {
        if (trigger?.isConnected) setButtonLoading(trigger, false);
    }
}

/** columns: [{ label, render(row) => node or text, className }]. On mobile each row becomes label and value pairs. */
export function dataTable(columns, rows) {
    const cell = (column, row) => {
        const value = column.render(row);
        const td = el('td', { className: column.className, attrs: { 'data-label': column.label } });
        td.append(value ?? '');
        return td;
    };
    return el('div', { className: 'adm-table-wrap' }, [
        el('table', { className: 'adm-table' }, [
            el('thead', {}, [el('tr', {}, columns.map((column) => el('th', { text: column.label, attrs: { scope: 'col' } })))]),
            el('tbody', {}, rows.map((row) => el('tr', {}, columns.map((column) => cell(column, row))))),
        ]),
    ]);
}

export function actionGroup(...buttons) {
    return el('div', { className: 'adm-actions' }, buttons);
}

const PAGE_WINDOW = 2;

/** Previous, page numbers, Next. Renders nothing for a single page. */
export function pagination(meta, onPage) {
    const lastPage = Math.max(1, Math.ceil(meta.total / meta.per_page));
    if (lastPage === 1) return null;
    const pages = [];
    for (let page = 1; page <= lastPage; page++) {
        if (page === 1 || page === lastPage || Math.abs(page - meta.page) <= PAGE_WINDOW) pages.push(page);
    }
    const numbers = [];
    pages.forEach((page, index) => {
        if (index > 0 && page - pages[index - 1] > 1) numbers.push(el('span', { className: 'adm-page-gap', text: '...', attrs: { 'aria-hidden': 'true' } }));
        numbers.push(el('button', {
            className: 'adm-page-btn',
            text: String(page),
            attrs: { type: 'button', 'aria-current': page === meta.page ? 'page' : null },
            on: { click: () => onPage(page) },
        }));
    });
    return el('nav', { className: 'adm-pagination', attrs: { 'aria-label': 'Pagination' } }, [
        button('Previous', 'ghost', () => onPage(meta.page - 1), { attrs: { disabled: meta.page <= 1 } }),
        ...numbers,
        button('Next', 'ghost', () => onPage(meta.page + 1), { attrs: { disabled: meta.page >= lastPage } }),
    ]);
}

export function emptyState(iconName, text) {
    return el('div', { className: 'ui-empty' }, [icon(`ph ${iconName}`), el('p', { text })]);
}

function skeleton() {
    return el('div', { className: 'adm-skeleton', attrs: { 'aria-busy': 'true' } }, Array.from({ length: 5 }, () => el('div', { className: 'ui-skeleton adm-skeleton-row' })));
}

/** Shows a skeleton, then what render returns. A failure shows the reason and a Retry. Stale answers are dropped. */
export function createLoader(container) {
    let token = 0;
    return async function load(fetchData, render, { keepContent = false } = {}) {
        const current = ++token;
        if (!keepContent) container.replaceChildren(skeleton());
        try {
            const data = await fetchData();
            if (current === token) container.replaceChildren(render(data));
        } catch (error) {
            if (current !== token) return;
            container.replaceChildren(el('div', { className: 'ui-empty' }, [
                icon('ph ph-warning-circle'),
                el('p', { text: error.message }),
                button('Retry', 'secondary', () => load(fetchData, render), { compact: false }),
            ]));
        }
    };
}
