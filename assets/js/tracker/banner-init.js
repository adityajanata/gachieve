// Runs before first paint so the guest banner never appears late and pushes the list down (layout shift).
// The session is only known after auth.me, so this guesses from the last visit; main.js corrects it.
(function () {
    function read(key) {
        try {
            return JSON.parse(localStorage.getItem('ga.' + key));
        } catch (e) {
            return null;
        }
    }
    if (read('guestBannerDismissed') !== true && read('lastSignedIn') !== true) {
        document.documentElement.classList.add('trk-guest-banner-on');
    }
})();
