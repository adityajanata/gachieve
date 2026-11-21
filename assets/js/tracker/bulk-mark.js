// Bulk Mark drawer (DESIGN 4.2): input, the Inquiry report, Apply, and the backup actions.
import { el, icon, setButtonLoading } from '../core/dom.js';
import { formatDate, formatNumber, t } from '../core/i18n.js';
import { openDialog } from '../core/modal.js';
import { toastError, toastSuccess } from '../core/toast.js';
import { MODE_JSON, MODE_NAME, runInquiry, stageIdsToApply } from './bulk-inquiry.js';

const SAMPLE_JSON = `[
  { "name": "Lilin Menyala di Tengah Angin", "stage": 2 },
  { "name": "Petualang Belantara Berkilauan", "stage": 3 }
]`;
const OPEN_FOUND_LIMIT = 20;

// The draft survives closing the drawer, so a stray backdrop click loses nothing.
const draft = { mode: MODE_NAME, text: '' };

function resultLine(primary, secondary) {
    return el('li', { className: 'trk-bulk-item' }, [
        el('span', { text: primary }),
        secondary ? el('span', { className: 'trk-bulk-meta', text: secondary }) : null,
    ]);
}

async function copyLines(lines) {
    try {
        await navigator.clipboard.writeText(lines.join('\n'));
        toastSuccess('Copied.');
    } catch {
        toastError('Could not copy. Select the text and copy it by hand.');
    }
}

function resultGroup({ iconClass, tone, title, count, open, copyText, children }) {
    return el('details', { className: `trk-bulk-group trk-bulk-${tone}`, attrs: { open } }, [
        el('summary', { className: 'trk-bulk-summary' }, [
            icon(`${iconClass} trk-bulk-icon`),
            el('span', { className: 'trk-bulk-title', text: title }),
            el('span', { className: 'trk-bulk-count', text: formatNumber(count) }),
        ]),
        el('div', { className: 'trk-bulk-body' }, [
            el('ul', { className: 'trk-bulk-list' }, children),
            copyText ? el('button', {
                className: 'ui-btn ui-btn-ghost trk-bulk-copy',
                text: 'Copy',
                attrs: { type: 'button' },
                on: { click: () => copyLines(copyText) },
            }) : null,
        ]),
    ]);
}

const stageNote = (stage) => (stage ? `Stage ${stage}` : null);

