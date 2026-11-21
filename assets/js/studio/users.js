// Users (PRD 5.7, 5.9, API 5.1): roles, disable and delete. An Administrator cannot act on their own account.
import { apiGetPage, apiPost } from '../core/api.js';
import { avatar } from '../core/avatar.js';
import { byId, el, icon } from '../core/dom.js';
import { formatNumber, formatPerson, t } from '../core/i18n.js';
import { confirmDanger } from '../core/modal.js';
import { toastSuccess } from '../core/toast.js';
import { bootAdmin, renderOnLang } from './shell.js';
import { actionGroup, button, createLoader, dataTable, dateText, emptyState, pagination, runAction } from './ui.js';

const ROLES = ['traveler', 'contributor', 'administrator'];
const SEARCH_DEBOUNCE_MS = 250;

const { user: me } = await bootAdmin();
const root = byId('adm-root');
const results = el('div', { className: 'adm-results' });
const load = createLoader(results);
const state = { q: '', role: '', active: '', page: 1 };

const roleLabel = (role) => t(`role_${role}`);

function select(id, value, options, onChange, ariaLabel) {
    return el('select', {
        className: 'ui-select adm-select',
        attrs: { id, 'aria-label': ariaLabel },
        on: { change: (event) => onChange(event.target.value, event.target) },
    }, options.map(([optionValue, label]) => el('option', {
        text: label,
        attrs: { value: optionValue, selected: optionValue === value },
    })));
}

async function changeRole(row, role, control) {
    const done = await runAction(null, () => apiPost('users', 'set_role', { user_id: row.id, role }));
    if (done) {
        row.role = role;
        toastSuccess(t('roleChanged', { name: formatPerson(row.display_name, row.email), role: roleLabel(role) }));
    } else {
        control.value = row.role;
    }
}

async function setActive(row, active) {
    if (!active) {
        const confirmed = await confirmDanger({
            title: t('disableTitle'),
            text: t('disableWarning', { name: formatPerson(row.display_name, row.email) }),
            confirmLabel: 'Disable',
        });
        if (!confirmed) return;
    }
    if (await runAction(null, () => apiPost('users', 'set_active', { user_id: row.id, active }))) refresh();
}

async function deleteUser(row) {
    const confirmed = await confirmDanger({
        title: t('deleteUserTitle'),
        text: t('deleteUserWarning', { name: formatPerson(row.display_name, row.email) }),
        confirmLabel: 'Delete',
    });
    if (!confirmed) return;
    if (await runAction(null, () => apiPost('users', 'delete', { user_id: row.id }))) {
        toastSuccess(t('deleteUserDone'));
        refresh();
    }
}

function renderResults({ items, meta }) {
    if (items.length === 0) return emptyState('ph-users', t('usersEmpty'));
    return el('div', { className: 'adm-results' }, [
        dataTable([
            {
                label: t('colUser'),
                render: (row) => el('div', { className: 'adm-user' }, [
                    avatar({ name: row.display_name, url: row.avatar_url, size: 32 }),
                    el('div', { className: 'adm-stack' }, [
                        el('span', { className: 'adm-user-name' }, [
                            el('span', { className: 'adm-strong', text: row.display_name }),
                            row.top_badge_title ? el('span', { className: 'ui-meta-chip', text: row.top_badge_title }) : null,
                        ]),
                        el('span', { className: 'adm-muted', text: row.email }),
                    ]),
                ]),
            },
            {
                label: t('colRole'),
                // Your own role and the agent's role are fixed (Decisions Log 62).
                render: (row) => (row.id === me.id || row.is_agent
                    ? roleLabel(row.role)
                    : select(`adm-role-${row.id}`, row.role, ROLES.map((role) => [role, roleLabel(role)]), (role, control) => changeRole(row, role, control), t('colRole'))),
            },
            { label: t('colPoints'), render: (row) => formatNumber(row.points) },
            {
                label: t('colStatus'),
                render: (row) => el('div', { className: 'adm-stack' }, [
                    el('span', { text: t(row.is_active ? 'userActive' : 'userDisabled') }),
                    el('span', { className: 'adm-muted', text: t('userJoined', { date: dateText(row.created_at) }) }),
                    el('span', { className: 'adm-muted', text: t('userLastLogin', { date: dateText(row.last_login_at) }) }),
                ]),
            },
            {
                label: t('colActions'),
                render: (row) => (row.id === me.id ? null : actionGroup(
                    button(row.is_active ? 'Disable' : 'Enable', row.is_active ? 'danger' : 'ghost', () => setActive(row, !row.is_active)),
                    // The agent is never deleted; Disable is its off switch.
                    row.is_agent ? null : button('Delete', 'danger', () => deleteUser(row)),
                )),
            },
        ], items),
        pagination(meta, (page) => {
            state.page = page;
            refresh();
        }),
    ]);
}

function refresh() {
    load(() => apiGetPage('users', 'list', state), renderResults);
}

function renderPage() {
    let timer = null;
    const filterChanged = (key) => (value) => {
        state[key] = value;
        state.page = 1;
        refresh();
    };
    root.replaceChildren(
        el('div', { className: 'adm-toolbar' }, [
            el('div', { className: 'trk-search adm-search' }, [
                icon('ph ph-magnifying-glass'),
                el('input', {
                    attrs: { type: 'search', value: state.q, placeholder: t('usersSearch'), 'aria-label': t('usersSearch'), autocomplete: 'off' },
                    on: {
                        input: (event) => {
                            clearTimeout(timer);
                            timer = setTimeout(() => filterChanged('q')(event.target.value), SEARCH_DEBOUNCE_MS);
                        },
                    },
                }),
            ]),
            select('adm-filter-role', state.role, [['', t('allRoles')], ...ROLES.map((role) => [role, roleLabel(role)])], filterChanged('role'), t('colRole')),
            select('adm-filter-active', state.active, [['', t('allStatus')], ['1', t('userActive')], ['0', t('userDisabled')]], filterChanged('active'), t('colStatus')),
        ]),
        results,
    );
    refresh();
}

renderOnLang(renderPage);
