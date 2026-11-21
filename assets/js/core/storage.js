// localStorage can throw or come back empty (private window, cleared data), so every access is guarded.
const PREFIX = 'ga.';

export function readStored(key, fallback = null) {
    try {
        const raw = localStorage.getItem(PREFIX + key);
        return raw === null ? fallback : JSON.parse(raw);
    } catch {
        return fallback;
    }
}

/** Runs when another tab changes this key. A null event key means that tab cleared all storage. */
export function onStoredChange(key, listener) {
    window.addEventListener('storage', (event) => {
        if (event.key === PREFIX + key || event.key === null) listener();
    });
}

/** Returns false when the value could not be saved. */
export function writeStored(key, value) {
    try {
        localStorage.setItem(PREFIX + key, JSON.stringify(value));
        return true;
    } catch {
        return false;
    }
}
