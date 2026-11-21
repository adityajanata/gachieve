// Points Settings (PRD 5.8, API 5.2). Rules and badges are data; changes affect future awards only.
import { apiGet, apiPost } from '../core/api.js';
import { badgePill } from '../core/badge.js';
import { byId, el } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { toastSuccess } from '../core/toast.js';
import { bootAdmin, renderOnLang } from './shell.js';
import { actionGroup, button, checkbox, createLoader, dataTable, runAction } from './ui.js';

await bootAdmin();
const root = byId('adm-root');
const load = createLoader(root);

function numberInput(value, label, min) {
    return el('input', {
        className: 'ui-input adm-input-number',
        attrs: { type: 'number', value, min, step: 1, 'aria-label': label, inputmode: 'numeric' },
    });
}

function textInput(value, label) {
    return el('input', { className: 'ui-input', attrs: { type: 'text', value, maxlength: 100, 'aria-label': label } });
}

function rulesTable(rules) {
    const rows = rules.map((rule) => ({
        rule,
        points: numberInput(rule.points, t('colPoints'), 0),
        active: checkbox(rule.is_active, t('colActive')),
    }));
    const saveRule = (row, trigger) => runAction(trigger, async () => {
        await apiPost('points', 'save_rule', {
            event_key: row.rule.event_key,
            points: Number(row.points.value),
            is_active: row.active.input.checked,
        });
        toastSuccess(t('settingsSaved'));
    });
    return dataTable([
        { label: t('colEvent'), render: ({ rule }) => t(`event_${rule.event_key}`) },
        { label: t('colPoints'), render: (row) => row.points },
        { label: t('colActive'), render: (row) => row.active.node },
        { label: t('colActions'), render: (row) => actionGroup(button('Save', 'ghost', (event) => saveRule(row, event.currentTarget))) },
    ], rows);
}

function badgeRow(badge) {
    return {
        badge,
        key: textInput(badge.badge_key, t('colBadgeKey')),
        title: textInput(badge.title, t('colTitle')),
        minPoints: numberInput(badge.min_points, t('colMinPoints'), 0),
        sortOrder: numberInput(badge.sort_order, t('colOrder'), -1000),
        active: checkbox(badge.is_active, t('colActive')),
    };
}

function badgesTable(badges) {
    const rows = badges.map(badgeRow);
    const saveBadge = (row, trigger) => runAction(trigger, async () => {
        await apiPost('points', 'save_badge', {
            id: row.badge.id ?? null,
            badge_key: row.key.value.trim(),
            title: row.title.value,
            min_points: Number(row.minPoints.value),
            sort_order: Number(row.sortOrder.value),
            is_active: row.active.input.checked,
        });
        toastSuccess(t('settingsSaved'));
        refresh();
    });
    const slot = el('div');
    const paint = () => slot.replaceChildren(dataTable([
        {
            label: t('colTitle'),
            render: (row) => el('div', { className: 'adm-stack' }, [
                row.badge.id ? badgePill(row.badge.badge_key, row.badge.title) : el('span', { className: 'adm-muted', text: t('badgeNewRow') }),
                row.title,
            ]),
        },
        { label: t('colBadgeKey'), render: (row) => row.key },
        { label: t('colMinPoints'), render: (row) => row.minPoints },
        { label: t('colOrder'), render: (row) => row.sortOrder },
        { label: t('colActive'), render: (row) => row.active.node },
        { label: t('colActions'), render: (row) => actionGroup(button('Save', 'ghost', (event) => saveBadge(row, event.currentTarget))) },
    ], rows));
    paint();
    const add = button('Add Badge', 'secondary', () => {
        rows.push(badgeRow({ badge_key: '', title: '', min_points: 0, sort_order: rows.length + 1, is_active: true }));
        paint();
        add.hidden = true;
    }, { compact: false });
    return el('div', { className: 'adm-results' }, [slot, add]);
}

function renderSettings({ rules, badges }) {
    return el('div', { className: 'adm-root' }, [
        el('section', { className: 'adm-section' }, [
            el('h2', { className: 'adm-section-title', text: t('pointRules') }),
            el('p', { className: 'ui-field-help', text: t('pointRulesHint') }),
            rulesTable(rules),
        ]),
        el('section', { className: 'adm-section' }, [
            el('h2', { className: 'adm-section-title', text: t('badgesTitle') }),
            el('p', { className: 'ui-field-help', text: t('badgesHint') }),
            badgesTable(badges),
        ]),
    ]);
}

function refresh() {
    load(() => apiGet('points', 'settings'), renderSettings);
}

renderOnLang(refresh);
