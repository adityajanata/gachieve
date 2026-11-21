<?php

declare(strict_types=1);

require dirname(__DIR__) . '/includes/bootstrap.php';

$adminUser = Policy::requirePage(Policy::ADMINISTRATOR);
$adminPage = 'audit';
$adminScript = 'audit';
$adminTitleKey = 'navAudit';

require dirname(__DIR__) . '/includes/views/studio-page.php';
