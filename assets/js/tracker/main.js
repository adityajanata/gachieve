// Tracker page wiring. Each behavior lives in its own module.
import { apiGet, apiPost } from '../core/api.js';
import { byId, initHeaderShadow } from '../core/dom.js';
import { applyLabels, formatNumber, formatPerson, getLang, initLangToggle, onLangChange, t } from '../core/i18n.js';
import { isDialogOpen } from '../core/modal.js';
import { onStoredChange, readStored, writeStored } from '../core/storage.js';
import { initSky } from '../core/sky.js';
import { initTheme } from '../core/theme.js';
import { toastError, toastSuccess } from '../core/toast.js';
import { createAccount } from './account.js';
import { exportProgress, readBackup } from './backup.js';
import { openBulkMark } from './bulk-mark.js';
import { isCatalogLoaded, loadCatalog } from './catalog.js';
import { createCategoryNav } from './category-nav.js';
import { createFilters } from './filters.js';
import { createList } from './cards.js';
import { computeStats, computeTotals, createProgress } from './progress.js';
import { searchItems } from './search.js';
import { updateSummary } from './summary.js';
import { createTutorialModal } from './tutorial-modal.js';

const SEARCH_DEBOUNCE_MS = 200;

const listNode = byId('trk-list');
const searchInput = byId('trk-search-input');
const searchClear = byId('trk-search-clear');
const live = byId('ui-live');
const summaryNode = byId('trk-summary');
const filterBar = byId('trk-filter-bar');
const bulkOpenButton = byId('trk-bulk-open');
const bulkMaxItems = Number(document.body.dataset.bulkMax);
const listSkeleton = listNode.firstElementChild.cloneNode(true);

const progress = createProgress();
const tutorialKeys = new Set();
const account = createAccount({ onSignedIn: handleSignedIn, onSignedOut: handleSignedOut });

let catalog = null;
let signedIn = false;
let sessionBoot = null;
let activeGroupId = null;
let query = '';
let loadToken = 0;

const nav = createCategoryNav(byId('trk-sidebar'), byId('trk-chips'), (groupId) => {
    activeGroupId = groupId;
    if (query) clearSearch();
    renderList();
    refreshCounts();
    nav.revealActive(activeGroupId);
});

const filters = createFilters({
    tutorialKeys,
    onChange: () => {
        renderList();
        refreshCounts();
    },
});

const tutorialModal = createTutorialModal({ getRole: () => account.role() });

const list = createList(listNode, {
    progress,
    tutorialKeys,
    onHowTo: tutorialModal.open,
    onToggle: toggleStage,
});

/** Cards only need to know which achievements have a tutorial. If this fails, the modal still asks the server per click. */
async function loadTutorialIndex() {
    try {
        const items = await apiGet('tutorials', 'index');
        tutorialKeys.clear();
        items.forEach((item) => tutorialKeys.add(item.achievement_id));
    } catch (error) {
        console.error(error);
    }
}

async function toggleStage(item, stageIndex, checked) {
    const changes = progress.plan(item, stageIndex, checked);
    progress.apply(changes);
    refreshAfterChange(item, changes);
    live.textContent = t(checked ? 'stageMarked' : 'stageUnmarked', {
        name: item.stages.length > 1 ? `Stage ${stageIndex + 1}` : item.name,
    });

    try {
        const serverChangedMore = await progress.saveStage(item.stages[stageIndex].id, checked, changes);
        if (serverChangedMore) list.syncAll(refreshCounts());
    } catch (error) {
        progress.revert(changes);
        list.rollback(item, refreshCounts());
        reportSaveError(error, 'Could not save. Changes were reverted.');
    }
}

/** Messages the user can act on are shown as they are; anything else gets the plain message for that action. */
function reportSaveError(error, fallback) {
    if (account.handleSessionError(error)) return;
    toastError(error.code === 'RATE_LIMITED' || error.code === 'INVALID_STATE' ? error.message : fallback);
}

