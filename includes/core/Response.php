<?php

declare(strict_types=1);

/** The JSON envelope from API section 1. */
final class Response
{
    public static function ok(mixed $data): never
    {
        // An empty PHP array means an empty object in this API; lists always sit inside a named field.
        self::send(['ok' => true, 'data' => $data === [] ? new stdClass() : $data]);
    }

    /**
     * A list as the data itself, so an empty list stays [].
     *
     * @param list<mixed> $items
     */
    public static function list(array $items): never
    {
        self::send(['ok' => true, 'data' => $items]);
    }

    /**
     * One page of a list action (API section 1).
     *
     * @param list<mixed> $items
     */
    public static function page(array $items, int $page, int $perPage, int $total): never
    {
        self::send(['ok' => true, 'data' => $items, 'meta' => ['page' => $page, 'per_page' => $perPage, 'total' => $total]]);
    }

    /**
     * A list that browsers may keep for $maxAge seconds and revalidate through ETag.
     *
     * @param list<mixed> $items
     */
    public static function cachedList(array $items, int $maxAge): never
    {
        $body = self::encode(['ok' => true, 'data' => $items]);
        $etag = '"' . sha1($body) . '"';
        header_remove('Pragma');
        header_remove('Expires');
        header("Cache-Control: max-age={$maxAge}");
        header("ETag: {$etag}");
        if (Request::header('If-None-Match') === $etag) {
            http_response_code(304);
            exit;
        }
        header('Content-Type: application/json; charset=utf-8');
        echo $body;
        exit;
    }

    /**
     * A body without the envelope. Only uploads.image uses it, because TinyMCE expects its own shape.
     *
     * @param array<string, mixed> $body
     */
    public static function raw(array $body): never
    {
        self::send($body);
    }

    public static function error(ApiError $error): never
    {
        $body = ['code' => $error->errorCode, 'message' => $error->getMessage()];
        if ($error->details !== []) {
            $body['details'] = $error->details;
        }
        if ($error->errorCode === 'RATE_LIMITED') {
            header('Retry-After: ' . (int) $error->details['retry_after_seconds']);
        }
        if ($error->errorCode === 'METHOD_NOT_ALLOWED') {
            header('Allow: ' . implode(', ', $error->details['allowed']));
        }
        self::send(['ok' => false, 'error' => $body], $error->status());
    }

    /** @param array<string, mixed> $body */
    private static function send(array $body, int $status = 200): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo self::encode($body);
        exit;
    }

    /** @param array<string, mixed> $body */
    private static function encode(array $body): string
    {
        return json_encode($body, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
}
