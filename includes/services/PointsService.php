<?php

declare(strict_types=1);

/** The only code that reads point rules, writes the ledger and awards badges (PRD 5.8). Totals are always SUM over the ledger. */
final class PointsService
{
    private const EVENT_NEW = 'tutorial_published_new';
    private const EVENT_UPDATE = 'tutorial_published_update';
    private const EVENT_TRANSLATION = 'translation_added';

    private const MAX_POINTS = 1000000;

    private const BADGE_KEY = '/^[a-z0-9_]{2,64}$/';

    /**
     * Grants points to the version's creator. Administrators earn none, and the ledger's unique key
     * stops a second award for the same version.
     *
     * @param list<string> $langs
     * @param list<string> $previousLangs
     * @return array{points: list<array{event_key: string, points: int}>, badges: list<string>}
     */
    public static function awardForPublish(?int $creatorId, int $versionId, ?int $previousLiveId, array $langs, array $previousLangs): array
    {
        $none = ['points' => [], 'badges' => []];
        if ($creatorId === null) {
            return $none;
        }
        $creator = UserService::findById($creatorId);
        // Administrators and the writer agent earn no points and no badges.
        if ($creator === null || Policy::isAdministrator($creator) || Policy::isAgent($creator)) {
            return $none;
        }

        $events = [$previousLiveId === null ? self::EVENT_NEW : self::EVENT_UPDATE];
        if ($previousLiveId !== null && array_diff($langs, $previousLangs) !== []) {
            $events[] = self::EVENT_TRANSLATION;
        }

        $pdo = Database::pdo();
        $rule = $pdo->prepare('SELECT points FROM point_rules WHERE event_key = :event AND is_active = 1');
        $insert = $pdo->prepare(
            "INSERT IGNORE INTO point_ledger (user_id, event_key, entry_type, points, version_id)
             VALUES (:user, :event, 'award', :points, :version)"
        );
        $granted = [];
        foreach ($events as $event) {
            $rule->execute(['event' => $event]);
            $points = $rule->fetchColumn();
            if ($points === false || (int) $points === 0) {
                continue;
            }
            $insert->execute(['user' => $creatorId, 'event' => $event, 'points' => (int) $points, 'version' => $versionId]);
            if ($insert->rowCount() > 0) {
                $granted[] = ['event_key' => $event, 'points' => (int) $points];
            }
        }
        return ['points' => $granted, 'badges' => self::awardBadges($creatorId)];
    }

    /**
     * Awards every active badge the total has reached, in the caller's transaction.
     *
     * @return list<string> Newly earned badge keys
     */
    private static function awardBadges(int $userId): array
    {
        $pdo = Database::pdo();
        $select = $pdo->prepare(
            'SELECT b.id, b.badge_key FROM badges b
             LEFT JOIN user_badges ub ON ub.badge_id = b.id AND ub.user_id = :user
             WHERE b.is_active = 1 AND b.min_points <= :total AND ub.badge_id IS NULL
             ORDER BY b.min_points'
        );
        $select->execute(['user' => $userId, 'total' => self::total($userId)]);
        $insert = $pdo->prepare('INSERT IGNORE INTO user_badges (user_id, badge_id, awarded_at) VALUES (:user, :badge, UTC_TIMESTAMP())');
        $keys = [];
        foreach ($select->fetchAll() as $badge) {
            $insert->execute(['user' => $userId, 'badge' => $badge['id']]);
            $keys[] = $badge['badge_key'];
        }
        return $keys;
    }

    /**
     * A negative entry for every award of these versions. Badges stay.
     *
     * @param list<int> $versionIds
     */
    public static function reverseForVersions(array $versionIds): void
    {
        if ($versionIds === []) {
            return;
        }
        $marks = implode(',', array_fill(0, count($versionIds), '?'));
        Database::pdo()->prepare(
            "INSERT IGNORE INTO point_ledger (user_id, event_key, entry_type, points, version_id)
             SELECT user_id, event_key, 'reversal', -points, version_id
             FROM point_ledger WHERE entry_type = 'award' AND version_id IN ({$marks})"
        )->execute($versionIds);
    }

    public static function total(int $userId): int
    {
        $statement = Database::pdo()->prepare('SELECT COALESCE(SUM(points), 0) FROM point_ledger WHERE user_id = :user');
        $statement->execute(['user' => $userId]);
        return (int) $statement->fetchColumn();
    }

