<?php

declare(strict_types=1);

require dirname(__DIR__) . '/includes/bootstrap.php';

Policy::dispatch([
    'index' => [
        'method' => 'GET',
        'session' => false,
        'role' => Policy::GUEST,
        'handler' => static fn (): never => Response::cachedList(TutorialService::index(), 300),
    ],
    'get' => [
        'method' => 'GET',
        'session' => false,
        'role' => Policy::GUEST,
        'handler' => static fn (): ?array => TutorialService::getLive(Request::queryId('achievement_id')),
    ],
]);
