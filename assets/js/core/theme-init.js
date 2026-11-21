// Runs before first paint so the page never flashes the wrong theme.
(function () {
    var stored = null;
    try {
        stored = JSON.parse(localStorage.getItem('ga.theme'));
    } catch (e) {}
    var dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
})();
