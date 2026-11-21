// Bulk mark Inquiry (PRD 5.6): reads the input and reports what would change. It never writes progress and has no DOM.
import { normalize } from './search.js';

export const MODE_NAME = 'name';
export const MODE_JSON = 'json';

const nameIndexes = new WeakMap();

const matchKey = (text) => normalize(text).trim().replace(/\s+/g, ' ');

function nameIndex(catalog) {
    let index = nameIndexes.get(catalog);
    if (!index) {
        index = new Map();
        for (const item of catalog.items) {
            const key = matchKey(item.name);
            index.set(key, [...(index.get(key) ?? []), item]);
        }
        nameIndexes.set(catalog, index);
    }
    return index;
}

function parseNameLines(text) {
    const entries = [];
    text.split(/\r?\n/).forEach((line, position) => {
        if (line.trim()) entries.push({ line: position + 1, input: line.trim(), stage: null });
    });
    return { entries, invalid: [] };
}

/** The line where each top-level array value starts, so a bad item can be pointed at exactly. */
function arrayValueLines(text) {
    const lines = [];
    let line = 1;
    let depth = 0;
    let inString = false;
    let escaped = false;
    let expectValue = false;
    for (const char of text) {
        if (char === '\n') line++;
        if (inString) {
            if (escaped) escaped = false;
            else if (char === '\\') escaped = true;
            else if (char === '"') inString = false;
            continue;
        }
        if (/\s/.test(char)) continue;
        if (depth === 1 && expectValue) {
            if (char !== ']') lines.push(line);
            expectValue = false;
        }
        if (char === '"') {
            inString = true;
        } else if (char === '[' || char === '{') {
            depth++;
            if (depth === 1) expectValue = true;
        } else if (char === ']' || char === '}') {
            depth--;
        } else if (char === ',' && depth === 1) {
            expectValue = true;
        }
    }
    return lines;
}

function syntaxErrorLine(error, text) {
    const lineMatch = /line (\d+)/.exec(error.message);
    if (lineMatch) return Number(lineMatch[1]);
    const positionMatch = /position (\d+)/.exec(error.message);
    return positionMatch ? text.slice(0, Number(positionMatch[1])).split('\n').length : null;
}

function parseJsonItems(text) {
    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch (error) {
        return { entries: [], invalid: [{ line: syntaxErrorLine(error, text), message: 'Invalid JSON.' }] };
    }
    if (!Array.isArray(parsed)) {
        return { entries: [], invalid: [{ line: 1, message: 'The JSON must be an array of items.' }] };
    }

    const lines = arrayValueLines(text);
    const entries = [];
    const invalid = [];
    parsed.forEach((item, position) => {
        const line = lines[position] ?? null;
        const label = `Item ${position + 1}`;
        if (item === null || typeof item !== 'object' || Array.isArray(item)) {
            invalid.push({ line, message: `${label}: must be an object with name and stage.` });
        } else if (typeof item.name !== 'string' || !item.name.trim()) {
            invalid.push({ line, message: `${label}: name must be a non-empty text.` });
        } else if (!Number.isInteger(item.stage) || item.stage < 1) {
            invalid.push({ line, message: `${label}: stage must be a whole number from 1.` });
        } else {
            entries.push({ line, input: item.name.trim(), stage: item.stage, label });
        }
    });
    return { entries, invalid };
}

function matchesIn(catalog, key, activeCatalog) {
    return (nameIndex(catalog).get(key) ?? []).map((item) => activeCatalog.itemByKey.get(item.key));
}

/**
 * Matching uses the active language first, then the other language.
 * loadOther() runs only when a name was not found, and a failure there only narrows the search.
 */
export async function runInquiry({ mode, text, catalog, loadOther, progress, maxItems }) {
    const { entries, invalid } = mode === MODE_JSON ? parseJsonItems(text) : parseNameLines(text);
    const report = { found: [], alreadyDone: [], ambiguous: [], notFound: [], invalid, fallbackFailed: false, tooMany: false };

    if (entries.length + invalid.length > maxItems) {
        report.tooMany = true;
        report.invalid = [];
        return report;
    }

    let other = null;
    const needsOther = entries.some((entry) => !nameIndex(catalog).has(matchKey(entry.input)));
    if (needsOther) {
        try {
            other = await loadOther();
        } catch {
            report.fallbackFailed = true;
        }
    }

    for (const entry of entries) {
        const key = matchKey(entry.input);
        let candidates = matchesIn(catalog, key, catalog);
        if (candidates.length === 0 && other) candidates = matchesIn(other, key, catalog);

        if (candidates.length === 0) {
            report.notFound.push({ line: entry.line, input: entry.input });
            continue;
        }

        const fitting = entry.stage === null ? candidates : candidates.filter((item) => entry.stage <= item.stages.length);
        if (fitting.length === 0) {
            const most = Math.max(...candidates.map((item) => item.stages.length));
            report.invalid.push({ line: entry.line, message: `${entry.label}: stage must be from 1 to ${most} for "${entry.input}".` });
        } else if (fitting.length > 1) {
            report.ambiguous.push({ line: entry.line, input: entry.input, stage: entry.stage, candidates: fitting, choice: null });
        } else {
            const item = fitting[0];
            const result = { line: entry.line, input: entry.input, stage: entry.stage, item };
            const pending = progress.missingStages(item, entry.stage ?? item.stages.length);
            (pending.length > 0 ? report.found : report.alreadyDone).push(result);
        }
    }

    report.invalid.sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
    return report;
}

/** Stage ids that Apply would add. Not found and invalid entries are never part of it. */
export function stageIdsToApply(report, progress) {
    const ids = new Set();
    const add = (item, stage) => progress.missingStages(item, stage ?? item.stages.length).forEach((id) => ids.add(id));
    report.found.forEach((entry) => add(entry.item, entry.stage));
    report.ambiguous.forEach((entry) => {
        if (entry.choice) add(entry.choice, entry.stage);
    });
    return [...ids];
}
