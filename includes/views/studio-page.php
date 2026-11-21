<?php

declare(strict_types=1);

/**
 * The one shell every Studio page shares. All data loads through api/.
 *
 * @var array<string, mixed> $adminUser
 * @var string $adminPage Key of the active nav item
 * @var string $adminScript File in assets/js/studio/, without extension
 * @var string|null $adminTitleKey Label key of the page heading; null when the script sets the heading itself
 * @var array<string, string|int>|null $adminData Values for data-* attributes on body
 * @var bool|null $adminTinymce
 */
$pageTitle = 'Studio - ' . Config::get('app.name');
$adminStyles = true;
$trackerTools = false;
$adminTitleKey ??= null;

require __DIR__ . '/head.php';
?>
<body data-google-client-id="<?= htmlspecialchars((string) Config::get('auth.google_client_id'), ENT_QUOTES, 'UTF-8') ?>"
      data-user-id="<?= (int) $adminUser['id'] ?>"
      data-user-role="<?= htmlspecialchars((string) $adminUser['role'], ENT_QUOTES, 'UTF-8') ?>"
      <?php foreach ($adminData ?? [] as $name => $value): ?>
      data-<?= $name ?>="<?= htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8') ?>"
      <?php endforeach; ?>>
<div id="ui-app-root" class="ui-page">
    <?php require __DIR__ . '/header.php'; ?>
    <div class="adm-layout">
        <aside class="adm-side"><?php require __DIR__ . '/studio-nav.php'; ?></aside>
        <main class="adm-main">
            <div class="adm-page-head">
                <button id="adm-menu-open" type="button" class="ui-icon-btn adm-menu-open" aria-label="Open menu">
                    <i class="ph ph-list" aria-hidden="true"></i>
                </button>
                <h1 id="adm-page-title" class="adm-page-title"<?= $adminTitleKey !== null ? ' data-i18n="' . $adminTitleKey . '"' : '' ?>></h1>
            </div>
            <div id="adm-root" class="adm-root"></div>
        </main>
    </div>
    <?php require __DIR__ . '/footer.php'; ?>
</div>
<div id="ui-live" class="ui-sr-only" aria-live="polite"></div>
<?php if ($adminTinymce ?? false): ?>
<script src="assets/js/vendor/tinymce/tinymce.min.js"></script>
<?php endif; ?>
<script type="module" src="assets/js/studio/<?= $adminScript ?>.js"></script>
</body>
</html>
