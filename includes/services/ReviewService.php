<?php

declare(strict_types=1);

/** The review log and the Approvals queue (PRD 5.7, API 4.3). */
final class ReviewService
{
    public static function log(int $versionId, ?string $from, string $to, ?int $actorId, ?string $reason): void
    {
        Database::pdo()->prepare(
            'INSERT INTO tutorial_reviews (version_id, from_status, to_status, actor_id, reason)
             VALUES (:version, :from_status, :to_status, :actor, :reason)'
        )->execute(['version' => $versionId, 'from_status' => $from, 'to_status' => $to, 'actor' => $actorId, 'reason' => $reason]);
    }

    public static function latestReason(int $versionId): ?string
    {
        $statement = Database::pdo()->prepare(
            "SELECT reason FROM tutorial_reviews WHERE version_id = :version AND to_status = 'rejected' ORDER BY id DESC LIMIT 1"
        );
        $statement->execute(['version' => $versionId]);
        $reason = $statement->fetchColumn();
        return $reason === false ? null : $reason;
    }

    public static function pendingCount(): int
    {
        return (int) Database::pdo()->query("SELECT COUNT(*) FROM tutorial_versions WHERE status = 'pending_review'")->fetchColumn();
    }

    /** @return array{items: list<array<string, mixed>>, total: int} */
    public static function queue(int $page, int $perPage): array
    {
        $pdo = Database::pdo();
        $statement = $pdo->prepare(
            "SELECT v.id, v.version_no, v.submitted_at, v.created_by, t.achievement_id, t.live_version_id, u.display_name
             FROM tutorial_versions v
             JOIN tutorials t ON t.id = v.tutorial_id
             LEFT JOIN users u ON u.id = v.created_by
             WHERE v.status = 'pending_review'
             ORDER BY v.submitted_at, v.id
             LIMIT :limit OFFSET :offset"
        );
        $statement->bindValue('limit', $perPage, PDO::PARAM_INT);
        $statement->bindValue('offset', ($page - 1) * $perPage, PDO::PARAM_INT);
        $statement->execute();

        $names = AchievementCatalog::names();
        $versions = AchievementCatalog::versions();
        $items = [];
        foreach ($statement->fetchAll() as $row) {
            $achievementId = (int) $row['achievement_id'];
            $items[] = [
                'version_id' => (int) $row['id'],
                'achievement_id' => $achievementId,
                'name_id' => $names[$achievementId]['id'] ?? '',
                'name_en' => $names[$achievementId]['en'] ?? '',
                'game_version' => $versions[$achievementId] ?? '',
                'version_no' => (int) $row['version_no'],
                'created_by_name' => $row['display_name'] ?? 'Deleted Account',
                'created_by_is_agent' => Policy::isAgentId($row['created_by'] === null ? null : (int) $row['created_by']),
                'submitted_at' => Time::iso($row['submitted_at']),
                'is_update' => $row['live_version_id'] !== null,
                'langs' => TutorialService::langs((int) $row['id']),
            ];
        }
        return ['items' => $items, 'total' => self::pendingCount()];
    }

    /** @return array{proposed: array<string, mixed>, live: ?array<string, mixed>, history: list<array<string, mixed>>} */
    public static function get(int $versionId): array
    {
        $statement = Database::pdo()->prepare(
            'SELECT t.live_version_id FROM tutorial_versions v JOIN tutorials t ON t.id = v.tutorial_id WHERE v.id = :id'
        );
        $statement->execute(['id' => $versionId]);
        $liveId = $statement->fetchColumn();
        if ($liveId === false) {
            throw new ApiError('NOT_FOUND');
        }
        return [
            'proposed' => TutorialService::content($versionId),
            'live' => $liveId === null ? null : TutorialService::content((int) $liveId),
            'history' => self::history($versionId),
        ];
    }

    /** @return list<array{from_status: ?string, to_status: string, actor_name: string, reason: ?string, created_at: ?string}> */
    private static function history(int $versionId): array
    {
        $statement = Database::pdo()->prepare(
            'SELECT r.from_status, r.to_status, r.reason, r.created_at, u.display_name
             FROM tutorial_reviews r LEFT JOIN users u ON u.id = r.actor_id
             WHERE r.version_id = :version ORDER BY r.id'
        );
        $statement->execute(['version' => $versionId]);
        return array_map(static fn (array $row): array => [
            'from_status' => $row['from_status'],
            'to_status' => $row['to_status'],
            'actor_name' => $row['display_name'] ?? 'Deleted Account',
            'reason' => $row['reason'],
            'created_at' => Time::iso($row['created_at']),
        ], $statement->fetchAll());
    }

    /** @return array<string, mixed> The version, checked to be still waiting, so two Administrators cannot act on it twice. */
    private static function pendingVersion(int $versionId): array
    {
        $statement = Database::pdo()->prepare(
            'SELECT v.*, t.live_version_id FROM tutorial_versions v JOIN tutorials t ON t.id = v.tutorial_id WHERE v.id = :id FOR UPDATE'
        );
        $statement->execute(['id' => $versionId]);
        $version = $statement->fetch();
        if ($version === false) {
            throw new ApiError('NOT_FOUND');
        }
        if ($version['status'] !== 'pending_review') {
            throw new ApiError('INVALID_STATE', ['current_status' => $version['status']]);
        }
        return $version;
    }

    /** @return array{status: string, points: list<array{event_key: string, points: int}>, badges: list<string>} */
    public static function approve(int $versionId, int $actorId): array
    {
        return Database::transaction(static function () use ($versionId, $actorId): array {
            $version = self::pendingVersion($versionId);
            $previousLiveId = $version['live_version_id'] === null ? null : (int) $version['live_version_id'];
            return ['status' => 'published'] + TutorialService::goLive($version, $previousLiveId, $actorId);
        });
    }

    /** @return array{status: string} */
    public static function reject(int $versionId, int $actorId, string $reason): array
    {
        return Database::transaction(static function () use ($versionId, $actorId, $reason): array {
            self::pendingVersion($versionId);
            Database::pdo()->prepare("UPDATE tutorial_versions SET status = 'rejected' WHERE id = :id")->execute(['id' => $versionId]);
            self::log($versionId, 'pending_review', 'rejected', $actorId, $reason);
            return ['status' => 'rejected'];
        });
    }
}
