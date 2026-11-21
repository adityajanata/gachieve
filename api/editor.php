<?php

declare(strict_types=1);

require dirname(__DIR__) . '/includes/bootstrap.php';

Policy::dispatch([
    'list' => [
        'method' => 'GET',
        'role' => Policy::CONTRIBUTOR,
        'handler' => static function (array $user): never {
            ['page' => $page, 'per_page' => $perPage] = Request::pagination();
            $result = TutorialService::listForEditor(Request::query('q') ?? '', Request::query('state') ?? '', $page, $perPage, Policy::isAdministrator($user));
            Response::page($result['items'], $page, $perPage, $result['total']);
        },
    ],
    'open' => [
        'method' => 'POST',
        'role' => Policy::CONTRIBUTOR,
        'handler' => static function (array $user): array {
            $body = Request::json();
            return TutorialService::open(Validator::positiveInt($body, 'achievement_id'), $user, ($body['take_over'] ?? false) === true);
        },
    ],
    'heartbeat' => [
        'method' => 'POST',
        'role' => Policy::CONTRIBUTOR,
        'limit' => 'editor',
        'handler' => static function (array $user): array {
            $body = Request::json();
            return ['lock' => LockService::heartbeat(Validator::positiveInt($body, 'tutorial_id'), (int) $user['id'], Validator::bool($body, 'active'))];
        },
    ],
    'save' => [
        'method' => 'POST',
        'role' => Policy::CONTRIBUTOR,
        'limit' => 'editor',
        'handler' => static function (array $user): array {
            $body = Request::json();
            return TutorialService::save(
                Validator::positiveInt($body, 'tutorial_id'),
                $user,
                $body['content_input'] ?? null,
                Validator::bool($body, 'autosave'),
            );
        },
    ],
    'submit' => [
        'method' => 'POST',
        'role' => Policy::CONTRIBUTOR,
        'limit' => 'review',
        'handler' => static fn (array $user): array => TutorialService::submit(Validator::positiveInt(Request::json(), 'tutorial_id'), $user),
    ],
    'publish' => [
        'method' => 'POST',
        'role' => Policy::ADMINISTRATOR,
        'limit' => 'review',
        'handler' => static fn (array $user): array => TutorialService::publish(Validator::positiveInt(Request::json(), 'tutorial_id'), $user),
    ],
    'withdraw' => [
        'method' => 'POST',
        'role' => Policy::CONTRIBUTOR,
        'handler' => static fn (array $user): array => TutorialService::withdraw(Validator::positiveInt(Request::json(), 'version_id'), (int) $user['id']),
    ],
    'discard' => [
        'method' => 'POST',
        'role' => Policy::CONTRIBUTOR,
        'handler' => static function (array $user): array {
            TutorialService::discard(Validator::positiveInt(Request::json(), 'version_id'), $user);
            return [];
        },
    ],
    'release' => [
        'method' => 'POST',
        'role' => Policy::CONTRIBUTOR,
        'csrf_in_body' => true,
        'handler' => static function (array $user): array {
            LockService::release(Validator::positiveInt(Request::json(), 'tutorial_id'), (int) $user['id']);
            return [];
        },
    ],
]);
