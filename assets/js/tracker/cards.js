// The achievement list: rows grouped per category, rendered in chunks of 50 (DESIGN 3.4, 4.1).
import { el, icon, primogem } from '../core/dom.js';
import { formatNumber, formatRatio, t } from '../core/i18n.js';
import { animateCheck, nudge, rowsIn, settleCheck } from '../core/motion.js';
import { highlighted } from './search.js';

const CHUNK_SIZE = 50;

export function createList(container, { progress, tutorialKeys, onToggle, onHowTo }) {
    const rows = new Map(); // achievement key -> { row, inputs, seal }
    const itemsByKey = new Map();
    const groupHeads = new Map(); // group id -> { count, seal, total }
    let sections = [];
    let cursor = { section: 0, item: 0, body: null };
    let query = '';

    const moreButton = el('button', {
        className: 'ui-btn ui-btn-secondary',
        text: 'Load more',
        attrs: { type: 'button' },
        on: { click: () => renderChunk() },
    });
    const moreWrap = el('div', { className: 'trk-more' }, [moreButton]);
    const observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) renderChunk();
    }, { rootMargin: '600px 0px' });

    function stageInput(item, stage) {
        const accessibleName = item.stages.length > 1 ? `${item.name}, Stage ${stage.index + 1}` : item.name;
        return el('input', {
            attrs: {
                type: 'checkbox',
                'data-stage-index': stage.index,
                'aria-label': accessibleName,
                checked: progress.isDone(stage.id),
            },
        });
    }

    function reward(stage) {
        return el('span', { className: 'trk-stage-reward' }, [
            primogem(),
            el('span', { text: formatNumber(stage.reward) }),
        ]);
    }

    function stageLabel(item, stage) {
        const stageLine = el('span', { className: 'trk-stage' }, [
            item.stages.length > 1 ? el('span', { text: `Stage ${stage.index + 1}` }) : null,
            reward(stage),
        ]);
        const text = item.vertical
            ? el('span', { className: 'trk-stage-text' }, [
                stageLine,
                stage.titleDiffers ? el('span', { className: 'trk-stage-title' }, [highlighted(stage.title, query)]) : null,
                el('span', { className: 'trk-stage-desc' }, [highlighted(stage.description, query)]),
            ])
            : stageLine;
        return el('label', { className: 'ui-check' }, [
            stageInput(item, stage),
            el('span', { className: 'ui-check-box' }, [icon('ph-bold ph-check')]),
            text,
        ]);
    }

    function buildRow(item) {
        const seal = icon('ph-fill ph-seal-check trk-row-seal');
        const stageLabels = item.stages.map((stage) => stageLabel(item, stage));
        const hasTutorial = tutorialKeys.has(item.key);
        const howTo = el('button', {
            className: `ui-btn ui-btn-ghost trk-howto${hasTutorial ? '' : ' is-empty'}`,
            attrs: { type: 'button', 'data-howto': true },
        }, [icon(hasTutorial ? 'ph-fill ph-book-open' : 'ph ph-book-open'), el('span', { text: 'How To Achieve' })]);

        const head = el('div', { className: 'trk-row-head' }, [
            el('h3', { className: 'trk-row-name' }, [highlighted(item.name, query)]),
            seal,
            el('span', { className: 'ui-meta-chip', text: `v${item.version}` }),
            item.hidden ? el('span', { className: 'ui-meta-chip', text: t('hidden') }) : null,
        ]);

        const main = el('div', {}, [
            head,
            item.vertical
                ? el('div', { className: 'trk-stages trk-stages-vertical' }, stageLabels)
                : el('p', { className: 'trk-row-desc' }, [highlighted(item.description, query)]),
        ]);
        const side = el('div', { className: 'trk-row-side' }, [
            item.vertical ? null : el('div', { className: 'trk-stages' }, stageLabels),
            howTo,
        ]);

        const row = el('article', { className: 'trk-row', attrs: { 'data-key': item.key } }, [main, side]);
        rows.set(item.key, { row, seal, inputs: stageLabels.map((label) => label.querySelector('input')) });
        itemsByKey.set(item.key, item);
        syncRow(item);
        return row;
    }

    function syncRow(item) {
        const entry = rows.get(item.key);
        if (!entry) return;
        const done = progress.isItemDone(item);
        entry.row.classList.toggle('is-done', done);
        entry.seal.hidden = !done;
        item.stages.forEach((stage, index) => {
            entry.inputs[index].checked = progress.isDone(stage.id);
        });
    }

    function syncGroupHead(groupId, stats) {
        const head = groupHeads.get(groupId);
        if (!head) return;
        const done = stats.byGroup.get(groupId);
        head.count.textContent = formatRatio(done, head.total);
        head.seal.hidden = done !== head.total;
    }

    function buildSection({ group, doneCount, total }) {
        const count = el('span', { className: 'trk-group-count', text: formatRatio(doneCount, total) });
        const seal = icon('ph-fill ph-seal-check');
        seal.hidden = doneCount !== total;
        groupHeads.set(group.id, { count, seal, total });
        const body = el('div', { className: 'trk-group-body' });
        const section = el('section', { className: 'trk-group' }, [
            el('div', { className: 'trk-group-head' }, [el('h2', { text: group.name }), seal, count]),
            body,
        ]);
        moreWrap.before(section);
        return body;
    }

    function renderChunk() {
        const added = [];
        while (added.length < CHUNK_SIZE && cursor.section < sections.length) {
            const section = sections[cursor.section];
            cursor.body ??= buildSection(section);
            const row = buildRow(section.items[cursor.item]);
            cursor.body.append(row);
            added.push(row);
            cursor.item++;
            if (cursor.item >= section.items.length) {
                cursor = { section: cursor.section + 1, item: 0, body: null };
            }
        }
        rowsIn(added);
        const more = cursor.section < sections.length;
        moreWrap.hidden = !more;
        // Observing again makes the observer report even when the button is still in range.
        observer.unobserve(moreWrap);
        if (more) observer.observe(moreWrap);
    }

    function reset() {
        observer.disconnect();
        rows.clear();
        itemsByKey.clear();
        groupHeads.clear();
        container.replaceChildren();
        container.setAttribute('aria-busy', 'false');
    }

    container.addEventListener('change', (event) => {
        const input = event.target;
        if (!input.matches('input[data-stage-index]')) return;
        const key = Number(input.closest('.trk-row').dataset.key);
        onToggle(itemsByKey.get(key), Number(input.dataset.stageIndex), input.checked);
    });

    container.addEventListener('click', (event) => {
        const button = event.target.closest('[data-howto]');
        if (!button) return;
        onHowTo(itemsByKey.get(Number(button.closest('.trk-row').dataset.key)));
    });

    return {
        render(nextSections, nextQuery) {
            reset();
            sections = nextSections;
            query = nextQuery;
            cursor = { section: 0, item: 0, body: null };
            container.append(moreWrap);
            renderChunk();
        },

        showLoading(skeleton) {
            reset();
            sections = [];
            container.setAttribute('aria-busy', 'true');
            container.append(skeleton.cloneNode(true));
        },

        showMessage(iconClass, message, actionLabel, onAction) {
            reset();
            sections = [];
            container.append(el('div', { className: 'ui-empty' }, [
                icon(iconClass),
                el('p', { text: message }),
                el('button', {
                    className: 'ui-btn ui-btn-secondary',
                    text: actionLabel,
                    attrs: { type: 'button' },
                    on: { click: onAction },
                }),
            ]));
        },

        /** Updates rows after a change and plays the cascade. Removals animate in reverse order. */
        applyChange(item, changes, stats) {
            syncRow(item);
            const entry = rows.get(item.key);
            if (entry) {
                const changedIds = [...changes.added, ...changes.removed];
                const boxes = item.stages
                    .filter((stage) => changedIds.includes(stage.id))
                    .map((stage) => entry.inputs[stage.index].nextElementSibling);
                const checked = changes.removed.length === 0;
                animateCheck(checked ? boxes : boxes.reverse(), checked);
            }
            syncGroupHead(item.groupId, stats);
        },

        rollback(item, stats) {
            syncRow(item);
            const entry = rows.get(item.key);
            if (entry) {
                settleCheck(entry.inputs.map((input) => input.nextElementSibling));
                nudge(entry.row);
            }
            syncGroupHead(item.groupId, stats);
        },

        /** Keeps rendered rows and the scroll position when progress changed in another tab. */
        syncAll(stats) {
            itemsByKey.forEach(syncRow);
            groupHeads.forEach((_, groupId) => syncGroupHead(groupId, stats));
        },
    };
}
