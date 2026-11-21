<?php

declare(strict_types=1);

require dirname(__DIR__) . '/includes/bootstrap.php';

Policy::dispatch([
    'list' => [
        'method' => 'GET',
        'role' => Policy::TRAVELER,
        'handler' => static fn (array $user): array => ['stage_ids' => ProgressService::stageIds((int) $user['id'])],
    ],
    'set' => [
        'method' => 'POST',
        'role' => Policy::TRAVELER,
        'limit' => 'progress',
        'handler' => static function (array $user): array {
            $body = Request::json();
            return ProgressService::set(
                (int) $user['id'],
                Validator::positiveInt($body, 'stage_id'),
                Validator::bool($body, 'done'),
            );
        },
    ],
    'import' => [
        'method' => 'POST',
        'role' => Policy::TRAVELER,
        'limit' => 'bulk',
        'handler' => static function (array $user): array {
            $stageIds = Validator::intList(Request::json(), 'stage_ids', (int) Config::get('bulk.max_items'));
            return ['added_count' => ProgressService::import((int) $user['id'], $stageIds)];
        },
    ],
]);
