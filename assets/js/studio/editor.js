// Edit Tutorial (PRD 5.7, API 4.2, DESIGN 4.5): language tabs, TinyMCE, video, lock, autosave and the review actions.
import { apiBeacon, apiPost, apiUpload } from '../core/api.js';
import { byId, el, icon, setButtonLoading } from '../core/dom.js';
import { applyLabels, formatPerson, formatTime, getLang, onLangChange, t } from '../core/i18n.js';
import { alertInfo, closePopup, confirmAction, confirmDanger, lockLost, lockWarning, openDialog } from '../core/modal.js';
import { onThemeChange } from '../core/theme.js';
import { toastError, toastSuccess } from '../core/toast.js';
import { tooltip } from '../core/tooltip.js';
import { renderTutorial } from '../core/tutorial-view.js';
import { createLockKeeper } from './lock.js';
import { bootAdmin, leaveWithToast } from './shell.js';
import { createEditor } from './tinymce-config.js';
import { statusChip } from './ui.js';

const LANGS = ['id', 'en'];
const LIST_PATH = 'studio/tutorials.php';
const YOUTUBE_ID = /(?:youtu\.be\/|[?&]v=|\/(?:embed|shorts|live|v)\/)([A-Za-z0-9_-]{11})(?:[?&/#]|$)/;

const { dataset } = document.body;
const achievementId = Number(dataset.achievementId);
const autosaveMs = Number(dataset.autosaveSeconds) * 1000;
const names = { id: dataset.nameId, en: dataset.nameEn };

const context = await bootAdmin();
const root = byId('adm-root');
const title = byId('adm-page-title');

const session = {
    tutorialId: null,
    versionId: null,
    status: null,
    takeOver: false,
    holdsLock: false,
    leaving: false,
    keeper: null,
    changes: 0,
    savedChanges: 0,
    inFlight: null,
};
const panels = {}; // lang => { textarea, editor, slot, videoInput, videoError, preview, tabIcon }
let activeLang = getLang();
let warningOpen = false;
let ui = null;

const isDirty = () => session.changes !== session.savedChanges;

function goToList() {
    session.leaving = true;
    window.location.assign(new URL(LIST_PATH, document.baseURI).href);
}

function markChanged() {
    session.changes++;
    session.keeper?.markActive();
    refreshTabIcons();
}

/* ---------- content ---------- */

function bodyOf(lang) {
    const panel = panels[lang];
    return panel.editor ? panel.editor.getContent() : panel.textarea.value;
}

function hasContent(lang) {
    const text = bodyOf(lang).replace(/<(?!img)[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    return text !== '' || panels[lang].videoInput.value.trim() !== '';
}

function refreshTabIcons() {
    LANGS.forEach((lang) => {
        panels[lang].tabIcon.hidden = !hasContent(lang);
    });
}

async function collectContent() {
    await Promise.all(LANGS.map((lang) => panels[lang].editor?.uploadImages()));
    return Object.fromEntries(LANGS.map((lang) => [lang, {
        body_html: bodyOf(lang),
        video_url: panels[lang].videoInput.value.trim(),
    }]));
}

function plainText() {
    const toText = (html) => new DOMParser().parseFromString(html, 'text/html').body.textContent;
    return LANGS.map((lang) => `[${lang.toUpperCase()}]\n${toText(bodyOf(lang))}\n${panels[lang].videoInput.value}`).join('\n\n');
}

/* ---------- saving ---------- */

function setSaveStatus(key, vars) {
    ui.saveStatus.textContent = t(key, vars);
}

function showFieldErrors(fields) {
    let shown = false;
    LANGS.forEach((lang) => {
        const message = fields[`content_input.${lang}.video_url`];
        const { videoError } = panels[lang];
        videoError.hidden = !message;
        if (message) {
            videoError.replaceChildren(icon('ph ph-warning-circle'), el('span', { text: message }));
            shown = true;
        }
    });
    return shown;
}

function clearFieldErrors() {
    LANGS.forEach((lang) => {
        panels[lang].videoError.hidden = true;
    });
}

/** The server is the only judge of the lock; every path that loses it ends here. */
function handleLockError(error) {
    if (error.code === 'LOCK_LOST') {
        stopForLostLock(error.message);
        return true;
    }
    if (error.code === 'UNAUTHENTICATED' || error.code === 'ACCOUNT_DISABLED') {
        stopForLostLock(error.code === 'UNAUTHENTICATED' ? 'Please sign in again. Your text is still here.' : error.message);
        return true;
    }
    return false;
}

/** Runs one save at a time. Resolves to true when the content on the server matches what was on screen at the start. */
async function save({ autosave }) {
    if (session.inFlight) await session.inFlight.catch(() => {});
    if (!session.holdsLock) return false;
    session.inFlight = (async () => {
        const changeMark = session.changes;
        setSaveStatus('saveSaving');
        const contentInput = await collectContent();
        const result = await apiPost('editor', 'save', { tutorial_id: session.tutorialId, content_input: contentInput, autosave });
        session.savedChanges = changeMark;
        session.versionId = result.version_id;
        if (session.status !== result.status) {
            session.status = result.status;
            renderStatus();
        }
        ui.rejection.hidden = true;
        ui.discard.hidden = false;
        clearFieldErrors();
        setSaveStatus('saveDone', { time: formatTime(new Date(result.saved_at)) });
    })();
    try {
        await session.inFlight;
        return true;
    } catch (error) {
        setSaveStatus('saveFailed');
        if (handleLockError(error)) return false;
        if (error.code === 'VALIDATION_FAILED' && showFieldErrors(error.details.fields ?? {})) {
            if (!autosave) toastError(error.message);
            return false;
        }
        if (!autosave) toastError(error.message);
        return false;
    } finally {
        session.inFlight = null;
    }
}

/** Saves only when there is something new, or no version row exists yet. */
const saveIfNeeded = () => (isDirty() || session.versionId === null ? save({ autosave: false }) : Promise.resolve(true));

/* ---------- lock ---------- */

/** callout (optional) is the blue info box in the popup; only the timeout sends one. */
async function stopForLostLock(message, callout = null) {
    session.holdsLock = false;
    session.keeper?.stop();
    setEnabled(false);
    closePopup();
    const reopen = await lockLost({
        text: message,
        callout,
        onCopy: () => {
            navigator.clipboard.writeText(plainText())
                .then(() => toastSuccess(t('copyDone')))
                .catch(() => toastError('Could not copy the text.'));
        },
    });
    if (!reopen) return;
    const opened = await requestLock();
    if (opened) startLock(opened.lock, opened.tutorial_id);
}

function formatCountdown(seconds) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function startLock(lock, tutorialId) {
    session.tutorialId = tutorialId;
    session.holdsLock = true;
    setEnabled(true);
    session.keeper = createLockKeeper({
        tutorialId,
        lock,
        onTick: (left, warning) => {
            ui.lockTime.textContent = formatCountdown(left);
            ui.lock.classList.toggle('is-warning', warning);
        },
        onWarn: showLockWarning,
        onTimeout: handleTimeout,
        onLost: (error) => handleLockError(error),
    });
}

async function showLockWarning() {
    warningOpen = true;
    if (isDirty()) save({ autosave: true });
    const choice = await lockWarning({
        title: t('lockWarningTitle'),
        renderText: () => t('lockWarningText', { time: formatCountdown(session.keeper.secondsLeft()) }),
    });
    warningOpen = false;
    if (choice === 'keep') session.keeper.keepEditing();
    if (choice === 'close') closeEditor();
}

/** Text is autosaved as a draft before the lock goes, so nothing typed is lost (PRD 5.7). */
async function handleTimeout() {
    if (warningOpen) closePopup();
    const saved = isDirty() ? await save({ autosave: true }) : true;
    if (session.holdsLock) {
        apiPost('editor', 'release', { tutorial_id: session.tutorialId }).catch(() => {});
    }
    const callout = [t('lockReleasedInfo'), t(saved ? 'lockReleasedSaved' : 'lockReleasedUnsaved'), t('lockReleasedReopen')].join(' ');
    stopForLostLock('Your edit lock expired.', callout);
}

/** Resolves to the open result, or null after explaining why the editor cannot open. */
async function requestLock() {
    try {
        return await apiPost('editor', 'open', { achievement_id: achievementId, take_over: session.takeOver });
    } catch (error) {
        return explainOpenFailure(error);
    }
}

async function explainOpenFailure(error) {
    const { details } = error;
    if (error.code === 'LOCK_HELD') {
        await alertInfo({ title: t('lockHeldTitle'), text: t('lockHeldText', { name: formatPerson(details.locked_by_name, details.locked_by_email), time: formatTime(new Date(details.expires_at)) }) });
    } else if (error.code === 'OPEN_VERSION_EXISTS' && context.isAdmin) {
        const takeOver = await confirmAction({
            title: t('takeOverTitle'),
            text: t('takeOverText', { name: formatPerson(details.owner_name, details.owner_email) }),
            confirmLabel: 'Take Over',
        });
        if (takeOver) {
            session.takeOver = true;
            return requestLock();
        }
    } else if (error.code === 'OPEN_VERSION_EXISTS') {
        await alertInfo({ title: t('openVersionTitle'), text: t('openVersionText', { name: formatPerson(details.owner_name, details.owner_email) }) });
    } else if (error.code === 'INVALID_STATE') {
        await alertInfo({ title: t('pendingLockedTitle'), text: t('pendingLockedText') });
    } else {
        await alertInfo({ title: 'Error', text: error.message });
    }
    goToList();
    return null;
}

/* ---------- actions ---------- */

function setEnabled(enabled) {
    [ui.save, ui.preview, ui.primary, ui.discard].forEach((button) => {
        button.disabled = !enabled;
    });
    LANGS.forEach((lang) => {
        panels[lang].editor?.mode.set(enabled ? 'design' : 'readonly');
        panels[lang].videoInput.disabled = !enabled;
    });
}

async function onSave() {
    setButtonLoading(ui.save, true);
    await save({ autosave: false });
    if (ui.save.isConnected) setButtonLoading(ui.save, false);
}

async function onPrimary() {
    const action = context.isAdmin ? 'publish' : 'submit';
    setButtonLoading(ui.primary, true);
    try {
        if (!(await saveIfNeeded())) return;
        await apiPost('editor', action, { tutorial_id: session.tutorialId });
        session.holdsLock = false;
        session.keeper.stop();
        session.leaving = true;
        leaveWithToast(LIST_PATH, t(context.isAdmin ? 'publishDone' : 'submitDone'));
    } catch (error) {
        if (!handleLockError(error)) toastError(error.details?.fields?.content_input ?? error.message);
    } finally {
        if (!session.leaving) setButtonLoading(ui.primary, false);
    }
}

async function onDiscard() {
    const confirmed = await confirmDanger({ title: t('discardTitle'), text: t('discardWarning'), confirmLabel: 'Discard' });
    if (!confirmed) return;
    try {
        await apiPost('editor', 'discard', { version_id: session.versionId });
        session.holdsLock = false;
        session.keeper.stop();
        session.leaving = true;
        leaveWithToast(LIST_PATH, t('discardDone'));
    } catch (error) {
        toastError(error.message);
    }
}

/** Shows what readers will get: the saved draft, as the server sanitized it. */
async function onPreview() {
    setButtonLoading(ui.preview, true);
    try {
        if (!(await saveIfNeeded())) return;
        const { content } = await apiPost('editor', 'open', { achievement_id: achievementId, take_over: session.takeOver });
        openDialog({ title: names[activeLang], subtitle: 'Preview', body: renderTutorial(content, activeLang) });
    } catch (error) {
        if (!handleLockError(error)) toastError(error.message);
    } finally {
        setButtonLoading(ui.preview, false);
    }
}

async function closeEditor() {
    if (isDirty() && !(await save({ autosave: false }))) return;
    session.keeper?.stop();
    if (session.holdsLock) {
        session.holdsLock = false;
        await apiPost('editor', 'release', { tutorial_id: session.tutorialId }).catch(() => {});
    }
    goToList();
}

async function uploadImage(blob, name) {
    const form = new FormData();
    form.append('file', blob, name);
    form.append('tutorial_id', String(session.tutorialId));
    try {
        const { location } = await apiUpload('uploads', 'image', form);
        markChanged();
        return location;
    } catch (error) {
        if (!handleLockError(error)) toastError(error.message);
        throw { message: error.message, remove: true };
    }
}

/* ---------- building the page ---------- */

function renderStatus() {
    ui.status.replaceChildren(session.status ? statusChip(session.status) : el('span', { className: 'adm-status adm-status-new', text: t('statusNew'), attrs: { 'data-i18n': 'statusNew' } }));
}

function updateThumbnail(lang) {
    const { videoInput, preview } = panels[lang];
    const id = videoInput.value.match(YOUTUBE_ID)?.[1];
    preview.replaceChildren(id ? el('img', { attrs: { src: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`, alt: '', width: 320, height: 180, loading: 'lazy' } }) : '');
    preview.hidden = !id;
}

function buildPanel(lang, translation) {
    const textarea = el('textarea', { attrs: { id: `adm-body-${lang}`, 'aria-label': `${t('editorBody')} (${lang.toUpperCase()})` } });
    textarea.value = translation?.body_html ?? '';
    const inputId = `adm-video-${lang}`;
    const videoInput = el('input', {
        className: 'ui-input',
        attrs: { id: inputId, type: 'url', inputmode: 'url', autocomplete: 'off', placeholder: 'https://www.youtube.com/watch?v=...' },
        on: {
            input: () => {
                markChanged();
                updateThumbnail(lang);
            },
        },
    });
    videoInput.value = translation?.video ? `https://youtu.be/${translation.video.video_id}` : '';
    const videoError = el('p', { className: 'ui-field-error', attrs: { hidden: true } });
    const preview = el('div', { className: 'adm-video-preview', attrs: { hidden: true } });
    const slot = el('div', { className: 'adm-editor-panel' }, [
        el('div', { className: 'adm-tinymce-frame' }, [textarea]),
        el('div', { className: 'ui-field' }, [
            el('label', { className: 'ui-label', text: t('editorVideo'), attrs: { for: inputId, 'data-i18n': 'editorVideo' } }),
            videoInput,
            videoError,
            el('p', { className: 'ui-field-help', text: t('editorVideoHelp'), attrs: { 'data-i18n': 'editorVideoHelp' } }),
            preview,
        ]),
    ]);
    const tabIcon = icon('ph-fill ph-check-circle');
    panels[lang] = { textarea, editor: null, slot, videoInput, videoError, preview, tabIcon };
}

async function mountEditor(lang) {
    const panel = panels[lang];
    panel.editor = await createEditor({ target: panel.textarea, onChange: markChanged, uploadImage });
    refreshTabIcons();
}

/** The second language's editor starts on first use, so opening the page stays quick. */
async function showTab(lang) {
    activeLang = lang;
    LANGS.forEach((code) => {
        panels[code].slot.hidden = code !== lang;
        ui.tabs[code].setAttribute('aria-pressed', String(code === lang));
    });
    if (!panels[lang].editor) await mountEditor(lang);
}

/** TinyMCE cannot change skin in place, so both editors restart with their current text. */
async function restartEditors() {
    await Promise.all(LANGS.map(async (lang) => {
        const panel = panels[lang];
        if (!panel.editor) return;
        panel.textarea.value = panel.editor.getContent();
        panel.editor.remove();
        panel.editor = null;
        if (lang === activeLang) await mountEditor(lang);
    }));
}

function buildPage(opened) {
    LANGS.forEach((lang) => buildPanel(lang, opened.content[lang]));

    const tabs = Object.fromEntries(LANGS.map((lang) => [lang, el('button', {
        attrs: { type: 'button' },
        on: { click: () => showTab(lang) },
    }, [el('span', { text: lang.toUpperCase() }), panels[lang].tabIcon])]));

    const makeButton = (label, classes, onClick) => el('button', { className: `ui-btn ${classes}`, text: label, attrs: { type: 'button' }, on: { click: onClick } });

    ui = {
        tabs,
        status: el('span'),
        lock: el('span', { className: 'adm-lock-status' }),
        lockTime: el('span', { className: 'adm-lock-time' }),
        rejection: el('div', { className: 'ui-banner adm-banner-danger', attrs: { role: 'status', hidden: !opened.rejection_reason } }, [
            icon('ph ph-warning-circle'),
            el('p', { text: t('rejectedReason', { reason: opened.rejection_reason ?? '' }) }),
        ]),
        saveStatus: el('span', { className: 'adm-save-status', attrs: { role: 'status' } }),
        save: makeButton('Save', 'ui-btn-secondary', onSave),
        preview: makeButton('Preview', 'ui-btn-ghost', onPreview),
        primary: makeButton(context.isAdmin ? 'Publish' : 'Submit for Review', 'ui-btn-primary', onPrimary),
        discard: makeButton('Discard', 'ui-btn-danger', onDiscard),
    };
    ui.discard.hidden = opened.version_id === null;
    ui.lock.append(icon('ph ph-lock-simple'), el('span', { text: t('lockedByYou'), attrs: { 'data-i18n': 'lockedByYou' } }), ui.lockTime);
    tooltip(ui.lock, () => t('lockedByYouHint'));

    const back = el('button', {
        className: 'ui-icon-btn',
        attrs: { type: 'button', 'aria-label': 'Back to All Tutorials' },
        on: { click: closeEditor },
    }, [icon('ph ph-arrow-left')]);

    root.replaceChildren(
        el('div', { className: 'adm-editor-bar' }, [back, ui.status, ui.lock]),
        ui.rejection,
        el('div', { className: 'ui-segmented adm-editor-tabs', attrs: { role: 'group', 'aria-label': t('editorLanguage') } }, Object.values(tabs)),
        ...LANGS.map((lang) => panels[lang].slot),
        el('div', { className: 'adm-action-bar' }, [ui.saveStatus, el('div', { className: 'adm-action-buttons' }, [ui.discard, ui.preview, ui.save, ui.primary])]),
    );
    renderStatus();
    LANGS.forEach(updateThumbnail);
    refreshTabIcons();
}

function initPageEvents() {
    // Any interaction counts as activity, not only typing.
    ['keydown', 'pointerdown'].forEach((type) => document.addEventListener(type, () => session.keeper?.markActive(), { passive: true }));

    setInterval(() => {
        if (session.holdsLock && isDirty() && !session.inFlight) save({ autosave: true });
    }, autosaveMs);

    window.addEventListener('beforeunload', (event) => {
        if (isDirty() && !session.leaving) event.preventDefault();
    });
    window.addEventListener('pagehide', () => {
        if (session.holdsLock) apiBeacon('editor', 'release', { tutorial_id: session.tutorialId });
    });
    // Back from the browser cache: the lock was released on the way out, so read it fresh.
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) window.location.reload();
    });

    onThemeChange(restartEditors);
    onLangChange(() => {
        title.textContent = names[getLang()];
        applyLabels(root);
    });
}

title.textContent = names[getLang()];
const opened = await requestLock();
if (opened) {
    session.versionId = opened.version_id;
    session.status = opened.status;
    buildPage(opened);
    startLock(opened.lock, opened.tutorial_id);
    initPageEvents();
    await showTab(activeLang);
}
