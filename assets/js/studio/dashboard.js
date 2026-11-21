// Dashboard (API 5.3, DESIGN 4.5): one panel of real counts, then the reviews waiting for a decision.
import { apiGet, apiGetPage } from '../core/api.js';
import { byId, el } from '../core/dom.js';
import { formatNumber, t } from '../core/i18n.js';
import { bootAdmin, renderOnLang } from './shell.js';
import { createLoader, dateText, emptyState } from './ui.js';

const PENDING_PREVIEW = 5;

await bootAdmin();
const load = createLoader(byId('adm-root'));

function stat(value, label, detail) {
    return el('div', { className: 'adm-stat' }, [
        el('span', { className: 'ui-text-display', text: formatNumber(value) }),
        el('span', { className: 'adm-stat-label', text: label }),
        detail ? el('span', { className: 'adm-muted', text: detail }) : null,
    ]);
}

function renderDashboard([dashboard, queue]) {
    const roles = dashboard.users_by_role;
    const totalUsers = Object.values(roles).reduce((sum, count) => sum + count, 0);
    const breakdown = Object.entries(roles).map(([role, count]) => `${formatNumber(count)} ${t(`role_${role}`)}`).join(', ');

    return el('div', { className: 'adm-root' }, [
        el('section', { className: 'adm-panel adm-stats' }, [
            stat(totalUsers, t('statUsers'), breakdown),
            stat(dashboard.pending_reviews, t('statPending')),
            stat(dashboard.published_tutorials, t('statPublished')),
            stat(dashboard.active_locks, t('statLocks')),
        ]),
        el('section', { className: 'adm-section' }, [
            el('h2', { className: 'adm-section-title', text: t('pendingList') }),
            queue.items.length === 0
                ? emptyState('ph-seal-check', t('queueEmpty'))
                : el('ul', { className: 'adm-ledger' }, [
                    ...queue.items.map((row) => el('li', {}, [
                        el('span', { className: 'adm-ledger-event', text: row.name_id }),
                        el('span', { className: 'adm-muted', text: `${row.created_by_name} · ${dateText(row.submitted_at)}` }),
                    ])),
                ]),
            queue.items.length > 0 ? el('a', { className: 'ui-btn ui-btn-secondary adm-self-start', text: 'Open Approvals', attrs: { href: 'studio/approvals.php' } }) : null,
        ]),
    ]);
}

renderOnLang(() => load(
    () => Promise.all([apiGet('admin', 'dashboard'), apiGetPage('reviews', 'queue', { per_page: PENDING_PREVIEW })]),
    renderDashboard,
));
