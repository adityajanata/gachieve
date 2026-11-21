<?php

declare(strict_types=1);

require dirname(__DIR__) . '/includes/bootstrap.php';

Policy::dispatch([
    'csrf' => [
        'method' => 'GET',
        'writes_session' => true,
        'role' => Policy::GUEST,
        'handler' => static fn (): array => ['csrf' => Csrf::token()],
    ],
    'me' => [
        'method' => 'GET',
        'writes_session' => true,
        'role' => Policy::GUEST,
        'handler' => static fn (?array $user): array => [
            'user' => $user === null ? null : UserService::publicUser($user),
            'email' => $user['email'] ?? null,
            'csrf' => Csrf::token(),
        ],
    ],
    'login' => [
        'method' => 'POST',
        'writes_session' => true,
        'role' => Policy::GUEST,
        'limit' => 'login',
        'handler' => static function (): array {
            $credential = Validator::text(Request::json(), 'credential', 4096);
            $result = UserService::signIn(GoogleTokenVerifier::verify($credential));
            if ((int) $result['user']['is_active'] !== 1) {
                throw new ApiError('ACCOUNT_DISABLED');
            }
            return [
                'user' => UserService::publicUser($result['user']),
                'csrf' => Auth::login((int) $result['user']['id']),
                'is_new' => $result['is_new'],
            ];
        },
    ],
    'logout' => [
        'method' => 'POST',
        'writes_session' => true,
        'role' => Policy::TRAVELER,
        'handler' => static function (): array {
            Auth::logout();
            return [];
        },
    ],
]);
