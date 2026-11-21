<?php

declare(strict_types=1);

require dirname(__DIR__) . '/includes/bootstrap.php';

Policy::dispatch([
    'update_profile' => [
        'method' => 'POST',
        'role' => Policy::TRAVELER,
        'handler' => static function (array $user): array {
            $displayName = Validator::displayName(Request::json(), 'display_name');
            return ['user' => UserService::publicUser(UserService::updateDisplayName((int) $user['id'], $displayName))];
        },
    ],
    'delete_me' => [
        'method' => 'POST',
        'role' => Policy::TRAVELER,
        'writes_session' => true,
        'handler' => static function (array $user): array {
            // An Administrator never removes their own account, so at least one Administrator always remains (API 5.1).
            if (Policy::isAdministrator($user)) {
                throw new ApiError('FORBIDDEN');
            }
            if ((Request::json()['confirm'] ?? null) !== 'DELETE') {
                throw ApiError::validation(['confirm' => 'Must be DELETE.']);
            }
            UserService::delete((int) $user['id']);
            Auth::logout();
            return [];
        },
    ],
    'list' => [
        'method' => 'GET',
        'role' => Policy::ADMINISTRATOR,
        'handler' => static function (): never {
            ['page' => $page, 'per_page' => $perPage] = Request::pagination();
            $active = match (Request::query('active')) {
                '1' => true,
                '0' => false,
                default => null,
            };
            $result = UserService::listForAdmin(Request::query('q') ?? '', Request::query('role') ?? '', $active, $page, $perPage);
            Response::page($result['items'], $page, $perPage, $result['total']);
        },
    ],
    'set_role' => [
        'method' => 'POST',
        'role' => Policy::ADMINISTRATOR,
        'handler' => static function (array $user): array {
            $body = Request::json();
            $target = UserService::setRole($user, Validator::positiveInt($body, 'user_id'), Validator::text($body, 'role', 20));
            return ['user' => UserService::publicUser($target)];
        },
    ],
    'set_active' => [
        'method' => 'POST',
        'role' => Policy::ADMINISTRATOR,
        'handler' => static function (array $user): array {
            $body = Request::json();
            $target = UserService::setActive($user, Validator::positiveInt($body, 'user_id'), Validator::bool($body, 'active'));
            return ['user' => UserService::publicUser($target)];
        },
    ],
    'delete' => [
        'method' => 'POST',
        'role' => Policy::ADMINISTRATOR,
        'handler' => static function (array $user): array {
            UserService::deleteByAdmin($user, Validator::positiveInt(Request::json(), 'user_id'));
            return [];
        },
    ],
]);
