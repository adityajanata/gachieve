// Maintenance (PRD 8, API 5.3): the dry-run list always comes first, then Delete Unused behind a confirmation.
import { apiPost } from '../core/api.js';
import { byId, el } from '../core/dom.js';
import { formatNumber, t } from '../core/i18n.js';
import { confirmDanger } from '../core/modal.js';
import { toastSuccess } from '../core/toast.js';
import { bootAdmin, renderOnLang } from './shell.js';
import { button, runAction } from './ui.js';

await bootAdmin();
const root = byId('adm-root');
let report = null;

async function check(trigger) {
    await runAction(trigger, async () => {
        report = await apiPost('admin', 'cleanup_images', { dry_run: true });
        render();
    });
}

async function deleteUnused() {
    const confirmed = await confirmDanger({
        title: t('cleanupTitle'),
        text: t('cleanupWarning', { count: formatNumber(report.unused.length) }),
        confirmLabel: 'Delete',
    });
    if (!confirmed) return;
    await runAction(null, async () => {
        const result = await apiPost('admin', 'cleanup_images', { dry_run: false });
        report = null;
        render();
        toastSuccess(t('cleanupDone', { count: formatNumber(result.deleted_count) }));
    });
}

function renderReport() {
    if (!report) return null;
    if (report.unused.length === 0) return el('p', { className: 'ui-field-help', text: t('cleanupNothing', { count: formatNumber(report.scanned) }) });
    return el('div', { className: 'adm-results' }, [
        el('p', { className: 'ui-field-help', text: t('cleanupFound', { count: formatNumber(report.unused.length), scanned: formatNumber(report.scanned) }) }),
        el('ul', { className: 'adm-ledger' }, report.unused.map((path) => el('li', {}, [el('span', { className: 'adm-ledger-event', text: path })]))),
        button('Delete Unused', 'danger', deleteUnused, { compact: false, attrs: { class: 'ui-btn ui-btn-danger adm-self-start' } }),
    ]);
}

function render() {
    root.replaceChildren(el('section', { className: 'adm-section' }, [
        el('h2', { className: 'adm-section-title', text: t('cleanupHeading') }),
        el('p', { className: 'ui-field-help', text: t('cleanupHint') }),
        button('Check', 'secondary', (event) => check(event.currentTarget), { compact: false, attrs: { class: 'ui-btn ui-btn-secondary adm-self-start' } }),
        renderReport(),
    ]));
}

renderOnLang(render);