    /**
     * The highest active badge each user has earned.
     *
     * @param list<int> $userIds
     * @return array<int, string>
     */
    public static function topBadgeTitles(array $userIds): array
    {
        if ($userIds === []) {
            return [];
        }
        $marks = implode(',', array_fill(0, count($userIds), '?'));
        $statement = Database::pdo()->prepare(
            "SELECT ub.user_id, b.title FROM user_badges ub
             JOIN badges b ON b.id = ub.badge_id AND b.is_active = 1
             WHERE ub.user_id IN ({$marks})
             ORDER BY b.min_points, b.sort_order"
        );
        $statement->execute($userIds);
        $titles = [];
        foreach ($statement->fetchAll() as $row) {
            $titles[(int) $row['user_id']] = $row['title'];
        }
        // The agent earns no badges; it always shows its fixed title instead.
        foreach ($userIds as $userId) {
            if (Policy::isAgentId((int) $userId)) {
                $titles[(int) $userId] = (string) Config::get('agent.badge_title');
            }
        }
        return $titles;
    }

    /**
     * Administrators earn no points, so they always read empty here.
     *
     * @param array<string, mixed> $user
     * @return array<string, mixed>
     */
    public static function mine(array $user): array
    {
        if (Policy::isAdministrator($user)) {
            return ['total' => 0, 'badges' => [], 'next_badge' => null, 'recent' => []];
        }
        $userId = (int) $user['id'];
        $pdo = Database::pdo();
        $total = self::total($userId);

        $badges = $pdo->prepare(
            'SELECT b.id, b.badge_key, b.title, ub.awarded_at, ub.seen_at FROM user_badges ub
             JOIN badges b ON b.id = ub.badge_id WHERE ub.user_id = :user ORDER BY b.min_points'
        );
        $badges->execute(['user' => $userId]);

        $next = $pdo->prepare(
            'SELECT title, min_points FROM badges WHERE is_active = 1 AND min_points > :total ORDER BY min_points LIMIT 1'
        );
        $next->execute(['total' => $total]);
        $nextBadge = $next->fetch();

        $recent = $pdo->prepare(
            'SELECT event_key, entry_type, points, created_at FROM point_ledger WHERE user_id = :user ORDER BY id DESC LIMIT 20'
        );
        $recent->execute(['user' => $userId]);

        return [
            'total' => $total,
            'badges' => array_map(static fn (array $row): array => [
                'id' => (int) $row['id'],
                'badge_key' => $row['badge_key'],
                'title' => $row['title'],
                'awarded_at' => Time::iso($row['awarded_at']),
                'seen' => $row['seen_at'] !== null,
            ], $badges->fetchAll()),
            'next_badge' => $nextBadge === false ? null : [
                'title' => $nextBadge['title'],
                'min_points' => (int) $nextBadge['min_points'],
                'remaining' => (int) $nextBadge['min_points'] - $total,
            ],
            'recent' => array_map(static fn (array $row): array => [
                'event_key' => $row['event_key'],
                'entry_type' => $row['entry_type'],
                'points' => (int) $row['points'],
                'created_at' => Time::iso($row['created_at']),
            ], $recent->fetchAll()),
        ];
    }

    /** @param list<int> $badgeIds */
    public static function markSeen(int $userId, array $badgeIds): void
    {
        if ($badgeIds === []) {
            return;
        }
        $marks = implode(',', array_fill(0, count($badgeIds), '?'));
        Database::pdo()->prepare(
            "UPDATE user_badges SET seen_at = UTC_TIMESTAMP() WHERE seen_at IS NULL AND user_id = ? AND badge_id IN ({$marks})"
        )->execute([$userId, ...$badgeIds]);
    }

    /** @return array{rules: list<array<string, mixed>>, badges: list<array<string, mixed>>} */
    public static function settings(): array
    {
        $pdo = Database::pdo();
        return [
            'rules' => array_map(self::publicRule(...), $pdo->query('SELECT * FROM point_rules ORDER BY event_key')->fetchAll()),
            'badges' => array_map(self::publicBadge(...), $pdo->query('SELECT * FROM badges ORDER BY sort_order, min_points')->fetchAll()),
        ];
    }

