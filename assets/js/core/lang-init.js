// Runs before first paint so <html lang> already matches the stored language (pages that hold both languages show the right one at once).
(function () {
    try {
        if (JSON.parse(localStorage.getItem('ga.lang')) === 'en') document.documentElement.lang = 'en';
    } catch (e) {}
})();
