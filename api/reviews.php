<?php

declare(strict_types=1);

require dirname(__DIR__) . '/includes/bootstrap.php';

Policy::dispatch([
    'queue' => [
        'method' => 'GET',
        'role' => Policy::ADMINISTRATOR,
        'handler' => static function (): never {
            ['page' => $page, 'per_page' => $perPage] = Request::pagination();
            $result = ReviewService::queue($page, $perPage);
            Response::page($result['items'], $page, $perPage, $result['total']);
        },
    ],
    'get' => [
        'method' => 'GET',
        'role' => Policy::ADMINISTRATOR,
        'handler' => static fn (): array => ReviewService::get(Request::queryId('version_id')),
    ],
    'approve' => [
        'method' => 'POST',
        'role' => Policy::ADMINISTRATOR,
        'limit' => 'review',
        'handler' => static fn (array $user): array => ReviewService::approve(Validator::positiveInt(Request::json(), 'version_id'), (int) $user['id']),
    ],
    'reject' => [
        'method' => 'POST',
        'role' => Policy::ADMINISTRATOR,
        'limit' => 'review',
        'handler' => static function (array $user): array {
            $body = Request::json();
            return ReviewService::reject(Validator::positiveInt($body, 'version_id'), (int) $user['id'], Validator::trimmedText($body, 'reason', 1000));
        },
    ],
]);
