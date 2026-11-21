<?php

declare(strict_types=1);

final class Csrf
{
    private const KEY = 'csrf';

    public static function token(): string
    {
        $token = Session::get(self::KEY);
        if (!is_string($token)) {
            $token = self::rotate();
        }
        return $token;
    }

    public static function rotate(): string
    {
        $token = bin2hex(random_bytes(32));
        Session::set(self::KEY, $token);
        return $token;
    }

    public static function verify(?string $provided): void
    {
        $expected = Session::get(self::KEY);
        if (!is_string($expected) || !is_string($provided) || !hash_equals($expected, $provided)) {
            throw new ApiError('CSRF_INVALID');
        }
    }
}
