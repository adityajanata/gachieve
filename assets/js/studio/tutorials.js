// All Tutorials (PRD 5.7, DESIGN 4.5): every achievement with its tutorial state.
import { apiGetPage, apiPost } from '../core/api.js';
import { byId, el, icon } from '../core/dom.js';
import { formatPerson, getLang, t } from '../core/i18n.js';
import { confirmDanger } from '../core/modal.js';
import { toastSuccess } from '../core/toast.js';
import { bootAdmin, renderOnLang } from './shell.js';
import { actionGroup, button, createLoader, dataTable, dateText, emptyState, pagination, runAction, statusChip } from './ui.js';

const SEARCH_DEBOUNCE_MS = 250;

const STATES = [
    ['', 'stateAll'],
    ['none', 'stateNone'],
    ['live', 'statusPublished'],
    ['draft', 'statusDraft'],
    ['pending_review', 'statusPending'],
    ['rejected', 'statusRejected'],
    ['locked', 'stateLocked'],
];

const { user, isAdmin } = await bootAdmin();
const root = byId('adm-root');
const state = { q: '', state: '', page: 1 };
const results = el('div', { className: 'adm-results' });
const load = createLoader(results);

function authorLine(author) {
    return el('span', { className: 'adm-author' }, [
        el('span', { text: author.display_name }),
        author.top_badge_title ? el('span', { className: 'ui-meta-chip', text: author.top_badge_title }) : null,
    ]);
}

function liveCell(row) {
    if (!row.live) return el('span', { className: 'adm-muted', text: '-' });
    return el('div', { className: 'adm-stack' }, [
        el('span', { text: `v${row.live.version_no} · ${dateText(row.live.published_at)}` }),
        authorLine(row.live.author),
    ]);
}

function openCell(row) {
    if (!row.open_version) return null;
    return el('div', { className: 'adm-stack' }, [statusChip(row.open_version.status), authorLine(row.open_version.author)]);
}

function lockCell(row) {
    if (!row.lock) return null;
    return el('span', { className: 'adm-lock' }, [icon('ph ph-lock-simple'), el('span', { text: row.lock.held_by_name })]);
}

async function withdraw(row, trigger) {
    const done = await runAction(trigger, () => apiPost('editor', 'withdraw', { version_id: row.open_version.version_id }));
    if (done) {
        toastSuccess(t('withdrawDone'));
        refresh();
    }
}

async function forceUnlock(row) {
    const confirmed = await confirmDanger({
        title: t('forceUnlockTitle'),
        text: t('forceUnlockWarning', { name: formatPerson(row.lock.held_by_name, row.lock.held_by_email) }),
        confirmLabel: 'Force Unlock',
    });
    if (!confirmed) return;
    if (await runAction(null, () => apiPost('admin', 'force_unlock', { tutorial_id: row.tutorial_id }))) {
        toastSuccess(t('forceUnlockDone'));
        refresh();
    }
}

async function deleteTutorial(row) {
    const confirmed = await confirmDanger({
        title: t('deleteTutorialTitle'),
        text: t('deleteTutorialWarning', { name: getLang() === 'id' ? row.name_id : row.name_en }),
        confirmLabel: 'Delete',
    });
    if (!confirmed) return;
    if (await runAction(null, () => apiPost('admin', 'delete_tutorial', { tutorial_id: row.tutorial_id }))) {
        toastSuccess(t('deleteTutorialDone'));
        refresh();
    }
}

function actionsCell(row) {
    const open = row.open_version;
    const pending = open?.status === 'pending_review';
    const mine = open?.owner_id === user.id;
    const blocked = (open && !mine && !isAdmin) || pending;

    const edit = el('a', {
        className: 'ui-btn ui-btn-ghost adm-btn-compact',
        text: 'Edit',
        attrs: { href: `studio/editor.php?achievement_id=${row.achievement_id}` },
    });
    return actionGroup(
        blocked ? null : edit,
        pending && mine ? button('Withdraw', 'ghost', (event) => withdraw(row, event.currentTarget)) : null,
        isAdmin && row.lock ? button('Force Unlock', 'danger', () => forceUnlock(row)) : null,
        isAdmin && (row.live || open) ? button('Delete', 'danger', () => deleteTutorial(row)) : null,
    );
}

function renderResults({ items, meta }) {
    if (items.length === 0) return emptyState('ph-book-open', t('tutorialsEmpty'));
    const table = dataTable([
        {
            label: t('colAchievement'),
            render: (row) => el('div', { className: 'adm-stack' }, [
                el('span', { className: 'adm-strong', text: row.name_id }),
                el('span', { className: 'adm-muted', text: row.name_en }),
            ]),
        },
        { label: t('colLive'), render: liveCell },
        { label: t('colOpenVersion'), render: openCell },
        { label: t('colLock'), render: lockCell },
        { label: t('colActions'), render: actionsCell },
    ], items);
    const wrap = el('div', { className: 'adm-results' }, [table, pagination(meta, (page) => {
        state.page = page;
        refresh();
    })]);
    return wrap;
}

function refresh() {
    load(() => apiGetPage('editor', 'list', { q: state.q, state: state.state, page: state.page }), renderResults);
}

function renderPage() {
    let timer = null;
    const search = el('div', { className: 'trk-search adm-search' }, [
        icon('ph ph-magnifying-glass'),
        el('input', {
            attrs: { type: 'search', value: state.q, placeholder: t('tutorialsSearch'), 'aria-label': t('tutorialsSearch'), autocomplete: 'off' },
            on: {
                input: (event) => {
                    clearTimeout(timer);
                    timer = setTimeout(() => {
                        state.q = event.target.value;
                        state.page = 1;
                        refresh();
                    }, SEARCH_DEBOUNCE_MS);
                },
            },
        }),
    ]);
    const chips = el('div', { className: 'adm-chip-row', attrs: { role: 'group', 'aria-label': t('colStatus') } }, STATES.map(([value, label]) => el('button', {
        className: 'ui-chip',
        text: t(label),
        attrs: { type: 'button', 'aria-current': String(state.state === value) },
        on: {
            click: () => {
                state.state = value;
                state.page = 1;
                renderPage();
            },
        },
    })));
    root.replaceChildren(el('div', { className: 'adm-toolbar' }, [search, chips]), results);
    refresh();
}

renderOnLang(renderPage);
