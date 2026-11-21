<?php

declare(strict_types=1);

/** Fixed-window counters in rate_limits. Keys are hashes, so raw IPs are never stored. */
final class RateLimitService
{
    private const PURGE_CHANCE_PERCENT = 1;

    public static function hit(string $group, string $actor): void
    {
        [$maxHits, $windowSeconds] = Config::get('rate_limit.' . $group);
        $key = hash('sha256', $group . '|' . $actor);
        $pdo = Database::pdo();

        // MySQL evaluates these assignments left to right, so hits reads the old window_start.
        $pdo->prepare(
            'INSERT INTO rate_limits (rate_key, window_start, hits) VALUES (:key, UTC_TIMESTAMP(), 1)
             ON DUPLICATE KEY UPDATE
                 hits = IF(window_start <= UTC_TIMESTAMP() - INTERVAL :window1 SECOND, 1, hits + 1),
                 window_start = IF(window_start <= UTC_TIMESTAMP() - INTERVAL :window2 SECOND, UTC_TIMESTAMP(), window_start)'
        )->execute(['key' => $key, 'window1' => $windowSeconds, 'window2' => $windowSeconds]);

        $select = $pdo->prepare(
            'SELECT hits, TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), window_start + INTERVAL :window SECOND) AS remaining
             FROM rate_limits WHERE rate_key = :key'
        );
        $select->execute(['window' => $windowSeconds, 'key' => $key]);
        $row = $select->fetch();

        if (random_int(1, 100) <= self::PURGE_CHANCE_PERCENT) {
            $pdo->exec('DELETE FROM rate_limits WHERE window_start < UTC_TIMESTAMP() - INTERVAL 1 DAY');
        }

        if ($row !== false && (int) $row['hits'] > $maxHits) {
            throw new ApiError('RATE_LIMITED', ['retry_after_seconds' => max(1, (int) $row['remaining'])]);
        }
    }
}
