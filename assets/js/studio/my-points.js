// My Points (PRD 5.8, DESIGN 4.4): total, next badge, earned badges and recent ledger entries.
import { apiGet } from '../core/api.js';
import { badgePill } from '../core/badge.js';
import { byId, el } from '../core/dom.js';
import { formatNumber, t } from '../core/i18n.js';
import { bootAdmin, renderOnLang } from './shell.js';
import { createLoader, dateText, emptyState } from './ui.js';

await bootAdmin();
const load = createLoader(byId('adm-root'));

function signed(points) {
    return `${points > 0 ? '+' : ''}${formatNumber(points)}`;
}

function nextBadge(total, next) {
    if (!next) return el('p', { className: 'ui-field-help', text: t('nextBadgeNone') });
    const bar = el('div', { className: 'trk-progress-fill' });
    bar.style.transform = `scaleX(${Math.min(1, Math.max(0, total / next.min_points))})`;
    return el('div', { className: 'adm-stack' }, [
        el('p', { className: 'ui-field-help', text: t('nextBadgeText', { points: formatNumber(next.remaining), title: next.title }) }),
        el('div', { className: 'trk-progress-track' }, [bar]),
    ]);
}

function renderPoints({ total, badges, next_badge: next, recent }) {
    return el('div', { className: 'adm-root' }, [
        el('section', { className: 'adm-panel adm-points-total' }, [
            el('p', { className: 'ui-text-display adm-flush', text: formatNumber(total) }),
            el('p', { className: 'ui-field-help', text: t('pointsTotal') }),
            nextBadge(total, next),
        ]),
        el('section', { className: 'adm-section' }, [
            el('h2', { className: 'adm-section-title', text: t('badgesEarned') }),
            badges.length === 0
                ? el('p', { className: 'ui-field-help', text: t('badgesNone') })
                : el('div', { className: 'adm-badges' }, badges.map((badge) => badgePill(badge.badge_key, badge.title))),
        ]),
        el('section', { className: 'adm-section' }, [
            el('h2', { className: 'adm-section-title', text: t('pointsRecent') }),
            recent.length === 0
                ? emptyState('ph-medal', t('pointsRecentEmpty'))
                : el('ul', { className: 'adm-ledger' }, recent.map((entry) => el('li', {}, [
                    el('span', { className: 'adm-muted', text: dateText(entry.created_at) }),
                    el('span', { className: 'adm-ledger-event', text: t(`event_${entry.event_key}`) }),
                    el('span', {
                        className: entry.entry_type === 'reversal' ? 'adm-ledger-points is-reversal' : 'adm-ledger-points',
                        text: signed(entry.points),
                    }),
                ]))),
        ]),
    ]);
}

renderOnLang(() => load(() => apiGet('points', 'mine'), renderPoints));
