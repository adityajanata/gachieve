// How To Achieve (DESIGN 4.3). Always asks the server, so a card's cached tutorial index can never show stale content.
import { apiGet } from '../core/api.js';
import { avatar } from '../core/avatar.js';
import { el, icon } from '../core/dom.js';
import { formatDate, formatTime, getLang, t } from '../core/i18n.js';
import { openDialog } from '../core/modal.js';
import { renderTutorial } from '../core/tutorial-view.js';

const WRITER_ROLES = ['contributor', 'administrator'];

/** One person in the credit row: avatar, label, name with top badge, and the date and time. */
function creditPerson(labelKey, author, publishedAt) {
    const date = new Date(publishedAt);
    return el('div', { className: 'ui-credit-person' }, [
        avatar({ name: author.display_name, url: author.avatar_url, size: 40 }),
        el('div', { className: 'ui-credit-text' }, [
            el('p', { className: 'ui-credit-label', text: t(labelKey) }),
            el('p', { className: 'ui-credit-name' }, [
                el('span', { text: author.display_name }),
                author.top_badge_title ? el('span', { className: 'ui-meta-chip', text: author.top_badge_title }) : null,
            ]),
            el('p', { className: 'ui-credit-date' }, [
                el('time', { text: `${formatDate(date)} ${formatTime(date)}`, attrs: { datetime: publishedAt } }),
            ]),
        ]),
    ]);
}

/** Published by the first version's author; Last edit by the live version's author once it was edited. */
function credit(tutorial) {
    const first = tutorial.first_published;
    return el('div', { className: 'ui-credit' }, [
        first
            ? creditPerson('tutorialPublishedBy', first.author, first.published_at)
            : creditPerson('tutorialPublishedBy', tutorial.author, tutorial.published_at),
        first ? creditPerson('tutorialEditedBy', tutorial.author, tutorial.published_at) : null,
    ]);
}

function loading() {
    return el('div', { className: 'ui-tutorial', attrs: { 'aria-busy': 'true' } }, [
        el('div', { className: 'ui-skeleton trk-skel-title' }),
        el('div', { className: 'ui-skeleton trk-skel-desc' }),
        el('div', { className: 'ui-skeleton trk-skel-desc' }),
    ]);
}

export function createTutorialModal({ getRole }) {
    function emptyState(item) {
        const canWrite = WRITER_ROLES.includes(getRole());
        return el('div', { className: 'ui-empty' }, [
            icon('ph ph-book-open'),
            el('p', { text: t('tutorialMissing') }),
            canWrite ? el('a', {
                className: 'ui-btn ui-btn-secondary',
                text: 'Write Tutorial',
                attrs: { href: `studio/editor.php?achievement_id=${item.key}` },
            }) : null,
        ]);
    }

    async function fill(slot, item) {
        slot.replaceChildren(loading());
        try {
            const tutorial = await apiGet('tutorials', 'get', { achievement_id: item.key });
            slot.replaceChildren(...(tutorial
                ? [credit(tutorial), renderTutorial(tutorial.content, getLang())]
                : [emptyState(item)]));
        } catch {
            slot.replaceChildren(el('div', { className: 'ui-empty' }, [
                icon('ph ph-warning-circle'),
                el('p', { text: t('tutorialFailed') }),
                el('button', {
                    className: 'ui-btn ui-btn-secondary',
                    text: 'Retry',
                    attrs: { type: 'button' },
                    on: { click: () => fill(slot, item) },
                }),
            ]));
        }
    }

    return {
        open(item) {
            const slot = el('div');
            openDialog({ title: item.name, subtitle: item.groupName, body: slot });
            fill(slot, item);
        },
    };
}
