<?php

declare(strict_types=1);

require __DIR__ . '/includes/bootstrap.php';

$pageTitle = Config::get('app.name') . ' | Tracker Achievement Genshin Impact';
$pageDescription = 'Lacak semua achievement Genshin Impact, tandai banyak sekaligus, dan baca tutorial cara mendapatkannya. Gratis, bisa dipakai tanpa akun.';

require __DIR__ . '/includes/views/head.php';
?>
<body data-bulk-max="<?= (int) Config::get('bulk.max_items') ?>"
      data-google-client-id="<?= htmlspecialchars((string) Config::get('auth.google_client_id'), ENT_QUOTES, 'UTF-8') ?>">
<div id="ui-app-root" class="ui-page">
    <?php require __DIR__ . '/includes/views/header.php'; ?>

    <main class="ui-content">
        <h1 class="ui-sr-only"><?= htmlspecialchars((string) Config::get('app.name'), ENT_QUOTES, 'UTF-8') ?></h1>
        <noscript>
            <div class="ui-banner"><p>JavaScript is required to use this tracker.</p></div>
        </noscript>
        <div id="trk-guest-banner" class="ui-banner" hidden>
            <i class="ph ph-info" aria-hidden="true"></i>
            <p data-i18n="guestBanner"></p>
            <button id="trk-guest-banner-close" type="button" class="ui-icon-btn" aria-label="Dismiss">
                <i class="ph ph-x" aria-hidden="true"></i>
            </button>
        </div>

        <div id="trk-offline-banner" class="ui-banner ui-banner-warning" role="status" hidden>
            <i class="ph ph-wifi-slash" aria-hidden="true"></i>
            <p data-i18n="offlineBanner"></p>
        </div>

        <section id="trk-summary" class="trk-summary" data-i18n-aria="progressSummary">
            <div id="trk-summary-all" class="trk-summary-panel">
                <h2 class="trk-summary-title" hidden></h2>
                <div class="trk-summary-pct">
                    <span class="trk-summary-percent ui-text-display ui-skeleton-text">&nbsp;&nbsp;&nbsp;&nbsp;</span>
                    <p class="trk-summary-count ui-skeleton-text">&nbsp;</p>
                </div>
                <div class="trk-progress-track"><div class="trk-summary-bar trk-progress-fill"></div></div>
                <p class="trk-summary-primo">
                    <img class="ui-primogem" src="assets/img/primogem.png" alt="" width="58" height="58" aria-hidden="true">
                    <span class="trk-summary-reward ui-text-h3 ui-skeleton-text">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
                </p>
            </div>
        </section>

        <div class="trk-layout">
            <nav id="trk-sidebar" class="trk-sidebar" data-i18n-aria="categories"></nav>

            <div class="trk-main">
                <div id="trk-filter-bar" class="trk-filter-bar" hidden>
                    <button id="trk-filter-open" type="button" class="ui-btn ui-btn-secondary trk-filter-open">
                        <i class="ph ph-sliders-horizontal" aria-hidden="true"></i>
                        <span id="trk-filter-open-label">Filter</span>
                    </button>
                    <div id="trk-filter-controls" class="trk-filter-controls"></div>
                </div>

                <div id="trk-list" class="trk-list" aria-busy="true">
                    <div class="trk-group-body">
                        <?php for ($i = 0; $i < 8; $i++): ?>
                            <div class="trk-row trk-row-skeleton" aria-hidden="true">
                                <div>
                                    <div class="ui-skeleton trk-skel-title"></div>
                                    <div class="ui-skeleton trk-skel-desc"></div>
                                </div>
                                <div class="trk-skel-stages">
                                    <div class="ui-skeleton trk-skel-box"></div>
                                    <div class="ui-skeleton trk-skel-box"></div>
                                    <div class="ui-skeleton trk-skel-box"></div>
                                </div>
                            </div>
                        <?php endfor; ?>
                    </div>
                </div>
            </div>
        </div>
    </main>

    <?php require __DIR__ . '/includes/views/footer.php'; ?>
</div>
<div id="ui-live" class="ui-sr-only" aria-live="polite"></div>
<script type="module" src="assets/js/tracker/main.js"></script>
</body>
</html>
