<?php

declare(strict_types=1);

/** Who is calling. The only code that ties the session to an account. */
final class Auth
{
    private const KEY = 'user_id';

    /**
     * The signed-in user, or null for a Guest. A disabled account ends its session here.
     *
     * @return array<string, mixed>|null
     */
    public static function current(): ?array
    {
        $userId = Session::get(self::KEY);
        if (!is_int($userId)) {
            return null;
        }
        $user = UserService::findById($userId);
        if ($user === null) {
            Session::destroy();
            return null;
        }
        if ((int) $user['is_active'] !== 1) {
            Session::destroy();
            throw new ApiError('ACCOUNT_DISABLED');
        }
        return $user;
    }

    /** New session id and a fresh CSRF token on every sign-in. */
    public static function login(int $userId): string
    {
        // The agent account has no Google identity, so this cannot happen; refuse it anyway.
        if (Policy::isAgentId($userId)) {
            throw new ApiError('FORBIDDEN');
        }
        Session::regenerate();
        Session::set(self::KEY, $userId);
        return Csrf::rotate();
    }

    public static function logout(): void
    {
        Session::destroy();
    }
}
