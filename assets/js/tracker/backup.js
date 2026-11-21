// Manual backup (PRD 5.4): export the progress as a JSON file, and read one back. Import only adds progress.
const MAX_FILE_BYTES = 1048576; // Same 1 MB cap as a request body (API 1).

export function exportProgress(progress) {
    const blob = new Blob([JSON.stringify(progress.snapshot(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `genshin-achievements-progress-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

/** Returns the stage ids to add. Unknown ids are skipped and earlier stages are included. Throws with an English message. */
export async function readBackup(file, { catalog, progress, maxItems }) {
    if (file.size > MAX_FILE_BYTES) throw new Error('This file is larger than 1 MB.');

    let done;
    try {
        done = JSON.parse(await file.text()).done;
    } catch {
        throw new Error('This file is not valid JSON.');
    }
    if (!done || typeof done !== 'object' || Array.isArray(done)) {
        throw new Error('This file is not a progress backup.');
    }

    const stageIds = Object.keys(done);
    if (stageIds.length > maxItems) throw new Error(`This file holds more than ${maxItems} stages.`);

    const toAdd = new Set();
    for (const stageId of stageIds) {
        const entry = catalog.stageIndex.get(Number(stageId));
        if (entry) progress.missingStages(entry.item, entry.index + 1).forEach((id) => toAdd.add(id));
    }
    return [...toAdd];
}
