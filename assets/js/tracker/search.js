// Client-side fuzzy search over names, stage titles and descriptions in the active language.
const indexes = new WeakMap();

/** Shared by search and bulk mark matching: lower case, no accents, no quote characters. */
export function normalize(text) {
    return text
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/["'`‘’“”]/g, '')
        .toLowerCase();
}

function tokensOf(query) {
    return normalize(query).split(/\s+/).filter(Boolean);
}

function words(text) {
    return [...new Set(text.split(/[^\p{L}\p{N}]+/u).filter((word) => word.length >= 3))];
}

function indexOf(item) {
    let index = indexes.get(item);
    if (!index) {
        const titles = normalize(item.stages.map((stage) => stage.title).join(' '));
        const description = normalize([item.description, ...item.stages.map((stage) => stage.description)].join(' '));
        const name = normalize(item.name);
        index = { name, titles, description, nameWords: words(name), otherWords: words(`${titles} ${description}`) };
        indexes.set(item, index);
    }
    return index;
}

function withinEdits(a, b, limit) {
    if (Math.abs(a.length - b.length) > limit) return false;
    let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const current = [i];
        let best = i;
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
            best = Math.min(best, current[j]);
        }
        if (best > limit) return false;
        previous = current;
    }
    return previous[b.length] <= limit;
}

function scoreToken(token, index) {
    if (index.name.includes(token)) return index.name.startsWith(token) ? 10 : 8;
    if (index.titles.includes(token)) return 6;
    if (index.description.includes(token)) return 4;
    if (token.length < 4) return 0;
    const limit = token.length >= 7 ? 2 : 1;
    if (index.nameWords.some((word) => withinEdits(token, word, limit))) return 3;
    if (index.otherWords.some((word) => withinEdits(token, word, limit))) return 1;
    return 0;
}

/** Returns a Map of achievement key to score. Every word of the query must match. */
export function searchItems(items, query) {
    const tokens = tokensOf(query);
    const scores = new Map();
    for (const item of items) {
        const index = indexOf(item);
        let total = 0;
        for (const token of tokens) {
            const score = scoreToken(token, index);
            if (score === 0) {
                total = 0;
                break;
            }
            total += score;
        }
        if (total > 0) scores.set(item.key, total);
    }
    return scores;
}

function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Builds text with exact query words wrapped in <mark>, using DOM nodes only. */
export function highlighted(text, query) {
    const fragment = document.createDocumentFragment();
    const tokens = query.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
        fragment.append(text);
        return fragment;
    }
    const pattern = new RegExp(`(${tokens.map(escapeRegExp).join('|')})`, 'giu');
    text.split(pattern).forEach((part, position) => {
        if (position % 2 === 1) {
            const mark = document.createElement('mark');
            mark.className = 'trk-hit';
            mark.textContent = part;
            fragment.append(mark);
        } else if (part) {
            fragment.append(part);
        }
    });
    return fragment;
}
