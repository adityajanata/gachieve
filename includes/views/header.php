<?php

declare(strict_types=1);

/** @var bool|null $trackerTools Search, Bulk Mark and category chips belong to the tracker only. */
$trackerTools ??= true;
?>
<header id="ui-header" class="ui-header">
    <div class="ui-header-inner">
        <a href="./" class="ui-wordmark">
            <i class="ph ph-wind" aria-hidden="true"></i>
            <span><?= htmlspecialchars((string) Config::get('app.name'), ENT_QUOTES, 'UTF-8') ?></span>
        </a>
        <?php if ($trackerTools): ?>
        <?php // No visible label: owner decision, following DESIGN 3.2. The name comes from aria-label. ?>
        <div id="trk-search-slot" class="trk-search">
            <i class="ph ph-magnifying-glass" aria-hidden="true"></i>
            <input id="trk-search-input" type="search" autocomplete="off" spellcheck="false"
                   data-i18n-placeholder="searchPlaceholder" data-i18n-aria="searchPlaceholder">
            <button id="trk-search-clear" type="button" class="ui-icon-btn trk-search-clear" aria-label="Clear search" hidden>
                <i class="ph ph-x" aria-hidden="true"></i>
            </button>
        </div>
        <?php endif; ?>
        <div class="ui-header-actions">
            <?php if ($trackerTools): ?>
            <button id="trk-bulk-open" type="button" class="ui-btn ui-btn-secondary trk-bulk-open" aria-label="Bulk Mark" disabled>
                <i class="ph ph-list-checks" aria-hidden="true"></i>
                <span>Bulk Mark</span>
            </button>
            <?php endif; ?>
            <div id="ui-lang-toggle" class="ui-segmented" role="group" aria-label="Language">
                <button type="button" data-lang="id">ID</button>
                <button type="button" data-lang="en">EN</button>
            </div>
            <button id="ui-theme-toggle" type="button" class="ui-icon-btn" aria-label="Toggle theme">
                <i class="ph ph-moon" aria-hidden="true"></i>
            </button>
            <div id="ui-account-slot" class="ui-account"></div>
        </div>
    </div>
    <?php if ($trackerTools): ?>
    <nav id="trk-chips" class="trk-chips" data-i18n-aria="categories"></nav>
    <?php endif; ?>
</header>
