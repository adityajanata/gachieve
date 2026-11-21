// Keeps the edit lock alive (PRD 5.7, API 4.2, 6.2): heartbeat, countdown, warning and timeout.
import { apiPost } from '../core/api.js';

const TICK_MS = 1000;

/** The timeout fires this early, so the last autosave still reaches the server while the lock is fresh. */
const TIMEOUT_MARGIN_SECONDS = 5;

export function createLockKeeper({ tutorialId, lock, onTick, onWarn, onTimeout, onLost }) {
    let expiresAt = Date.now() + lock.timeout_seconds * 1000;
    let active = false;
    let warned = false;
    let beatTimer = null;
    let tickTimer = null;

    const secondsLeft = () => Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));

    function stop() {
        clearInterval(beatTimer);
        clearInterval(tickTimer);
    }

    async function beat(force = false) {
        const sendActive = force || active;
        active = false;
        try {
            await apiPost('editor', 'heartbeat', { tutorial_id: tutorialId, active: sendActive });
            // Counted from the local clock, so a wrong clock on this device cannot shorten the lock.
            if (sendActive) {
                expiresAt = Date.now() + lock.timeout_seconds * 1000;
                warned = false;
            }
        } catch (error) {
            if (error.code === 'LOCK_LOST' || error.code === 'UNAUTHENTICATED' || error.code === 'ACCOUNT_DISABLED') {
                stop();
                onLost(error);
            }
            // Anything else, such as a dropped connection, gets another try on the next beat.
        }
    }

    function tick() {
        const left = secondsLeft();
        onTick(left, left <= lock.warn_before_seconds);
        if (left <= TIMEOUT_MARGIN_SECONDS) {
            stop();
            onTimeout();
        } else if (left <= lock.warn_before_seconds && !warned) {
            warned = true;
            onWarn();
        }
    }

    beatTimer = setInterval(beat, lock.heartbeat_seconds * 1000);
    tickTimer = setInterval(tick, TICK_MS);
    tick();

    return {
        stop,
        secondsLeft,
        markActive() {
            active = true;
        },
        keepEditing: () => beat(true),
    };
}
