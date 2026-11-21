// v1 filters (DESIGN 4.1): status (with On progress), version, has tutorial, hidden, plus sort.
import { byId, el, icon } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { openDialog } from '../core/modal.js';
import { animateCheck } from '../core/motion.js';
import { compareVersions } from './catalog.js';

const STATUSES = [['all', 'statusAll'], ['done', 'statusDone'], ['in-progress', 'statusInProgress'], ['not-done', 'statusNotDone']];
const SORTS = [['default', 'sortDefault'], ['name', 'sortName'], ['newest', 'sortNewest'], ['oldest', 'sortOldest']];

export function createFilters({ tutorialKeys, onChange }) {
    const state = { status: 'all', versions: new Set(), hasTutorial: false, hiddenOnly: false, sort: 'default' };
    const bar = byId('trk-filter-bar');
    const controls = byId('trk-filter-controls');
    const openButton = byId('trk-filter-open');
    const openLabel = byId('trk-filter-open-label');
    let versions = [];
    let closeDropdowns = [];
    let clearButton = null;

    const activeCount = () => (state.status !== 'all' ? 1 : 0) + state.versions.size + (state.hasTutorial ? 1 : 0) + (state.hiddenOnly ? 1 : 0);

    function changed() {
        render();
        onChange();
    }

    function statusField() {
        const buttons = STATUSES.map(([value, label]) => el('button', {
            text: t(label),
            attrs: { type: 'button', 'aria-pressed': String(state.status === value) },
            on: {
                click: () => {
                    state.status = value;
                    changed();
                },
            },
        }));
        return el('div', { className: 'ui-segmented trk-status', attrs: { role: 'group', 'aria-label': t('statusFilter') } }, buttons);
    }

    function checkbox(labelText, checked, onToggle) {
        return el('label', { className: 'ui-check' }, [
            el('input', {
                attrs: { type: 'checkbox', checked },
                on: {
                    change: (event) => {
                        animateCheck([event.target.nextElementSibling], event.target.checked);
                        onToggle(event.target.checked);
                    },
                },
            }),
            el('span', { className: 'ui-check-box' }, [icon('ph-bold ph-check')]),
            el('span', { text: labelText }),
        ]);
    }

    /** One segment of the on/off track: lit while active, off again on the next click, independent of its neighbor. */
    function toggleSegment(labelText, stateKey) {
        return el('button', {
            text: labelText,
            attrs: { type: 'button', 'aria-pressed': String(state[stateKey]) },
            on: {
                click: (event) => {
                    state[stateKey] = !state[stateKey];
                    event.currentTarget.setAttribute('aria-pressed', String(state[stateKey]));
                    updateActiveState();
                    onChange();
                },
            },
        });
    }

    /**
     * A secondary button that opens a panel under it (Version, Sort). Closes on a click outside and on Esc.
     * Returns the wrapper to place, the label to rewrite, and close().
     */
    function dropdown(panelClassName, children) {
        const panel = el('div', { className: `trk-dropdown-panel ${panelClassName}`, attrs: { hidden: true } }, children);
        const label = el('span');
        const button = el('button', {
            className: 'ui-btn ui-btn-secondary',
            attrs: { type: 'button', 'aria-expanded': 'false' },
        }, [label, icon('ph ph-caret-down')]);

        const wrapper = el('div', { className: 'trk-dropdown' }, [button, panel]);

        function setOpen(open) {
            panel.hidden = !open;
            button.setAttribute('aria-expanded', String(open));
            document.removeEventListener('pointerdown', onOutside);
            document.removeEventListener('keydown', onEscape, true);
            if (open) {
                document.addEventListener('pointerdown', onOutside);
                // Capture phase, so Esc closes this panel first and not the sheet around it.
                document.addEventListener('keydown', onEscape, true);
            }
        }
        function onOutside(event) {
            if (!wrapper.contains(event.target)) setOpen(false);
        }
        function onEscape(event) {
            if (event.key === 'Escape') {
                event.stopPropagation();
                setOpen(false);
                button.focus();
            }
        }
        button.addEventListener('click', () => setOpen(panel.hidden));
        const close = () => setOpen(false);
        closeDropdowns.push(close);
        return { wrapper, label, button, close };
    }

    function versionField() {
        const { wrapper, label } = dropdown('trk-version-panel', versions.map((version) => checkbox(
            version,
            state.versions.has(version),
            (checked) => {
                if (checked) state.versions.add(version);
                else state.versions.delete(version);
                updateVersionLabel();
                updateActiveState();
                onChange();
            },
        )));
        const updateVersionLabel = () => {
            label.textContent = state.versions.size ? t('versionFilterCount', { count: state.versions.size }) : t('versionFilter');
        };
        updateVersionLabel();
        return wrapper;
    }

    /** Sort is a single choice: picking an option applies it and closes the panel. The button names a non-default order. */
    function sortField() {
        const options = SORTS.map(([value, labelKey]) => el('button', {
            className: 'trk-sort-option',
            attrs: { type: 'button', 'aria-pressed': String(state.sort === value) },
            on: {
                click: () => {
                    state.sort = value;
                    options.forEach((option, index) => option.setAttribute('aria-pressed', String(SORTS[index][0] === value)));
                    updateSortLabel();
                    sort.close();
                    sort.button.focus();
                    onChange();
                },
            },
        }, [el('span', { text: t(labelKey) }), icon('ph-bold ph-check')]));
        const sort = dropdown('trk-sort-panel', options);
        const updateSortLabel = () => {
            const current = SORTS.find(([value]) => value === state.sort);
            sort.label.textContent = state.sort === 'default' ? t('sortLabel') : t('sortLabelActive', { sort: t(current[1]) });
        };
        updateSortLabel();
        return sort.wrapper;
    }

    function updateActiveState() {
        const count = activeCount();
        openLabel.textContent = count ? `Filter (${count})` : 'Filter';
        clearButton.hidden = count === 0;
    }

    function render() {
        // Close the old panels (and their document listeners) before the controls are rebuilt.
        closeDropdowns.forEach((close) => close());
        closeDropdowns = [];
        clearButton = el('button', {
            className: 'ui-btn ui-btn-ghost',
            text: 'Clear filters',
            attrs: { type: 'button' },
            on: {
                click: () => {
                    clear();
                    onChange();
                },
            },
        });
        controls.replaceChildren(
            statusField(),
            versionField(),
            el('div', { className: 'ui-segmented', attrs: { role: 'group', 'aria-label': t('moreFilters') } }, [
                toggleSegment(t('hasTutorial'), 'hasTutorial'),
                toggleSegment(t('hidden'), 'hiddenOnly'),
            ]),
            sortField(),
            clearButton,
        );
        updateActiveState();
    }

    function clear() {
        state.status = 'all';
        state.versions.clear();
        state.hasTutorial = false;
        state.hiddenOnly = false;
        render();
    }

    openButton.addEventListener('click', () => {
        openDialog({
            title: 'Filter',
            body: controls,
            onClose: () => {
                closeDropdowns.forEach((close) => close());
                bar.append(controls);
            },
        });
    });

    return {
        setVersions(next) {
            versions = next;
            render();
        },

        clear,

        /** True while any filter control narrows the list. Sort does not count. */
        isActive: () => activeCount() > 0,

        matches(item, progress) {
            if (state.status === 'done' && !progress.isItemDone(item)) return false;
            if (state.status === 'in-progress' && !progress.isItemInProgress(item)) return false;
            if (state.status === 'not-done' && progress.isItemDone(item)) return false;
            if (state.versions.size > 0 && !state.versions.has(item.version)) return false;
            if (state.hasTutorial && !tutorialKeys.has(item.key)) return false;
            if (state.hiddenOnly && !item.hidden) return false;
            return true;
        },

        /** Sorting keeps results grouped by category. Search score wins only under the default order. */
        sorter(scores) {
            switch (state.sort) {
                case 'name':
                    return (a, b) => a.name.localeCompare(b.name);
                case 'newest':
                    return (a, b) => compareVersions(b.version, a.version) || a.sortOrder - b.sortOrder;
                case 'oldest':
                    return (a, b) => compareVersions(a.version, b.version) || a.sortOrder - b.sortOrder;
                default:
                    return scores
                        ? (a, b) => scores.get(b.key) - scores.get(a.key) || a.sortOrder - b.sortOrder
                        : (a, b) => a.sortOrder - b.sortOrder;
            }
        },
    };
}
