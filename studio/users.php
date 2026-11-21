<?php

declare(strict_types=1);

require dirname(__DIR__) . '/includes/bootstrap.php';

$adminUser = Policy::requirePage(Policy::ADMINISTRATOR);
$adminPage = 'users';
$adminScript = 'users';
$adminTitleKey = 'navUsers';

require dirname(__DIR__) . '/includes/views/studio-page.php';
