// Renders a tutorial's content for one language (DESIGN 4.3). The tracker modal, the Preview and Approvals all use it.
import { el, icon } from './dom.js';
import { t } from './i18n.js';

function note(text) {
    return el('p', { className: 'ui-note', text });
}

/** Click-to-load facade: only a thumbnail until the tap, so a modal stays light on phones. */
function videoFacade(video) {
    const frame = el('div', { className: 'ui-video' });
    const play = el('button', {
        className: 'ui-video-play',
        attrs: { type: 'button', 'aria-label': 'Play video' },
        on: {
            click: () => {
                frame.replaceChildren(el('iframe', {
                    attrs: {
                        src: `${video.embed_url}?autoplay=1`,
                        title: 'YouTube video',
                        allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
                        referrerpolicy: 'strict-origin-when-cross-origin',
                        allowfullscreen: true,
                    },
                }));
                frame.querySelector('iframe').focus();
            },
        },
    }, [
        el('img', { attrs: { src: `https://i.ytimg.com/vi/${video.video_id}/hqdefault.jpg`, alt: '', loading: 'lazy', width: 480, height: 360 } }),
        el('span', { className: 'ui-video-icon' }, [icon('ph-fill ph-play')]),
    ]);
    frame.append(play);
    return frame;
}

/** body_html is sanitized by the server on save and on read. DOMParser never runs scripts while parsing. */
function prose(html) {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    return el('div', { className: 'ui-prose' }, [...parsed.body.childNodes].map((node) => document.adoptNode(node)));
}

/** A single video shows in both languages, with a note saying which language it is in (PRD 5.5). */
export function renderTutorial(content, lang) {
    const otherLang = lang === 'id' ? 'en' : 'id';
    const own = content[lang];
    const other = content[otherLang];
    const video = own?.video ?? other?.video ?? null;
    const body = own?.body_html ?? '';

    return el('div', { className: 'ui-tutorial' }, [
        !own?.video && other?.video ? note(t(otherLang === 'en' ? 'videoInEnglish' : 'videoInIndonesian')) : null,
        video ? videoFacade(video) : null,
        body !== '' ? prose(body) : note(t('tutorialMissingLang')),
    ]);
}