async function applyBulk(stageIds) {
    try {
        await progress.commitBulk(stageIds);
    } catch (error) {
        reportSaveError(error, 'Could not save. Nothing was changed.');
        return;
    }
    list.syncAll(refreshCounts());
    toastSuccess(t('bulkApplied', { count: formatNumber(stageIds.length) }), { actionLabel: 'Undo', onAction: undoBulk });
}

async function undoBulk() {
    try {
        const removedCount = await progress.undoBulk(catalog);
        list.syncAll(refreshCounts());
        toastSuccess(t('bulkUndone', { count: formatNumber(removedCount) }));
    } catch (error) {
        reportSaveError(error, 'Could not save. Nothing was changed.');
    }
}

/** Guest progress is imported automatically after every sign-in, and cleared only once the server confirms it (API 6.4). */
async function importLocalProgress() {
    const stageIds = progress.localStageIds();
    if (stageIds.length === 0) return null;
    try {
        const { added_count: addedCount } = await apiPost('progress', 'import', { stage_ids: stageIds });
        progress.clearLocal();
        return addedCount;
    } catch (error) {
        toastError(error.message);
        return null;
    }
}

async function handleSignedIn({ user, email, isNew }) {
    signedIn = true;
    const addedCount = await importLocalProgress();
    await loadData();
    syncBanners();
    if (addedCount > 0) {
        toastSuccess(t('importMerged', { count: formatNumber(addedCount) }));
    } else if (isNew) {
        toastSuccess(t('welcome', { name: formatPerson(user.display_name, email) }));
    }
}

function handleSignedOut() {
    signedIn = false;
    progress.useGuest();
    syncBanners();
    if (catalog) {
        refreshCounts();
        renderList();
    }
}

function syncBanners() {
    byId('trk-guest-banner').hidden = signedIn || readStored('guestBannerDismissed') === true;
    // From here the hidden attribute decides; banner-init.js reads lastSignedIn on the next visit.
    document.documentElement.classList.add('trk-guest-banner-on');
    writeStored('lastSignedIn', signedIn);
    byId('trk-offline-banner').hidden = !signedIn || navigator.onLine;
}

/** Returns true when the drawer can close. A bad file keeps it open, with an English error. */
async function importFile(file) {
    let stageIds;
    try {
        stageIds = await readBackup(file, { catalog, progress, maxItems: bulkMaxItems });
    } catch (error) {
        toastError(error.message);
        return false;
    }
    if (stageIds.length === 0) {
        toastSuccess(t('bulkImportNothing'));
        return true;
    }
    await applyBulk(stageIds);
    return true;
}

function openBulk() {
    openBulkMark({
        catalog,
        loadOther: () => loadCatalog(getLang() === 'id' ? 'en' : 'id'),
        progress,
        maxItems: bulkMaxItems,
        onApply: applyBulk,
        onUndo: undoBulk,
        onImport: importFile,
        onExport: () => exportProgress(progress),
    });
}

/** The set the second summary panel counts: the chosen category and the filter controls. Search never narrows it. */
function narrowedSummary() {
    const filtered = filters.isActive();
    const group = catalog.groups.find((entry) => entry.id === activeGroupId);
    if (!group && !filtered) return null;
    const items = (group ? group.items : catalog.items).filter((item) => filters.matches(item, progress));
    let title = t('summaryFiltered');
    if (!filtered) title = group.name;
    else if (group) title = t('summaryFilteredIn', { name: group.name });
    return { title, totals: computeTotals(items, progress) };
}

function refreshCounts() {
    const stats = computeStats(catalog, progress);
    updateSummary(catalog, stats, narrowedSummary());
    nav.update(stats, activeGroupId);
    return stats;
}

function refreshAfterChange(item, changes) {
    list.applyChange(item, changes, refreshCounts());
}

