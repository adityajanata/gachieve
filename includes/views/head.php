<?php

declare(strict_types=1);

/** @var string $pageTitle */
?>
<!doctype html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?= htmlspecialchars($pageTitle, ENT_QUOTES, 'UTF-8') ?></title>
    <base href="<?= htmlspecialchars((string) Config::get('app.base_path'), ENT_QUOTES, 'UTF-8') ?>">
    <link rel="icon" href="data:,">
    <script src="assets/js/core/theme-init.js"></script>
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono&family=Poppins:wght@400;500;600;700&display=swap">
    <?php // SRI pins each CDN file to the exact bytes of its pinned version. ?>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1/src/regular/style.css"
          integrity="sha384-6p9AefaqUhEVheRlj1mpAkbngHXy9mbYMrIdcIt4Jlc9lOLIablJq3bBsLOjGwZ7" crossorigin="anonymous">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1/src/bold/style.css"
          integrity="sha384-nblAP2mo2pVPyMQZDw9Xy9Cwgs9lowushAYep4w5+Q9kF4Ibf3n0B/gCMVdR+Vqy" crossorigin="anonymous">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1/src/fill/style.css"
          integrity="sha384-pPVoXE8ft+zxKtxIDDI7SfTK6y95NHm4qa+hKEg/hs8VkjW5IP+9/dGOPCbDpUPl" crossorigin="anonymous">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/sweetalert2@11.14.5/dist/sweetalert2.min.css"
          integrity="sha384-9zhnRArCpusIVIudEVdI3QmXKH9nCjEGc2rNvdcQ1utx3a3zbLtW3rBOeJ2PvupL" crossorigin="anonymous">
    <link rel="stylesheet" href="assets/css/app.css">
    <?php if ($adminStyles ?? false): ?>
    <link rel="stylesheet" href="assets/css/studio.css">
    <?php endif; ?>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js" defer
            integrity="sha384-g4NTh/Iv5PPU4xPyhEWqPcwtNXOvdaDI8LLnyYfyNZOjKJeYQyjzQ9X5275eBjpt" crossorigin="anonymous"></script>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11.14.5/dist/sweetalert2.min.js" defer
            integrity="sha384-ueC9FHE/gdG6Xjlev9kT8QDLO/Yskgm0nfhNXN+N1odFWNO4nxt2I0gz5PsbkJs2" crossorigin="anonymous"></script>
    <?php if ($adminStyles ?? false): ?>
    <?php // Studio tooltips, self-hosted in versioned folders (tippy.js needs Popper loaded first). ?>
    <script src="assets/js/vendor/popper-2.11.8/popper.min.js" defer></script>
    <script src="assets/js/vendor/tippy-6.3.7/tippy.umd.min.js" defer></script>
    <?php endif; ?>
    <?php // Studio pages are only reachable signed in, so they never show Google's button. ?>
    <?php if ($trackerTools ?? true): ?>
    <script id="ui-gsi-script" src="https://accounts.google.com/gsi/client" async></script>
    <?php endif; ?>
</head>
