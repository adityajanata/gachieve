<?php

declare(strict_types=1);

/**
 * Studio nav: tutorial work for everyone, then the Administrator-only pages under an "Admin" heading.
 *
 * @var array<string, mixed> $adminUser
 * @var string $adminPage
 */
$isAdministrator = Policy::isAdministrator($adminUser);
$visible = static fn (array $items): array => array_filter($items, static fn (array $item): bool => $item[4]);
$navGroups = [
    [null, $visible([
        ['tutorials', 'studio/tutorials.php', 'ph-book-open', 'navTutorials', true],
        ['my-points', 'studio/my-points.php', 'ph-medal', 'navMyPoints', !$isAdministrator],
    ])],
    ['navAdminGroup', $visible([
        ['index', 'studio/index.php', 'ph-gauge', 'navDashboard', $isAdministrator],
        ['approvals', 'studio/approvals.php', 'ph-seal-check', 'navApprovals', $isAdministrator],
        ['users', 'studio/users.php', 'ph-users', 'navUsers', $isAdministrator],
        ['points', 'studio/points.php', 'ph-sliders-horizontal', 'navPoints', $isAdministrator],
        ['audit', 'studio/audit.php', 'ph-clock-counter-clockwise', 'navAudit', $isAdministrator],
        ['maintenance', 'studio/maintenance.php', 'ph-broom', 'navMaintenance', $isAdministrator],
    ])],
];
?>
<nav id="adm-nav" class="adm-nav" data-i18n-aria="navLabel">
    <?php foreach ($navGroups as [$headingKey, $navItems]): ?>
        <?php if ($navItems === []) continue; ?>
        <?php if ($headingKey !== null): ?>
            <p class="adm-nav-heading" data-i18n="<?= $headingKey ?>"></p>
        <?php endif; ?>
        <?php foreach ($navItems as [$key, $href, $iconName, $label]): ?>
            <?php $current = $key === $adminPage || ($adminPage === 'editor' && $key === 'tutorials'); ?>
            <a class="adm-nav-item" href="<?= $href ?>"<?= $current ? ' aria-current="page"' : '' ?>>
                <i class="<?= $current ? 'ph-fill' : 'ph' ?> <?= $iconName ?>" aria-hidden="true"></i>
                <span data-i18n="<?= $label ?>"></span>
            </a>
        <?php endforeach; ?>
    <?php endforeach; ?>
</nav>
