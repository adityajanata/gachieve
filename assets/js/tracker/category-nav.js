// Category navigation: sidebar on desktop, chip row on mobile and tablet. Both show the same state.
import { el } from '../core/dom.js';
import { formatRatio, t } from '../core/i18n.js';

export function createCategoryNav(sidebar, chips, onSelect) {
    let entries = [];

    function addEntry(groupId, name, total) {
        const sideCount = el('span', { className: 'trk-side-count' });
        const chipCount = el('span', { className: 'trk-chip-count' });
        const select = () => onSelect(groupId);
        const sideButton = el('button', {
            className: 'trk-side-item',
            attrs: { type: 'button' },
            on: { click: select },
        }, [el('span', { className: 'trk-side-name', text: name }), sideCount]);
        const chipButton = el('button', {
            className: 'ui-chip',
            attrs: { type: 'button' },
            on: { click: select },
        }, [el('span', { text: name }), chipCount]);
        sidebar.append(sideButton);
        chips.append(chipButton);
        entries.push({ groupId, total, sideCount, chipCount, sideButton, chipButton });
    }

    return {
        build(catalog) {
            sidebar.replaceChildren();
            chips.replaceChildren();
            entries = [];
            addEntry(null, t('allCategories'), catalog.items.length);
            catalog.groups.forEach((group) => addEntry(group.id, group.name, group.items.length));
        },

        update(stats, activeGroupId) {
            for (const entry of entries) {
                const done = entry.groupId === null ? stats.doneCount : stats.byGroup.get(entry.groupId);
                const text = formatRatio(done, entry.total);
                entry.sideCount.textContent = text;
                entry.chipCount.textContent = text;
                const active = entry.groupId === activeGroupId;
                for (const button of [entry.sideButton, entry.chipButton]) {
                    if (active) button.setAttribute('aria-current', 'true');
                    else button.removeAttribute('aria-current');
                }
            }
        },

        /** Only on selection: a stage toggle must not move the chip row the user scrolled. */
        revealActive(activeGroupId) {
            const entry = entries.find((candidate) => candidate.groupId === activeGroupId);
            if (entry && chips.offsetParent !== null) {
                entry.chipButton.scrollIntoView({ inline: 'nearest', block: 'nearest' });
            }
        },
    };
}
