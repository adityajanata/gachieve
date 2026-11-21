// The only module that shows toasts. A new toast replaces the old one, since SweetAlert2 keeps one visible.

function show(message, { iconName, iconClass, timer, actionLabel, onAction, pauseOnHover = true, onOpen, onDestroy }) {
    const Swal = window.Swal;
    if (!Swal) return;
    const mobile = window.matchMedia('(max-width: 767px)').matches;
    Swal.fire({
        toast: true,
        position: mobile ? 'top' : 'top-end',
        text: message,
        icon: 'info',
        iconHtml: `<i class="ph-fill ${iconName}" aria-hidden="true"></i>`,
        customClass: { popup: 'ui-swal-toast', icon: iconClass, confirmButton: 'ui-btn ui-btn-ghost' },
        showClass: { popup: 'ui-swal-in' },
        hideClass: { popup: 'ui-swal-out' },
        buttonsStyling: false,
        showConfirmButton: Boolean(actionLabel),
        confirmButtonText: actionLabel,
        timer,
        didOpen: (popup) => {
            if (pauseOnHover) {
                popup.addEventListener('mouseenter', Swal.stopTimer);
                popup.addEventListener('mouseleave', Swal.resumeTimer);
            }
            onOpen?.(popup);
        },
        didDestroy: onDestroy,
    }).then((result) => {
        if (result.isConfirmed) onAction?.();
    });
}

export function toastError(message) {
    show(message, { iconName: 'ph-warning-circle', iconClass: 'ui-swal-icon ui-swal-icon-danger', timer: 5000 });
}

/** A neutral notice, for example why an action was not taken. */
export function toastInfo(message) {
    show(message, { iconName: 'ph-info', iconClass: 'ui-swal-icon', timer: 5000 });
}

/**
 * An error toast that stays until a wait is over, counting the seconds down, for example a rate limit's
 * retry_after_seconds. message(secondsLeft) builds the text. Hover does not pause it, since the wait is real time.
 */
export function toastCountdown(message, seconds) {
    const deadline = Date.now() + seconds * 1000;
    let ticker = null;
    show(message(seconds), {
        iconName: 'ph-warning-circle',
        iconClass: 'ui-swal-icon ui-swal-icon-danger',
        timer: seconds * 1000,
        pauseOnHover: false,
        onOpen: (popup) => {
            const Swal = window.Swal;
            const text = Swal.getHtmlContainer();
            ticker = setInterval(() => {
                // A newer toast replaced this one without destroying it through a close.
                if (!popup.isConnected || Swal.getPopup() !== popup) {
                    clearInterval(ticker);
                    return;
                }
                // The first text was announced; reading every tick aloud would drown the screen reader.
                popup.setAttribute('aria-live', 'off');
                text.textContent = message(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
            }, 1000);
        },
        onDestroy: () => clearInterval(ticker),
    });
}

export function toastSuccess(message, action = {}) {
    show(message, { iconName: 'ph-check-circle', iconClass: 'ui-swal-icon', timer: 3000, ...action });
}
