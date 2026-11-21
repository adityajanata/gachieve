<?php

declare(strict_types=1);

final class BulkService
{
    /**
     * All or nothing. History keeps only the newly added ids, so Undo never removes older progress.
     *
     * @param list<int> $stageIds
     * @return array{history_id: int, added_count: int, already_done_count: int}
     */
    public static function apply(int $userId, array $stageIds): array
    {
        $unknown = array_values(array_filter($stageIds, static fn (int $id): bool => !AchievementCatalog::hasStage($id)));
        if ($unknown !== []) {
            throw ApiError::validation(['stage_ids' => $unknown]);
        }
        $expanded = AchievementCatalog::expandCascade($stageIds);

        return Database::transaction(static function () use ($userId, $expanded): array {
            $pdo = Database::pdo();
            $added = ProgressService::insert($userId, $expanded);
            $pdo->prepare('DELETE FROM bulk_history WHERE user_id = :user')->execute(['user' => $userId]);
            $pdo->prepare('INSERT INTO bulk_history (user_id, stage_ids) VALUES (:user, :ids)')->execute([
                'user' => $userId,
                'ids' => json_encode($added, JSON_THROW_ON_ERROR),
            ]);
            return [
                'history_id' => (int) $pdo->lastInsertId(),
                'added_count' => count($added),
                'already_done_count' => count($expanded) - count($added),
            ];
        });
    }

    /**
     * Only the caller's latest action, once. A stage stays when a later stage of that achievement is
     * still done and was not part of this action, because stages are dependent.
     */
    public static function undo(int $userId, int $historyId): int
    {
        return Database::transaction(static function () use ($userId, $historyId): int {
            $pdo = Database::pdo();
            $select = $pdo->prepare(
                'SELECT id, stage_ids, undone_at FROM bulk_history WHERE user_id = :user ORDER BY id DESC LIMIT 1 FOR UPDATE'
            );
            $select->execute(['user' => $userId]);
            $latest = $select->fetch();

            if ($latest === false || (int) $latest['id'] !== $historyId) {
                throw new ApiError('INVALID_STATE', ['current_status' => 'not_latest']);
            }
            if ($latest['undone_at'] !== null) {
                throw new ApiError('INVALID_STATE', ['current_status' => 'undone']);
            }

            $added = json_decode((string) $latest['stage_ids'], true, 4, JSON_THROW_ON_ERROR);
            $removable = self::removableStages($added, ProgressService::stageIds($userId));
            $removed = ProgressService::remove($userId, $removable);

            $pdo->prepare('UPDATE bulk_history SET undone_at = UTC_TIMESTAMP() WHERE id = :id')->execute(['id' => $historyId]);
            return count($removed);
        });
    }

    /**
     * @param list<int> $added
     * @param list<int> $done
     * @return list<int>
     */
    private static function removableStages(array $added, array $done): array
    {
        $addedSet = array_flip($added);
        $doneSet = array_flip($done);
        $removable = [];
        $seen = [];
        foreach ($added as $stageId) {
            if (!AchievementCatalog::hasStage($stageId)) {
                continue;
            }
            $stages = AchievementCatalog::allStagesOf($stageId);
            if (isset($seen[$stages[0]])) {
                continue;
            }
            $seen[$stages[0]] = true;
            foreach (array_reverse($stages) as $candidate) {
                if (!isset($doneSet[$candidate])) {
                    continue;
                }
                if (!isset($addedSet[$candidate])) {
                    break;
                }
                $removable[] = $candidate;
            }
        }
        return $removable;
    }

    /** @return array{history_id: int, count: int, created_at: ?string, can_undo: bool}|null */
    public static function last(int $userId): ?array
    {
        $statement = Database::pdo()->prepare(
            'SELECT id, stage_ids, created_at, undone_at FROM bulk_history WHERE user_id = :user ORDER BY id DESC LIMIT 1'
        );
        $statement->execute(['user' => $userId]);
        $row = $statement->fetch();
        if ($row === false) {
            return null;
        }
        $count = count(json_decode((string) $row['stage_ids'], true, 4, JSON_THROW_ON_ERROR));
        return [
            'history_id' => (int) $row['id'],
            'count' => $count,
            'created_at' => Time::iso($row['created_at']),
            'can_undo' => $row['undone_at'] === null && $count > 0,
        ];
    }
}
