// Progress summary (DESIGN 3.6). One panel for every achievement; while a category or a filter control
// narrows the list, a second panel beside it counts only that narrower set. Search and sort never change it.
import { byId } from '../core/dom.js';
import { formatNumber, t } from '../core/i18n.js';
import { countTo, scaleBar } from '../core/motion.js';

const root = byId('trk-summary');
const allNode = byId('trk-summary-all');
// The second panel is a copy of the first, so both always share one markup.
const scopeNode = allNode.cloneNode(true);
scopeNode.id = 'trk-summary-scope';
scopeNode.hidden = true;
root.append(scopeNode);

function parts(panel) {
    const find = (name) => panel.querySelector(`.trk-summary-${name}`);
    return { panel, title: find('title'), percent: find('percent'), count: find('count'), bar: find('bar'), reward: find('reward') };
}

const all = parts(allNode);
const scope = parts(scopeNode);

function fill(target, { doneCount, total, reward, totalReward }) {
    [target.percent, target.count, target.reward].forEach((node) => node.classList.remove('ui-skeleton-text'));
    const ratio = total === 0 ? 0 : doneCount / total;
    countTo(target.percent, Math.floor(ratio * 100), (value) => `${value}%`);
    countTo(target.count, doneCount, (value) => t('summaryCount', { done: formatNumber(value), total: formatNumber(total) }));
    countTo(target.reward, reward, (value) => t('summaryPrimo', { done: formatNumber(value), total: formatNumber(totalReward) }));
    scaleBar(target.bar, ratio);
}

/** narrowed: { title, totals } for the second panel, or null when nothing narrows the list. */
export function updateSummary(catalog, stats, narrowed) {
    fill(all, { doneCount: stats.doneCount, total: catalog.items.length, reward: stats.reward, totalReward: catalog.totalReward });
    const split = narrowed !== null;
    root.classList.toggle('is-split', split);
    all.title.hidden = !split;
    scope.panel.hidden = !split;
    if (!split) return;
    all.title.textContent = t('summaryAll');
    scope.title.hidden = false;
    scope.title.textContent = narrowed.title;
    fill(scope, narrowed.totals);
}
