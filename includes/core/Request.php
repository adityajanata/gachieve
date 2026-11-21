<?php

declare(strict_types=1);

final class Request
{
    public const MAX_BODY_BYTES = 1048576;

    private const MAX_PAGE = 100000;

    /** @var array<string, mixed>|null */
    private static ?array $body = null;

    public static function method(): string
    {
        return (string) ($_SERVER['REQUEST_METHOD'] ?? 'GET');
    }

    public static function query(string $name): ?string
    {
        $value = $_GET[$name] ?? null;
        return is_string($value) ? $value : null;
    }

    /** A required positive whole number from the query string. */
    public static function queryId(string $name): int
    {
        $value = self::query($name);
        if ($value === null) {
            throw new ApiError('BAD_REQUEST');
        }
        if (!ctype_digit($value) || (int) $value < 1) {
            throw ApiError::validation([$name => 'Must be a positive whole number.']);
        }
        return (int) $value;
    }

    /** @return array{page: int, per_page: int} Defaults from API section 1; out-of-range values are clamped. */
    public static function pagination(): array
    {
        $page = ctype_digit(self::query('page') ?? '') ? (int) self::query('page') : 1;
        $perPage = ctype_digit(self::query('per_page') ?? '') ? (int) self::query('per_page') : 25;
        // The page cap keeps the offset an integer; no list here comes close to it.
        return ['page' => min(self::MAX_PAGE, max(1, $page)), 'per_page' => min(100, max(1, $perPage))];
    }

    public static function header(string $name): ?string
    {
        $key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
        return isset($_SERVER[$key]) ? (string) $_SERVER[$key] : null;
    }

    public static function ip(): string
    {
        return (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    }

    public static function isHttps(): bool
    {
        return ($_SERVER['HTTPS'] ?? '') !== '' && ($_SERVER['HTTPS'] ?? '') !== 'off';
    }

    /** @return array<string, mixed> */
    public static function json(): array
    {
        if (self::$body !== null) {
            return self::$body;
        }
        $limit = ['limit_bytes' => self::MAX_BODY_BYTES];
        if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > self::MAX_BODY_BYTES) {
            throw new ApiError('PAYLOAD_TOO_LARGE', $limit);
        }
        $raw = file_get_contents('php://input', false, null, 0, self::MAX_BODY_BYTES + 1);
        if ($raw === false || strlen($raw) > self::MAX_BODY_BYTES) {
            throw new ApiError('PAYLOAD_TOO_LARGE', $limit);
        }
        if (trim($raw) === '') {
            return self::$body = [];
        }
        try {
            $decoded = json_decode($raw, true, 16, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            throw new ApiError('BAD_REQUEST');
        }
        if (!is_array($decoded)) {
            throw new ApiError('BAD_REQUEST');
        }
        return self::$body = $decoded;
    }
}