function buildSections() {
    const scores = query ? searchItems(catalog.items, query) : null;
    const sorter = filters.sorter(scores);
    // Search results replace the category view and cover every category.
    const groups = query || activeGroupId === null
        ? catalog.groups
        : catalog.groups.filter((group) => group.id === activeGroupId);

    return groups
        .map((group) => ({
            group,
            total: group.items.length,
            doneCount: group.items.filter((item) => progress.isItemDone(item)).length,
            items: group.items
                .filter((item) => (!scores || scores.has(item.key)) && filters.matches(item, progress))
                .sort(sorter),
        }))
        .filter((section) => section.items.length > 0);
}

function renderList() {
    if (!catalog) return;
    const sections = buildSections();
    if (sections.length === 0) {
        list.showMessage('ph ph-magnifying-glass', t(query ? 'emptyResults' : 'emptyFilters'), 'Clear filters', () => {
            clearSearch();
            filters.clear();
            renderList();
            refreshCounts();
        });
    } else {
        list.render(sections, query);
    }
    // A new result set starts at its first row, not wherever the old list was scrolled to.
    if (listNode.getBoundingClientRect().top < 0) listNode.scrollIntoView({ block: 'start' });
}

function clearSearch() {
    query = '';
    searchInput.value = '';
    searchClear.hidden = true;
}

/** Reads the session once, then cloud progress. A failed cloud load stays retryable through the error panel. */
async function loadSession() {
    if (!sessionBoot) {
        sessionBoot = account.boot().then((user) => {
            signedIn = user !== null;
            syncBanners();
        });
    }
    await sessionBoot;
    if (signedIn && !progress.isCloud()) await progress.useCloud();
}

async function loadData() {
    const token = ++loadToken;
    if (!isCatalogLoaded(getLang())) list.showLoading(listSkeleton);
    summaryNode.hidden = false;
    try {
        const [next] = await Promise.all([loadCatalog(getLang()), loadSession(), loadTutorialIndex()]);
        if (token !== loadToken) return;
        catalog = next;
        filters.setVersions(catalog.versions);
        nav.build(catalog);
        refreshCounts();
        filterBar.inert = false;
        bulkOpenButton.disabled = false;
        renderList();
    } catch (error) {
        if (token !== loadToken) return;
        console.error(error);
        // With nothing loaded, the summary skeleton and the filters have nothing to show.
        summaryNode.hidden = catalog === null;
        filterBar.hidden = catalog === null;
        list.showMessage('ph ph-warning-circle', t('dataFailed'), 'Retry', loadData);
    }
}

function initSearch() {
    let timer = null;
    searchInput.addEventListener('input', () => {
        searchClear.hidden = searchInput.value === '';
        clearTimeout(timer);
        timer = setTimeout(() => {
            query = searchInput.value.trim();
            renderList();
        }, SEARCH_DEBOUNCE_MS);
    });
    searchClear.addEventListener('click', () => {
        clearTimeout(timer);
        clearSearch();
        renderList();
        searchInput.focus();
    });
    document.addEventListener('keydown', (event) => {
        const typing = event.target.matches('input:not([type="checkbox"]), select, textarea');
        const shortcut = (event.key === 'k' && (event.ctrlKey || event.metaKey)) || (event.key === '/' && !typing);
        if (shortcut && !isDialogOpen()) {
            event.preventDefault();
            searchInput.focus();
        }
    });
}

function initGuestBanner() {
    byId('trk-guest-banner-close').addEventListener('click', () => {
        writeStored('guestBannerDismissed', true);
        syncBanners();
    });
    window.addEventListener('online', syncBanners);
    window.addEventListener('offline', syncBanners);
}

applyLabels();
initTheme(byId('ui-theme-toggle'));
initSky();
initLangToggle(byId('ui-lang-toggle'));
onLangChange(loadData);
initGuestBanner();
initSearch();
initHeaderShadow();
bulkOpenButton.addEventListener('click', openBulk);
onStoredChange('progress', () => {
    if (signedIn) return;
    progress.reloadLocal();
    if (catalog) list.syncAll(refreshCounts());
});
loadData();
