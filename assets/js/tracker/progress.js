// Progress for both modes behind one object. Guest: localStorage, format { version, updatedAt, done: { [stageId]: timestamp } }
// (PRD 5.4). Signed in: MySQL through the API, with the same state in memory so the screen can update at once.
import { apiGet, apiPost } from '../core/api.js';
import { readStored, writeStored } from '../core/storage.js';

const KEY = 'progress';
const BULK_HISTORY_KEY = 'bulkHistory';
const FORMAT_VERSION = 1;

function readLocalDone() {
    const done = readStored(KEY)?.done;
    return done && typeof done === 'object' ? { ...done } : {};
}

export function createProgress() {
    let done = readLocalDone();
    let cloud = false;
    let cloudLastBulk = null; // { historyId, count, createdAt }
    let saveQueue = Promise.resolve();

    const isDone = (stageId) => stageId in done;

    function apply({ added, removed }) {
        const now = Date.now();
        added.forEach((id) => {
            done[id] = now;
        });
        removed.forEach((id) => {
            delete done[id];
        });
    }

    function revert({ added, removed }) {
        apply({ added: removed, removed: added });
    }

    const snapshot = () => ({ version: FORMAT_VERSION, updatedAt: Date.now(), done: { ...done } });

    function persistLocal() {
        if (!writeStored(KEY, snapshot())) throw new Error('Could not save to this browser.');
    }

    function setCloudStages(stageIds) {
        const now = Date.now();
        done = Object.fromEntries(stageIds.map((id) => [id, now]));
    }

    /** Saves run in click order, so two quick clicks on one achievement cannot arrive reversed. */
    function queued(work) {
        const run = saveQueue.then(work, work);
        saveQueue = run.catch(() => {});
        return run;
    }

    return {
        isDone,
        apply,
        revert,
        snapshot,

        isCloud: () => cloud,

        useGuest() {
            cloud = false;
            cloudLastBulk = null;
            done = readLocalDone();
        },

        async useCloud() {
            const [{ stage_ids: stageIds }, last] = await Promise.all([apiGet('progress', 'list'), apiGet('bulk', 'last')]);
            cloud = true;
            setCloudStages(stageIds);
            cloudLastBulk = last?.can_undo ? { historyId: last.history_id, count: last.count, createdAt: Date.parse(last.created_at) } : null;
        },

        /** Another tab saved Guest progress: take its copy, so this tab never overwrites it with a stale one. */
        reloadLocal() {
            if (!cloud) done = readLocalDone();
        },

        /** Stage ids of Guest progress waiting in this browser, for the import after sign-in. */
        localStageIds() {
            return Object.keys(readLocalDone()).map(Number);
        },

        /** Called only after the server confirmed the import (API 3.2). */
        clearLocal() {
            writeStored(KEY, null);
            writeStored(BULK_HISTORY_KEY, null);
        },

        isItemDone(item) {
            return item.stages.every((stage) => isDone(stage.id));
        },

        /** Started but not finished: some stages done, not all. A single-stage achievement is never in progress. */
        isItemInProgress(item) {
            const doneStages = item.stages.filter((stage) => isDone(stage.id)).length;
            return doneStages > 0 && doneStages < item.stages.length;
        },

        /** Stage ids still open among the first stageCount stages of an achievement. */
        missingStages(item, stageCount) {
            return item.stages.slice(0, stageCount).filter((stage) => !isDone(stage.id)).map((stage) => stage.id);
        },

        /** Stages are dependent: checking marks every earlier stage, unchecking clears every later one. */
        plan(item, stageIndex, checked) {
            const scope = checked ? item.stages.slice(0, stageIndex + 1) : item.stages.slice(stageIndex);
            const changed = scope.filter((stage) => isDone(stage.id) !== checked).map((stage) => stage.id);
            return checked ? { added: changed, removed: [] } : { added: [], removed: changed };
        },

        /**
         * Saves a change the screen already shows. Throws when saving fails, so the caller rolls back.
         * Returns true when the server changed more than planned, so the caller repaints.
         */
        async saveStage(stageId, checked, planned) {
            if (!cloud) {
                persistLocal();
                return false;
            }
            const result = await queued(() => apiPost('progress', 'set', { stage_id: stageId, done: checked }));
            // The server's lists are the final truth. An id it did not report was already in that state there.
            const known = new Set([...planned.added, ...planned.removed]);
            const unexpected = [...result.added, ...result.removed].some((id) => !known.has(id));
            apply(result);
            return unexpected;
        },

        /** Adds stage ids as one bulk action. Undo never removes older progress. Throws when saving fails. */
        async commitBulk(stageIds) {
            const changes = { added: stageIds, removed: [] };
            if (cloud) {
                const result = await queued(() => apiPost('bulk', 'apply', { stage_ids: stageIds }));
                apply(changes);
                cloudLastBulk = { historyId: result.history_id, count: result.added_count, createdAt: Date.now() };
                return;
            }
            apply(changes);
            try {
                persistLocal();
            } catch (error) {
                revert(changes);
                throw error;
            }
            writeStored(BULK_HISTORY_KEY, { stageIds, createdAt: Date.now() });
        },

        /** { count, createdAt } of the action Undo would revert, or null. */
        lastBulk() {
            if (cloud) return cloudLastBulk;
            const history = readStored(BULK_HISTORY_KEY);
            return Array.isArray(history?.stageIds) && history.stageIds.length > 0
                ? { count: history.stageIds.length, createdAt: history.createdAt }
                : null;
        },

        /**
         * Removes what the last bulk action added and returns the count. A stage stays when a later stage
         * of that achievement is still done, since stages are dependent. Throws when saving fails.
         */
        async undoBulk(catalog) {
            if (cloud) {
                const { removed_count: removedCount } = await queued(() => apiPost('bulk', 'undo', { history_id: cloudLastBulk?.historyId }));
                cloudLastBulk = null;
                setCloudStages((await apiGet('progress', 'list')).stage_ids);
                return removedCount;
            }
            const stageIds = readStored(BULK_HISTORY_KEY)?.stageIds ?? [];
            const added = new Set(stageIds);
            const items = new Set(stageIds.map((id) => catalog.stageIndex.get(id)?.item).filter(Boolean));
            const removed = [];
            for (const item of items) {
                for (const stage of [...item.stages].reverse()) {
                    if (!isDone(stage.id)) continue;
                    if (!added.has(stage.id)) break;
                    removed.push(stage.id);
                }
            }
            const changes = { added: [], removed };
            apply(changes);
            try {
                persistLocal();
            } catch (error) {
                revert(changes);
                throw error;
            }
            writeStored(BULK_HISTORY_KEY, null);
            return removed.length;
        },
    };
}

/** Totals for the summary and the category counts, always computed from the loaded data. */
export function computeStats(catalog, progress) {
    const byGroup = new Map();
    let doneCount = 0;
    let reward = 0;
    for (const group of catalog.groups) {
        let groupDone = 0;
        for (const item of group.items) {
            if (progress.isItemDone(item)) groupDone++;
            for (const stage of item.stages) {
                if (progress.isDone(stage.id)) reward += stage.reward;
            }
        }
        byGroup.set(group.id, groupDone);
        doneCount += groupDone;
    }
    return { doneCount, reward, byGroup };
}

/** Done count and Primogems of any set of achievements, for the narrowed summary panel. */
export function computeTotals(items, progress) {
    let doneCount = 0;
    let reward = 0;
    let totalReward = 0;
    for (const item of items) {
        if (progress.isItemDone(item)) doneCount++;
        totalReward += item.totalReward;
        for (const stage of item.stages) {
            if (progress.isDone(stage.id)) reward += stage.reward;
        }
    }
    return { doneCount, total: items.length, reward, totalReward };
}
