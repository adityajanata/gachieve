<?php

declare(strict_types=1);

require dirname(__DIR__) . '/includes/bootstrap.php';

$adminUser = Policy::requirePage(Policy::CONTRIBUTOR);
if (!Policy::isAdministrator($adminUser)) {
    // The Dashboard is for Administrators; the admin area opens on All Tutorials for everyone else.
    header('Location: ' . Config::get('app.base_path') . 'studio/tutorials.php', true, 303);
    exit;
}
$adminPage = 'index';
$adminScript = 'dashboard';
$adminTitleKey = 'navDashboard';

require dirname(__DIR__) . '/includes/views/studio-page.php';
