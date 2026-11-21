<?php

declare(strict_types=1);

require dirname(__DIR__) . '/includes/bootstrap.php';

Policy::dispatch([
    'apply' => [
        'method' => 'POST',
        'role' => Policy::TRAVELER,
        'limit' => 'bulk',
        'handler' => static function (array $user): array {
            $stageIds = Validator::intList(Request::json(), 'stage_ids', (int) Config::get('bulk.max_items'));
            return BulkService::apply((int) $user['id'], $stageIds);
        },
    ],
    'undo' => [
        'method' => 'POST',
        'role' => Policy::TRAVELER,
        'limit' => 'bulk',
        'handler' => static function (array $user): array {
            $historyId = Validator::positiveInt(Request::json(), 'history_id');
            return ['removed_count' => BulkService::undo((int) $user['id'], $historyId)];
        },
    ],
    'last' => [
        'method' => 'GET',
        'role' => Policy::TRAVELER,
        'handler' => static fn (array $user): ?array => BulkService::last((int) $user['id']),
    ],
]);
