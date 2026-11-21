// Approvals (PRD 5.7, API 4.3, DESIGN 4.5): the queue, then a review page with Proposed and Live side by side.
import { apiGet, apiGetPage, apiPost } from '../core/api.js';
import { byId, el, icon, setButtonLoading } from '../core/dom.js';
import { getLang, t } from '../core/i18n.js';
import { confirmAction, promptText } from '../core/modal.js';
import { toastCountdown, toastError, toastInfo, toastSuccess } from '../core/toast.js';
import { tooltip } from '../core/tooltip.js';
import { renderTutorial } from '../core/tutorial-view.js';
import { bootAdmin, renderOnLang } from './shell.js';
import { actionGroup, button, checkbox, createLoader, dataTable, dateText, emptyState, pagination, runAction, statusChip } from './ui.js';

// Matches the review rate limit (API 6.1: 30 approvals per 10 minutes), so one bulk run cannot outrun it.
const BULK_MAX = 30;

await bootAdmin();
const root = byId('adm-root');
const load = createLoader(root);
let page = 1;
let reviewing = null;
/** version_id to queue row. Kept across pages until approved or unticked. */
const selected = new Map();
let bulkRunning = false;

function pointsMessage(result) {
    const total = result.points.reduce((sum, entry) => sum + entry.points, 0);
    return total > 0 ? t('approveDonePoints', { points: total }) : t('approveDone');
}

/**
 * RATE_LIMITED gets a toast that counts retry_after_seconds down (API 6.3), with prefix in front when given.
 * Resolves to true when it showed one.
 */
function rateLimitToast(error, prefix = '') {
    const seconds = error.code === 'RATE_LIMITED' ? Number(error.details.retry_after_seconds) : 0;
    if (!(seconds > 0)) return false;
    toastCountdown((left) => `${prefix}${t(left === 1 ? 'approveRateLimitedOne' : 'approveRateLimited', { seconds: left })}`, seconds);
    return true;
}

async function approve(row, trigger) {
    let result = null;
    const done = await runAction(trigger, async () => {
        result = await apiPost('reviews', 'approve', { version_id: row.version_id });
    }, (error) => rateLimitToast(error));
    if (done) {
        selected.delete(row.version_id);
        toastSuccess(pointsMessage(result));
        backToQueue();
    }
}

async function reject(row) {
    const reason = await promptText({
        title: t('rejectTitle'),
        label: t('rejectLabel'),
        confirmLabel: 'Reject',
        maxLength: 1000,
    });
    if (reason === null) return;
    if (await runAction(null, () => apiPost('reviews', 'reject', { version_id: row.version_id, reason }))) {
        selected.delete(row.version_id);
        toastSuccess(t('rejectDone'));
        backToQueue();
    }
}

function backToQueue() {
    reviewing = null;
    render();
}

function contentColumn(heading, content, lang) {
    return el('section', { className: 'adm-review-col' }, [
        el('h2', { className: 'adm-section-title', text: heading }),
        content ? renderTutorial(content, lang) : emptyState('ph-book-open', t('reviewNoLive')),
    ]);
}

function historyList(history) {
    return el('section', { className: 'adm-section' }, [
        el('h2', { className: 'adm-section-title', text: t('reviewHistory') }),
        el('ol', { className: 'adm-history' }, history.map((entry) => el('li', {}, [
            statusChip(entry.to_status),
            el('span', { text: `${entry.actor_name} · ${dateText(entry.created_at)}` }),
            entry.reason ? el('p', { className: 'adm-history-reason', text: entry.reason }) : null,
        ]))),
    ]);
}

function reviewPage(row, data) {
    let lang = getLang();
    const columns = el('div', { className: 'adm-review-grid' });
    const tabs = el('div', { className: 'ui-segmented', attrs: { role: 'group', 'aria-label': t('editorLanguage') } });

    function paint() {
        tabs.replaceChildren(...['id', 'en'].map((code) => el('button', {
            text: code.toUpperCase(),
            attrs: { type: 'button', 'aria-pressed': String(code === lang) },
            on: {
                click: () => {
                    lang = code;
                    paint();
                },
            },
        })));
        columns.replaceChildren(
            contentColumn(t('reviewProposed'), data.proposed, lang),
            contentColumn(t('reviewLive'), data.live, lang),
        );
    }
    paint();

    return el('div', { className: 'adm-root' }, [
        el('div', { className: 'adm-editor-bar' }, [
            el('button', {
                className: 'ui-icon-btn',
                attrs: { type: 'button', 'aria-label': 'Back to queue' },
                on: { click: backToQueue },
            }, [icon('ph ph-arrow-left')]),
            el('div', { className: 'adm-stack' }, [
                el('span', { className: 'adm-strong', text: row.name_id }),
                el('span', { className: 'adm-muted', text: `${row.name_en} · v${row.version_no} · ${row.created_by_name}` }),
            ]),
        ]),
        tabs,
        columns,
        historyList(data.history),
        el('div', { className: 'adm-action-bar' }, [
            el('span'),
            el('div', { className: 'adm-action-buttons' }, [
                button('Reject', 'danger', () => reject(row), { compact: false }),
                button('Approve', 'primary', (event) => approve(row, event.currentTarget), { compact: false }),
            ]),
        ]),
    ]);
}

/** Toggles one row. Adding past BULK_MAX is refused with a notice. Resolves to whether the row ended up selected. */
function toggleRow(row, wanted) {
    if (!wanted) {
        selected.delete(row.version_id);
        return false;
    }
    if (!selected.has(row.version_id) && selected.size >= BULK_MAX) {
        toastInfo(t('bulkLimitInfo', { max: BULK_MAX }));
        return false;
    }
    selected.set(row.version_id, row);
    return true;
}