    /**
     * Affects future awards only. Rules are fixed events, so only existing ones can change.
     *
     * @param array<string, mixed> $actor
     * @param array<string, mixed> $body
     * @return array<string, mixed>
     */
    public static function saveRule(array $actor, array $body): array
    {
        $eventKey = Validator::text($body, 'event_key', 64);
        $points = Validator::intRange($body, 'points', 0, self::MAX_POINTS);
        $active = Validator::bool($body, 'is_active');

        return Database::transaction(static function () use ($actor, $eventKey, $points, $active): array {
            $pdo = Database::pdo();
            $select = $pdo->prepare('SELECT * FROM point_rules WHERE event_key = :event FOR UPDATE');
            $select->execute(['event' => $eventKey]);
            $before = $select->fetch();
            if ($before === false) {
                throw new ApiError('NOT_FOUND');
            }
            $pdo->prepare('UPDATE point_rules SET points = :points, is_active = :active WHERE event_key = :event')
                ->execute(['points' => $points, 'active' => $active ? 1 : 0, 'event' => $eventKey]);
            AuditService::record($actor, 'points_settings_change', 'point_rule', null, [
                'event_key' => $eventKey,
                'points' => ['from' => (int) $before['points'], 'to' => $points],
                'is_active' => ['from' => (int) $before['is_active'] === 1, 'to' => $active],
            ]);
            $select->execute(['event' => $eventKey]);
            return self::publicRule($select->fetch());
        });
    }

    /**
     * Creates a badge or changes one. Badges are turned off with is_active, never deleted.
     *
     * @param array<string, mixed> $actor
     * @param array<string, mixed> $body
     * @return array<string, mixed>
     */
    public static function saveBadge(array $actor, array $body): array
    {
        $id = array_key_exists('id', $body) && $body['id'] !== null ? Validator::positiveInt($body, 'id') : null;
        $key = Validator::text($body, 'badge_key', 64);
        if (preg_match(self::BADGE_KEY, $key) !== 1) {
            throw ApiError::validation(['badge_key' => 'Use lowercase letters, numbers and underscores.']);
        }
        $title = Validator::trimmedText($body, 'title', 100);
        $minPoints = Validator::intRange($body, 'min_points', 0, self::MAX_POINTS);
        $sortOrder = Validator::intRange($body, 'sort_order', -1000, 1000);
        $active = Validator::bool($body, 'is_active');
        $values = ['key' => $key, 'title' => $title, 'min' => $minPoints, 'sort' => $sortOrder, 'active' => $active ? 1 : 0];

        return Database::transaction(static function () use ($actor, $id, $values): array {
            $pdo = Database::pdo();
            $duplicate = $pdo->prepare('SELECT id FROM badges WHERE badge_key = :key');
            $duplicate->execute(['key' => $values['key']]);
            $holder = $duplicate->fetchColumn();
            if ($holder !== false && (int) $holder !== $id) {
                throw ApiError::validation(['badge_key' => 'This key is already in use.']);
            }

            if ($id === null) {
                $pdo->prepare(
                    'INSERT INTO badges (badge_key, title, min_points, sort_order, is_active) VALUES (:key, :title, :min, :sort, :active)'
                )->execute($values);
                $badgeId = (int) $pdo->lastInsertId();
            } else {
                $update = $pdo->prepare(
                    'UPDATE badges SET badge_key = :key, title = :title, min_points = :min, sort_order = :sort, is_active = :active WHERE id = :id'
                );
                $update->execute($values + ['id' => $id]);
                $badgeId = $id;
            }
            $select = $pdo->prepare('SELECT * FROM badges WHERE id = :id');
            $select->execute(['id' => $badgeId]);
            $badge = $select->fetch();
            if ($badge === false) {
                throw new ApiError('NOT_FOUND');
            }
            AuditService::record($actor, 'points_settings_change', 'badge', $badgeId, $values);
            return self::publicBadge($badge);
        });
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private static function publicRule(array $row): array
    {
        return [
            'event_key' => $row['event_key'],
            'label' => $row['label'],
            'points' => (int) $row['points'],
            'is_active' => (int) $row['is_active'] === 1,
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private static function publicBadge(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'badge_key' => $row['badge_key'],
            'title' => $row['title'],
            'min_points' => (int) $row['min_points'],
            'sort_order' => (int) $row['sort_order'],
            'is_active' => (int) $row['is_active'] === 1,
        ];
    }
}
