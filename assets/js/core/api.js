// The one client for every API call (API 6.3): CSRF header, envelope parsing, typed errors.
let csrfToken = null;

export class ApiError extends Error {
    constructor(code, message, details = {}) {
        super(message);
        this.code = code;
        this.details = details;
    }
}

export function setCsrf(token) {
    csrfToken = token;
}

function apiUrl(resource, action, params = {}) {
    const query = new URLSearchParams({ action });
    for (const [name, value] of Object.entries(params)) {
        if (value !== '' && value !== null && value !== undefined) query.set(name, value);
    }
    return `api/${resource}.php?${query}`;
}

/** pick chooses what the caller gets from a successful body. */
async function request(url, options, pick = (body) => body.data) {
    let response;
    try {
        response = await fetch(url, options);
    } catch {
        // Client-side only: the request never reached the server.
        throw new ApiError('OFFLINE', 'You appear to be offline.');
    }
    let body;
    try {
        body = await response.json();
    } catch {
        throw new ApiError('SERVER_ERROR', 'Something went wrong. Please try again.');
    }
    if (body.ok === false) {
        throw new ApiError(body.error.code, body.error.message, body.error.details ?? {});
    }
    return pick(body);
}

const readOptions = { headers: { Accept: 'application/json' } };

export function apiGet(resource, action, params) {
    return request(apiUrl(resource, action, params), readOptions);
}

/** A list action: resolves to { items, meta } (API section 1). */
export function apiGetPage(resource, action, params) {
    return request(apiUrl(resource, action, params), readOptions, (body) => ({ items: body.data, meta: body.meta }));
}

function postOptions(body) {
    return {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': csrfToken ?? '' },
        body: JSON.stringify(body),
    };
}

/** CSRF_INVALID: fetch a fresh token and retry once. */
async function withCsrfRetry(send) {
    try {
        return await send();
    } catch (error) {
        if (error.code !== 'CSRF_INVALID') throw error;
        const { csrf } = await apiGet('auth', 'csrf');
        setCsrf(csrf);
        return send();
    }
}

export function apiPost(resource, action, body = {}) {
    return withCsrfRetry(() => request(apiUrl(resource, action), postOptions(body)));
}

/** uploads.image answers in TinyMCE's own shape, without the envelope (API 4.4). */
export function apiUpload(resource, action, formData) {
    return withCsrfRetry(() => request(apiUrl(resource, action), {
        method: 'POST',
        headers: { Accept: 'application/json', 'X-CSRF-Token': csrfToken ?? '' },
        body: formData,
    }, (body) => body));
}

/** For a page that is closing: sendBeacon cannot set headers, so the token travels in the body. */
export function apiBeacon(resource, action, body) {
    const payload = new Blob([JSON.stringify({ ...body, csrf: csrfToken })], { type: 'application/json' });
    return navigator.sendBeacon(apiUrl(resource, action), payload);
}
