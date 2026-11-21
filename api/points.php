<?php

declare(strict_types=1);

require dirname(__DIR__) . '/includes/bootstrap.php';

Policy::dispatch([
    'mine' => [
        'method' => 'GET',
        'role' => Policy::CONTRIBUTOR,
        'handler' => static fn (array $user): array => PointsService::mine($user),
    ],
    'mark_seen' => [
        'method' => 'POST',
        'role' => Policy::CONTRIBUTOR,
        'handler' => static function (array $user): array {
            PointsService::markSeen((int) $user['id'], Validator::intList(Request::json(), 'badge_ids', 100));
            return [];
        },
    ],
    'settings' => [
        'method' => 'GET',
        'role' => Policy::ADMINISTRATOR,
        'handler' => static fn (): array => PointsService::settings(),
    ],
    'save_rule' => [
        'method' => 'POST',
        'role' => Policy::ADMINISTRATOR,
        'handler' => static fn (array $user): array => ['rule' => PointsService::saveRule($user, Request::json())],
    ],
    'save_badge' => [
        'method' => 'POST',
        'role' => Policy::ADMINISTRATOR,
        'handler' => static fn (array $user): array => ['badge' => PointsService::saveBadge($user, Request::json())],
    ],
]);
