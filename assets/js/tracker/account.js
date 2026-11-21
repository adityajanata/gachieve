// Sign-in and the account UI (PRD 5.9, DESIGN 3.10, 4.4): Google's button, the avatar menu and the Profile modal.
import { apiGet, apiPost, setCsrf } from '../core/api.js';
import { avatar as userAvatar } from '../core/avatar.js';
import { badgeIconClasses, badgePill } from '../core/badge.js';
import { byId, el, icon, setButtonLoading } from '../core/dom.js';
import { getLang, onLangChange, t } from '../core/i18n.js';
import { alertDanger, badgeNotice, confirmDanger, openDialog } from '../core/modal.js';
import { onThemeChange } from '../core/theme.js';
import { toastError, toastSuccess } from '../core/toast.js';

const MOBILE = '(max-width: 767px)';

export function createAccount({ onSignedIn, onSignedOut }) {
    const headerSlot = byId('ui-account-slot');
    const clientId = document.body.dataset.googleClientId;
    let user = null;
    let email = null;
    let closeMenu = null;
    let topBadge = null;

    function avatar(size) {
        return userAvatar({ name: user.display_name, url: user.avatar_url, size });
    }

    function renderGoogleButtons() {
        const google = window.google?.accounts?.id;
        if (!google || !clientId || user) return;
        const theme = document.documentElement.dataset.theme === 'dark' ? 'filled_black' : 'outline';
        const base = { theme, shape: 'pill', locale: getLang(), size: 'medium' };
        headerSlot.replaceChildren();
        const headerButton = el('div');
        headerSlot.append(headerButton);
        // A phone header has room for Google's icon-only button.
        google.renderButton(headerButton, window.matchMedia(MOBILE).matches ? { ...base, type: 'icon' } : { ...base, type: 'standard', text: 'signin' });
    }

    async function loadEmail() {
        try {
            email = (await apiGet('auth', 'me')).email;
        } catch {
            email = null;
        }
    }

    async function handleCredential({ credential }) {
        try {
            const result = await apiPost('auth', 'login', { credential });
            setCsrf(result.csrf);
            user = result.user;
            await loadEmail();
            renderSignedIn();
            await onSignedIn({ user, email, isNew: result.is_new });
            loadBadges();
        } catch (error) {
            if (error.code === 'ACCOUNT_DISABLED') alertDanger(error.message);
            else toastError(error.message);
        }
    }

    function initGoogle() {
        const google = window.google?.accounts?.id;
        if (!google || !clientId) return;
        google.initialize({ client_id: clientId, callback: handleCredential, auto_select: false });
        renderGoogleButtons();
    }

    async function signOut() {
        try {
            await apiPost('auth', 'logout');
        } catch (error) {
            if (error.code !== 'UNAUTHENTICATED') {
                toastError(error.message);
                return;
            }
        }
        window.google?.accounts?.id?.disableAutoSelect();
        endSession();
        onSignedOut();
    }

    function endSession() {
        user = null;
        email = null;
        closeMenu?.();
        headerSlot.replaceChildren();
        renderGoogleButtons();
        // The server ended the session along with its CSRF token, so the next sign-in needs the new one.
        apiGet('auth', 'csrf').then(({ csrf }) => setCsrf(csrf)).catch(() => {});
    }

    /** Contributors see their top badge in the menu, and a popup once for every badge they have not seen yet. */
    async function loadBadges() {
        topBadge = null;
        if (user?.role !== 'contributor') return;
        try {
            const { badges } = await apiGet('points', 'mine');
            topBadge = badges[badges.length - 1] ?? null;
            const unseen = badges.filter((badge) => !badge.seen);
            if (unseen.length === 0) return;
            const newest = unseen[unseen.length - 1];
            await badgeNotice({
                title: t('badgeNew', { title: newest.title }),
                text: t('badgeNewHint'),
                iconClasses: badgeIconClasses(newest.badge_key),
            });
            await apiPost('points', 'mark_seen', { badge_ids: unseen.map((badge) => badge.id) });
        } catch (error) {
            console.error(error);
        }
    }

    function linkItem(href, iconName, text) {
        return el('a', { className: 'ui-menu-item', attrs: { href } }, [icon(`ph ${iconName}`), el('span', { text })]);
    }

    function menuItems(afterChoice) {
        return [
            user.role === 'contributor' ? linkItem('studio/my-points.php', 'ph-medal', 'My Points') : null,
            user.role !== 'traveler' ? linkItem('studio/index.php', 'ph-pencil-ruler', 'Studio') : null,
            el('button', {
                className: 'ui-menu-item',
                attrs: { type: 'button' },
                on: {
                    click: async () => {
                        await afterChoice();
                        openProfile();
                    },
                },
            }, [icon('ph ph-user-circle'), el('span', { text: 'Profile' })]),
            el('button', {
                className: 'ui-menu-item',
                attrs: { type: 'button' },
                on: {
                    click: async () => {
                        await afterChoice();
                        signOut();
                    },
                },
            }, [icon('ph ph-sign-out'), el('span', { text: 'Sign out' })]),
        ].filter(Boolean);
    }

    function menuEmail() {
        return email ? el('p', { className: 'ui-menu-email', text: email }) : null;
    }

    function menuBadge() {
        return topBadge ? el('div', { className: 'ui-menu-badge' }, [badgePill(topBadge.badge_key, topBadge.title)]) : null;
    }

    function openMenu(button) {
        if (window.matchMedia(MOBILE).matches) {
            const close = openDialog({
                title: user.display_name,
                body: el('div', { className: 'ui-menu-list' }, [menuEmail(), menuBadge(), ...menuItems(() => close())]),
            });
            return;
        }
        if (closeMenu) {
            closeMenu();
            return;
        }
        const menu = el('div', { className: 'ui-menu' }, [
            el('div', { className: 'ui-menu-head' }, [
                el('p', { className: 'ui-menu-name', text: user.display_name }),
                menuEmail(),
            ]),
            menuBadge(),
        ]);
        function onOutside(event) {
            if (!menu.contains(event.target) && !button.contains(event.target)) closeMenu();
        }
        function onEscape(event) {
            if (event.key === 'Escape') {
                closeMenu();
                button.focus();
            }
        }
        closeMenu = () => {
            menu.remove();
            button.setAttribute('aria-expanded', 'false');
            document.removeEventListener('pointerdown', onOutside);
            document.removeEventListener('keydown', onEscape);
            closeMenu = null;
        };
        menu.append(...menuItems(() => closeMenu()));
        headerSlot.append(menu);
        button.setAttribute('aria-expanded', 'true');
        document.addEventListener('pointerdown', onOutside);
        document.addEventListener('keydown', onEscape);
        menu.querySelector('button').focus();
    }

    function renderSignedIn() {
        const button = el('button', {
            className: 'ui-avatar-btn',
            attrs: { type: 'button', 'aria-label': 'Account menu', 'aria-expanded': 'false' },
        }, [avatar(32)]);
        button.addEventListener('click', () => openMenu(button));
        headerSlot.replaceChildren(button);
    }

    function openProfile() {
        const nameInput = el('input', {
            className: 'ui-input',
            attrs: { id: 'ui-profile-name', type: 'text', maxlength: 40, autocomplete: 'nickname', value: user.display_name },
        });
        const nameError = el('p', { className: 'ui-field-error', attrs: { hidden: true } });
        const saveButton = el('button', { className: 'ui-btn ui-btn-primary', text: 'Save', attrs: { type: 'submit' } });

        const form = el('form', {
            className: 'ui-form',
            on: {
                submit: async (event) => {
                    event.preventDefault();
                    nameError.hidden = true;
                    setButtonLoading(saveButton, true);
                    try {
                        ({ user } = await apiPost('users', 'update_profile', { display_name: nameInput.value }));
                        renderSignedIn();
                        close();
                        toastSuccess(t('profileSaved'));
                    } catch (error) {
                        const fieldMessage = error.details?.fields?.display_name;
                        if (fieldMessage) {
                            nameError.replaceChildren(icon('ph ph-warning-circle'), el('span', { text: fieldMessage }));
                            nameError.hidden = false;
                        } else {
                            toastError(error.message);
                        }
                        setButtonLoading(saveButton, false);
                    }
                },
            },
        }, [
            el('div', { className: 'ui-field' }, [
                el('label', { className: 'ui-label', text: t('profileName'), attrs: { for: 'ui-profile-name' } }),
                nameInput,
                nameError,
                el('p', { className: 'ui-field-help', text: t('profileNameHelp') }),
            ]),
            el('div', { className: 'ui-field' }, [
                el('label', { className: 'ui-label', text: t('profileEmail'), attrs: { for: 'ui-profile-email' } }),
                el('input', { className: 'ui-input', attrs: { id: 'ui-profile-email', type: 'email', readonly: true, value: email ?? '' } }),
            ]),
            saveButton,
        ]);

        async function deleteAccount() {
            const confirmed = await confirmDanger({
                title: t('deleteTitle'),
                text: t('deleteWarning'),
                confirmLabel: 'Delete',
            });
            if (!confirmed) return;
            try {
                await apiPost('users', 'delete_me', { confirm: 'DELETE' });
                close();
                endSession();
                onSignedOut();
                toastSuccess(t('deleteDone'));
            } catch (error) {
                toastError(error.message);
            }
        }

        const close = openDialog({
            title: t('profileTitle'),
            body: el('div', { className: 'ui-profile' }, [
                avatar(48),
                form,
                // The server refuses this for Administrators (API 5.1), so they never see the button.
                user.role === 'administrator' ? null : el('section', { className: 'ui-danger-zone' }, [
                    el('h3', { className: 'ui-danger-title', text: t('deleteTitle') }),
                    el('p', { className: 'ui-field-help', text: t('deleteWarning') }),
                    el('button', { className: 'ui-btn ui-btn-danger', text: 'Delete Account', attrs: { type: 'button' }, on: { click: deleteAccount } }),
                ]),
            ]),
        });
    }

    function whenGoogleLoads() {
        if (window.google?.accounts?.id) {
            initGoogle();
            return;
        }
        byId('ui-gsi-script')?.addEventListener('load', initGoogle);
    }

    return {
        isSignedIn: () => user !== null,

        role: () => user?.role ?? null,

        /** Reads the session. A failure here means Guest mode, so the tracker always works. */
        async boot() {
            try {
                const me = await apiGet('auth', 'me');
                setCsrf(me.csrf);
                user = me.user;
                email = me.email;
            } catch (error) {
                user = null;
                if (error.code === 'ACCOUNT_DISABLED') alertDanger(error.message);
            }
            if (user) {
                renderSignedIn();
                loadBadges();
            }
            whenGoogleLoads();
            onThemeChange(renderGoogleButtons);
            onLangChange(renderGoogleButtons);
            return user;
        },

        /** The server says the session is gone (API 6.3). Returns true when the error was handled here. */
        handleSessionError(error) {
            if (error.code === 'ACCOUNT_DISABLED') {
                alertDanger(error.message);
            } else if (error.code === 'UNAUTHENTICATED') {
                toastError('You were signed out. Showing this browser\'s progress.');
            } else {
                return false;
            }
            endSession();
            onSignedOut();
            return true;
        },
    };
}
