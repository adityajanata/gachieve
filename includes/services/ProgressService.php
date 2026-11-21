<?php

declare(strict_types=1);

final class ProgressService
{
    /** @return list<int> */
    public static function stageIds(int $userId): array
    {
        $statement = Database::pdo()->prepare('SELECT stage_id FROM progress WHERE user_id = :user');
        $statement->execute(['user' => $userId]);
        return array_map('intval', $statement->fetchAll(PDO::FETCH_COLUMN));
    }

    /**
     * Checking marks earlier stages too, unchecking clears later ones. The result lists exactly what changed.
     *
     * @return array{added: list<int>, removed: list<int>}
     */
    public static function set(int $userId, int $stageId, bool $done): array
    {
        if (!AchievementCatalog::hasStage($stageId)) {
            throw new ApiError('NOT_FOUND');
        }
        return Database::transaction(static fn (): array => $done
            ? ['added' => self::insert($userId, AchievementCatalog::stageWithEarlier($stageId)), 'removed' => []]
            : ['added' => [], 'removed' => self::remove($userId, AchievementCatalog::stageWithLater($stageId))]);
    }

    /**
     * Union only: nothing is removed and unknown ids are skipped.
     *
     * @param list<int> $stageIds
     */
    public static function import(int $userId, array $stageIds): int
    {
        $expanded = AchievementCatalog::expandCascade($stageIds);
        return Database::transaction(static fn (): int => count(self::insert($userId, $expanded)));
    }

    /**
     * Run inside a transaction.
     *
     * @param list<int> $stageIds
     * @return list<int> the ids that were not there before
     */
    public static function insert(int $userId, array $stageIds): array
    {
        $statement = Database::pdo()->prepare(
            'INSERT IGNORE INTO progress (user_id, stage_id, completed_at) VALUES (:user, :stage, UTC_TIMESTAMP())'
        );
        $added = [];
        foreach ($stageIds as $stageId) {
            $statement->execute(['user' => $userId, 'stage' => $stageId]);
            if ($statement->rowCount() > 0) {
                $added[] = $stageId;
            }
        }
        return $added;
    }

    /**
     * Run inside a transaction.
     *
     * @param list<int> $stageIds
     * @return list<int> the ids that were actually there
     */
    public static function remove(int $userId, array $stageIds): array
    {
        $statement = Database::pdo()->prepare('DELETE FROM progress WHERE user_id = :user AND stage_id = :stage');
        $removed = [];
        foreach ($stageIds as $stageId) {
            $statement->execute(['user' => $userId, 'stage' => $stageId]);
            if ($statement->rowCount() > 0) {
                $removed[] = $stageId;
            }
        }
        return $removed;
    }
}
