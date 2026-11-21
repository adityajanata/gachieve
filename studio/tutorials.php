<?php

declare(strict_types=1);

require dirname(__DIR__) . '/includes/bootstrap.php';

$adminUser = Policy::requirePage(Policy::CONTRIBUTOR);
$adminPage = 'tutorials';
$adminScript = 'tutorials';
$adminTitleKey = 'navTutorials';

require dirname(__DIR__) . '/includes/views/studio-page.php';
