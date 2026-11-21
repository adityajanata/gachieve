// Audit Log (PRD 8, API 5.3): who did what, from the actor name snapshot.
import { apiGetPage } from '../core/api.js';
import { byId, el } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { bootAdmin, renderOnLang } from './shell.js';
import { createLoader, dataTable, dateText, emptyState, pagination } from './ui.js';

const ACTIONS = ['role_change', 'account_disable', 'account_enable', 'account_delete', 'force_unlock', 'tutorial_delete', 'points_settings_change', 'image_cleanup'];

await bootAdmin();
const root = byId('adm-root');
const results = el('div', { className: 'adm-results' });
const load = createLoader(results);
const state = { filter_action: '', page: 1 };

function renderResults({ items, meta }) {
    if (items.length === 0) return emptyState('ph-clock-counter-clockwise', t('auditEmpty'));
    return el('div', { className: 'adm-results' }, [
        dataTable([
            { label: t('colDate'), render: (row) => dateText(row.created_at) },
            { label: t('colUser'), render: (row) => row.actor_name },
            { label: t('colAction'), render: (row) => t(`audit_${row.action}`) },
            { label: t('colTarget'), render: (row) => (row.target_type ? `${row.target_type} #${row.target_id ?? '-'}` : '-') },
            { label: t('colDetail'), className: 'adm-detail', render: (row) => (row.detail ? JSON.stringify(row.detail) : '-') },
        ], items),
        pagination(meta, (page) => {
            state.page = page;
            refresh();
        }),
    ]);
}

function refresh() {
    load(() => apiGetPage('admin', 'audit', state), renderResults);
}

function renderPage() {
    const filter = el('select', {
        className: 'ui-select adm-select',
        attrs: { 'aria-label': t('colAction') },
        on: {
            change: (event) => {
                state.filter_action = event.target.value;
                state.page = 1;
                refresh();
            },
        },
    }, [
        el('option', { text: t('allActions'), attrs: { value: '' } }),
        ...ACTIONS.map((action) => el('option', { text: t(`audit_${action}`), attrs: { value: action, selected: action === state.filter_action } })),
    ]);
    root.replaceChildren(el('div', { className: 'adm-toolbar' }, [filter]), results);
    refresh();
}

renderOnLang(renderPage);