/**
 * Approves the selected versions one by one through the single approve action, so every version keeps its own checks.
 * A rate limit stops the run; whatever was not approved stays selected.
 */
async function approveSelected(trigger, progress) {
    const rows = [...selected.values()];
    const confirmed = await confirmAction({
        title: t('bulkApproveTitle', { count: rows.length }),
        text: t('bulkApproveText'),
        confirmLabel: 'Approve',
    });
    if (!confirmed) return;

    bulkRunning = true;
    root.querySelectorAll('input[type="checkbox"]').forEach((input) => { input.disabled = true; });
    setButtonLoading(trigger, true);
    let approved = 0;
    let points = 0;
    let firstError = null;
    for (const row of rows) {
        progress.textContent = t('bulkApproving', { done: approved + 1, total: rows.length });
        try {
            const result = await apiPost('reviews', 'approve', { version_id: row.version_id });
            points += result.points.reduce((sum, entry) => sum + entry.points, 0);
            selected.delete(row.version_id);
            approved++;
        } catch (error) {
            firstError ??= error;
            // Already approved or rejected elsewhere: it left the queue, so it leaves the selection too.
            if (error.code === 'INVALID_STATE') selected.delete(row.version_id);
            if (error.code === 'RATE_LIMITED') {
                // The reason the run stopped matters more than an earlier single failure.
                firstError = error;
                break;
            }
        }
    }
    bulkRunning = false;

    if (firstError) {
        const partial = t('bulkApprovePartial', { done: approved, failed: rows.length - approved });
        if (!rateLimitToast(firstError, `${partial} `)) toastError(`${partial} ${firstError.message}`);
    } else {
        toastSuccess(points > 0 ? t('bulkApproveDonePoints', { count: approved, points }) : t('bulkApproveDone', { count: approved }));
    }
    // The queue just shrank, so the current page may no longer exist.
    page = 1;
    render();
}

/** The sticky bar under the queue: selection count, progress, and Approve selected. Hidden while nothing is selected. */
function bulkBar() {
    const count = el('span', { className: 'adm-save-status' });
    const approveButton = button('Approve selected', 'primary', (event) => approveSelected(event.currentTarget, count), { compact: false });
    const bar = el('div', { className: 'adm-action-bar' }, [count, el('div', { className: 'adm-action-buttons' }, [approveButton])]);
    function update() {
        if (bulkRunning) return;
        bar.hidden = selected.size === 0;
        count.textContent = t('selectedCount', { count: selected.size, max: BULK_MAX });
    }
    update();
    return { bar, update };
}

/** Robot chip for tutorials written by the agent, so the review knows it reads AI text. The hint is a tooltip. */
function agentChip() {
    const chip = el('span', { className: 'adm-agent-chip', attrs: { role: 'img', 'aria-label': t('agentHint') } }, [icon('ph-fill ph-robot')]);
    tooltip(chip, () => t('agentHint'));
    return chip;
}

function queuePage({ items, meta }) {
    if (items.length === 0) return emptyState('ph-seal-check', t('queueEmpty'));
    const { bar, update } = bulkBar();
    const rowChecks = new Map();
    const all = checkbox(false, t('selectAllPage'));
    const syncAll = () => {
        all.input.checked = items.every((row) => selected.has(row.version_id));
        update();
    };
    all.input.addEventListener('change', () => {
        const wanted = all.input.checked;
        for (const row of items) {
            const isOn = toggleRow(row, wanted);
            rowChecks.get(row.version_id).checked = isOn;
            if (wanted && !isOn) break;
        }
        syncAll();
    });
    all.node.append(el('span', { text: t('selectAllPage'), attrs: { 'aria-hidden': 'true' } }));
    const selectAll = el('div', { className: 'adm-toolbar' }, [all.node]);

    const result = el('div', { className: 'adm-results' }, [
        selectAll,
        dataTable([
            {
                label: t('colSelect'),
                className: 'adm-col-check',
                render: (row) => {
                    const check = checkbox(selected.has(row.version_id), t('selectRow', { name: row.name_id }));
                    rowChecks.set(row.version_id, check.input);
                    check.input.addEventListener('change', () => {
                        check.input.checked = toggleRow(row, check.input.checked);
                        syncAll();
                    });
                    return check.node;
                },
            },
            {
                label: t('colAchievement'),
                render: (row) => el('div', { className: 'adm-stack' }, [
                    el('span', { className: 'adm-strong', text: row.name_id }),
                    el('span', { className: 'adm-muted', text: row.name_en }),
                ]),
            },
            {
                label: t('colAuthor'),
                render: (row) => (row.created_by_is_agent
                    ? el('span', { className: 'adm-user-name' }, [el('span', { text: row.created_by_name }), agentChip()])
                    : row.created_by_name),
            },
            { label: t('colType'), render: (row) => t(row.is_update ? 'typeUpdate' : 'typeNew') },
            { label: t('colLanguages'), render: (row) => row.langs.map((code) => code.toUpperCase()).join(', ') },
            { label: t('colSubmitted'), render: (row) => dateText(row.submitted_at) },
            {
                label: t('colActions'),
                render: (row) => actionGroup(button('Review', 'ghost', () => {
                    reviewing = row;
                    render();
                })),
            },
        ], items),
        pagination(meta, (next) => {
            page = next;
            render();
        }),
        bar,
    ]);
    all.input.checked = items.every((row) => selected.has(row.version_id));
    return result;
}

function render() {
    if (reviewing) {
        const row = reviewing;
        load(() => apiGet('reviews', 'get', { version_id: row.version_id }), (data) => reviewPage(row, data));
    } else {
        load(() => apiGetPage('reviews', 'queue', { page }), queuePage);
    }
}

renderOnLang(render);