export function openBulkMark({ catalog, loadOther, progress, maxItems, onApply, onUndo, onImport, onExport }) {
    let report = null;
    let close = () => {};

    const hint = el('p', { className: 'trk-bulk-hint' });
    const textarea = el('textarea', {
        className: 'ui-textarea',
        attrs: { id: 'trk-bulk-input', rows: 8, spellcheck: 'false', 'aria-describedby': 'trk-bulk-format' },
    });
    const textareaLabel = el('label', { className: 'ui-label', attrs: { for: 'trk-bulk-input' } });
    const example = el('pre', { className: 'trk-bulk-example', attrs: { id: 'trk-bulk-format' } });
    const inputError = el('p', { className: 'ui-field-error', attrs: { hidden: true } });
    const reportNode = el('div', { className: 'trk-bulk-report', attrs: { 'aria-live': 'polite' } });
    const footSummary = el('p', { className: 'trk-bulk-foot-summary' });

    const applyButton = el('button', {
        className: 'ui-btn ui-btn-primary',
        text: 'Apply',
        attrs: { type: 'button', disabled: true },
        on: {
            click: () => {
                const ids = report ? stageIdsToApply(report, progress) : [];
                if (ids.length === 0) return;
                draft.text = '';
                close();
                onApply(ids);
            },
        },
    });

    function refreshFooter() {
        const count = report ? stageIdsToApply(report, progress).length : 0;
        applyButton.disabled = count === 0;
        footSummary.textContent = report ? t('bulkWillMark', { count: formatNumber(count) }) : '';
    }

    function clearReport() {
        report = null;
        reportNode.replaceChildren();
        inputError.hidden = true;
        refreshFooter();
    }

    function showInputError(message) {
        inputError.replaceChildren(icon('ph ph-warning-circle'), el('span', { text: message }));
        inputError.hidden = false;
    }

    function ambiguousEntry(entry, position) {
        const name = `trk-bulk-choice-${position}`;
        const options = entry.candidates.map((item) => el('label', { className: 'trk-bulk-radio' }, [
            el('input', {
                attrs: { type: 'radio', name },
                on: {
                    change: () => {
                        entry.choice = item;
                        refreshFooter();
                    },
                },
            }),
            el('span', { text: item.alias ?? item.name }),
            el('span', { className: 'trk-bulk-meta', text: item.groupName }),
        ]));
        return el('li', {}, [
            el('fieldset', { className: 'trk-bulk-fieldset' }, [
                el('legend', { className: 'trk-bulk-legend', text: entry.input }),
                ...options,
            ]),
        ]);
    }

    function renderReport() {
        const groups = [];
        if (report.found.length > 0) {
            groups.push(resultGroup({
                iconClass: 'ph-fill ph-check-circle',
                tone: 'accent',
                title: t('bulkFound'),
                count: report.found.length,
                open: report.found.length <= OPEN_FOUND_LIMIT,
                children: report.found.map((entry) => resultLine(entry.item.name, stageNote(entry.stage))),
            }));
        }
        if (report.ambiguous.length > 0) {
            groups.push(resultGroup({
                iconClass: 'ph-fill ph-warning',
                tone: 'warning',
                title: t('bulkAmbiguous'),
                count: report.ambiguous.length,
                open: true,
                children: report.ambiguous.map(ambiguousEntry),
            }));
        }
        if (report.notFound.length > 0) {
            groups.push(resultGroup({
                iconClass: 'ph-fill ph-warning-circle',
                tone: 'danger',
                title: t('bulkNotFound'),
                count: report.notFound.length,
                open: true,
                copyText: report.notFound.map((entry) => entry.input),
                children: report.notFound.map((entry) => resultLine(entry.input, `Line ${entry.line}`)),
            }));
        }
        if (report.invalid.length > 0) {
            groups.push(resultGroup({
                iconClass: 'ph-fill ph-warning-circle',
                tone: 'danger',
                title: t('bulkInvalid'),
                count: report.invalid.length,
                open: true,
                copyText: report.invalid.map((entry) => (entry.line ? `Line ${entry.line}: ${entry.message}` : entry.message)),
                children: report.invalid.map((entry) => resultLine(entry.message, entry.line ? `Line ${entry.line}` : null)),
            }));
        }
        if (report.alreadyDone.length > 0) {
            groups.push(resultGroup({
                iconClass: 'ph ph-seal-check',
                tone: 'muted',
                title: t('bulkAlreadyDone'),
                count: report.alreadyDone.length,
                open: false,
                children: report.alreadyDone.map((entry) => resultLine(entry.item.name, stageNote(entry.stage))),
            }));
        }
        reportNode.replaceChildren(...groups);
        if (report.fallbackFailed) reportNode.prepend(el('p', { className: 'trk-bulk-hint', text: t('bulkFallbackFailed') }));
        refreshFooter();
    }

    async function check() {
        clearReport();
        if (!textarea.value.trim()) {
            showInputError('Enter at least one item.');
            return;
        }
        setButtonLoading(checkButton, true);
        const result = await runInquiry({ mode: draft.mode, text: textarea.value, catalog, loadOther, progress, maxItems });
        setButtonLoading(checkButton, false);
        if (result.tooMany) {
            showInputError(`Too many items. The maximum is ${formatNumber(maxItems)}. Nothing was processed.`);
            return;
        }
        report = result;
        renderReport();
    }

    const checkButton = el('button', {
        className: 'ui-btn ui-btn-secondary',
        text: 'Check',
        attrs: { type: 'button' },
        on: { click: check },
    });

    const sampleButton = el('button', {
        className: 'ui-btn ui-btn-ghost',
        text: 'Use sample',
        attrs: { type: 'button' },
        on: {
            click: () => {
                textarea.value = SAMPLE_JSON;
                draft.text = SAMPLE_JSON;
                clearReport();
                textarea.focus();
            },
        },
    });

    textarea.addEventListener('input', () => {
        draft.text = textarea.value;
        clearReport();
    });

    const modeButtons = [
        [MODE_NAME, 'By name'],
        [MODE_JSON, 'By name + stage (JSON)'],
    ].map(([mode, label]) => el('button', {
        text: label,
        attrs: { type: 'button', 'data-mode': mode },
        on: {
            click: () => {
                draft.mode = mode;
                applyMode();
                clearReport();
            },
        },
    }));

    function applyMode() {
        const json = draft.mode === MODE_JSON;
        modeButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.mode === draft.mode)));
        hint.textContent = t(json ? 'bulkHintJson' : 'bulkHintName');
        textareaLabel.textContent = t(json ? 'bulkInputJson' : 'bulkInputName');
        example.textContent = json ? SAMPLE_JSON : t('bulkExampleName');
        textarea.classList.toggle('ui-textarea-mono', json);
        sampleButton.hidden = !json;
    }

    function lastActionSection() {
        const last = progress.lastBulk();
        if (!last) return null;
        return el('section', { className: 'trk-bulk-section' }, [
            el('h3', { className: 'trk-bulk-heading', text: t('bulkLastAction') }),
            el('p', {
                className: 'trk-bulk-hint',
                text: t('bulkLastActionDetail', { count: formatNumber(last.count), date: formatDate(last.createdAt) }),
            }),
            el('button', {
                className: 'ui-btn ui-btn-secondary',
                text: 'Undo',
                attrs: { type: 'button' },
                on: {
                    click: () => {
                        close();
                        onUndo();
                    },
                },
            }),
        ]);
    }

    function backupSection() {
        const fileInput = el('input', {
            attrs: { type: 'file', accept: '.json,application/json', hidden: true, 'aria-label': 'Import file' },
            on: {
                change: async (event) => {
                    const [file] = event.target.files;
                    event.target.value = '';
                    if (file && await onImport(file)) close();
                },
            },
        });
        return el('section', { className: 'trk-bulk-section' }, [
            el('h3', { className: 'trk-bulk-heading', text: t('bulkBackup') }),
            el('p', { className: 'trk-bulk-hint', text: t('bulkBackupHint') }),
            el('div', { className: 'trk-bulk-actions' }, [
                el('button', { className: 'ui-btn ui-btn-secondary', text: 'Export', attrs: { type: 'button' }, on: { click: onExport } }),
                el('button', {
                    className: 'ui-btn ui-btn-secondary',
                    text: 'Import',
                    attrs: { type: 'button' },
                    on: { click: () => fileInput.click() },
                }),
                fileInput,
            ]),
        ]);
    }

    textarea.value = draft.text;
    applyMode();

    const body = el('div', { className: 'trk-bulk' }, [
        el('div', { className: 'ui-segmented', attrs: { role: 'group', 'aria-label': t('bulkMode') } }, modeButtons),
        hint,
        el('div', { className: 'ui-field' }, [textareaLabel, textarea, inputError, example]),
        el('div', { className: 'trk-bulk-actions' }, [checkButton, sampleButton]),
        reportNode,
        lastActionSection(),
        backupSection(),
    ]);

    close = openDialog({
        title: 'Bulk Mark',
        kind: 'drawer',
        body,
        footer: el('div', { className: 'trk-bulk-foot' }, [footSummary, applyButton]),
    });
}
