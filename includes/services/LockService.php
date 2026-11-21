<?php

declare(strict_types=1);

/**
 * The edit lock on a tutorial (PRD 5.7, API 4.2). The flag alone is never trusted: a lock counts as free
 * when is_locked is off or last_activity_at is older than the timeout.
 * After a normal release locked_by stays, so a stale tab reads "expired"; force unlock clears it.
 */
final class LockService
{
    private static function timeout(): int
    {
        return (int) Config::get('lock.timeout_seconds');
    }

    /** @return array<string, mixed> The tutorial row, locked for this transaction when asked. */
    public static function row(int $tutorialId, bool $forUpdate = true): array
    {
        $statement = Database::pdo()->prepare(
            'SELECT t.*, TIMESTAMPDIFF(SECOND, t.last_activity_at, UTC_TIMESTAMP()) AS idle_seconds,
                    t.last_activity_at + INTERVAL :timeout SECOND AS expires_at
             FROM tutorials t WHERE t.id = :id' . ($forUpdate ? ' FOR UPDATE' : '')
        );
        $statement->execute(['timeout' => self::timeout(), 'id' => $tutorialId]);
        $row = $statement->fetch();
        if ($row === false) {
            throw new ApiError('NOT_FOUND');
        }
        return $row;
    }

    /** @param array<string, mixed> $row */
    public static function isFresh(array $row): bool
    {
        return (int) $row['is_locked'] === 1 && $row['locked_by'] !== null && (int) $row['idle_seconds'] < self::timeout();
    }

    /**
     * Fails when someone else holds a fresh lock.
     *
     * The holder's email goes to Administrators only; nobody else sees another user's email.
     *
     * @param array<string, mixed> $row
     * @param array<string, mixed> $user
     */
    public static function assertFree(array $row, array $user): void
    {
        if (self::isFresh($row) && (int) $row['locked_by'] !== (int) $user['id']) {
            $holder = UserService::findById((int) $row['locked_by']);
            throw new ApiError('LOCK_HELD', [
                'locked_by_name' => $holder['display_name'] ?? 'Deleted Account',
                'locked_by_email' => Policy::isAdministrator($user) ? ($holder['email'] ?? null) : null,
                'expires_at' => Time::iso($row['expires_at']),
            ]);
        }
    }

    /**
     * Stale tabs can never overwrite: every write checks the caller still holds a fresh lock.
     *
     * @param array<string, mixed> $row
     */
    public static function assertHeld(array $row, int $userId): void
    {
        if ($row['locked_by'] === null) {
            throw new ApiError('LOCK_LOST', ['reason' => 'force_unlocked']);
        }
        if ((int) $row['locked_by'] !== $userId) {
            throw new ApiError('LOCK_LOST', ['reason' => 'taken']);
        }
        if (!self::isFresh($row)) {
            throw new ApiError('LOCK_LOST', ['reason' => 'expired']);
        }
    }

    public static function acquire(int $tutorialId, int $userId): void
    {
        Database::pdo()->prepare(
            'UPDATE tutorials SET is_locked = 1, locked_by = :user, locked_at = UTC_TIMESTAMP(), last_activity_at = UTC_TIMESTAMP()
             WHERE id = :id'
        )->execute(['user' => $userId, 'id' => $tutorialId]);
    }

    public static function touch(int $tutorialId): void
    {
        Database::pdo()
            ->prepare('UPDATE tutorials SET last_activity_at = UTC_TIMESTAMP() WHERE id = :id')
            ->execute(['id' => $tutorialId]);
    }

    /** @return array<string, mixed> The lock object for the editor */
    public static function heartbeat(int $tutorialId, int $userId, bool $active): array
    {
        return Database::transaction(static function () use ($tutorialId, $userId, $active): array {
            self::assertHeld(self::row($tutorialId), $userId);
            if ($active) {
                self::touch($tutorialId);
            }
            return self::clientLock($tutorialId);
        });
    }

    /** @return array{expires_at: ?string, timeout_seconds: int, warn_before_seconds: int, heartbeat_seconds: int} */
    public static function clientLock(int $tutorialId): array
    {
        return [
            'expires_at' => Time::iso(self::row($tutorialId, false)['expires_at']),
            'timeout_seconds' => self::timeout(),
            'warn_before_seconds' => (int) Config::get('lock.warn_before_seconds'),
            'heartbeat_seconds' => (int) Config::get('lock.heartbeat_seconds'),
        ];
    }

    /** Ends the lock after Submit, Publish or Discard. */
    public static function clear(int $tutorialId): void
    {
        Database::pdo()->prepare('UPDATE tutorials SET is_locked = 0 WHERE id = :id')->execute(['id' => $tutorialId]);
    }

    /** Editor closed: drops the lock only when the caller holds it, so a late beacon cannot free someone else's. */
    public static function release(int $tutorialId, int $userId): void
    {
        Database::pdo()
            ->prepare('UPDATE tutorials SET is_locked = 0 WHERE id = :id AND locked_by = :user')
            ->execute(['id' => $tutorialId, 'user' => $userId]);
    }

    /** Clears the holder too, which tells their next heartbeat or save that the lock was force unlocked. */
    public static function forceUnlock(int $tutorialId): void
    {
        self::row($tutorialId);
        Database::pdo()
            ->prepare('UPDATE tutorials SET is_locked = 0, locked_by = NULL WHERE id = :id')
            ->execute(['id' => $tutorialId]);
    }

    public static function releaseAllBy(int $userId): void
    {
        Database::pdo()
            ->prepare('UPDATE tutorials SET is_locked = 0, locked_by = NULL WHERE locked_by = :user')
            ->execute(['user' => $userId]);
    }

    public static function activeCount(): int
    {
        $statement = Database::pdo()->prepare(
            'SELECT COUNT(*) FROM tutorials WHERE is_locked = 1 AND locked_by IS NOT NULL
             AND last_activity_at > UTC_TIMESTAMP() - INTERVAL :timeout SECOND'
        );
        $statement->execute(['timeout' => self::timeout()]);
        return (int) $statement->fetchColumn();
    }
}
