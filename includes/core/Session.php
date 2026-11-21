<?php

declare(strict_types=1);

final class Session
{
    public static function start(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }
        $lifetime = (int) Config::get('session.lifetime_seconds');
        ini_set('session.gc_maxlifetime', (string) $lifetime);
        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');
        session_name('ga_session');
        session_set_cookie_params([
            'lifetime' => $lifetime,
            'path' => (string) Config::get('app.base_path'),
            'secure' => Request::isHttps(),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_start();
    }

    /** Saves and unlocks the session. Values stay readable for the rest of the request. */
    public static function close(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_write_close();
        }
    }

    public static function get(string $key): mixed
    {
        return $_SESSION[$key] ?? null;
    }

    public static function set(string $key, mixed $value): void
    {
        $_SESSION[$key] = $value;
    }

    public static function regenerate(): void
    {
        session_regenerate_id(true);
    }

    /** Ends this session and leaves a fresh, empty one, so the same request can still hand out a CSRF token. */
    public static function destroy(): void
    {
        $_SESSION = [];
        session_regenerate_id(true);
    }
}
