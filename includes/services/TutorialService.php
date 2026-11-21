<?php

declare(strict_types=1);

/** Tutorials and their versions: public reads, the editor workflow and going live (PRD 5.5, 5.7, API 4.1, 4.2). */
final class TutorialService
{
    private const LIST_STATES = ['none', 'live', 'draft', 'pending_review', 'rejected', 'locked'];

    private const DELETED_ACCOUNT = 'Deleted Account';

    /** @return list<array{achievement_id: int, langs: list<string>, has_video: bool}> */
    public static function index(): array
    {
        $rows = Database::pdo()->query(
            'SELECT t.achievement_id, tr.lang, tr.video_id
             FROM tutorials t
             JOIN tutorial_translations tr ON tr.version_id = t.live_version_id
             ORDER BY t.achievement_id, tr.lang'
        )->fetchAll();

        $items = [];
        foreach ($rows as $row) {
            $id = (int) $row['achievement_id'];
            $items[$id] ??= ['achievement_id' => $id, 'langs' => [], 'has_video' => false];
            $items[$id]['langs'][] = $row['lang'];
            $items[$id]['has_video'] = $items[$id]['has_video'] || $row['video_id'] !== null;
        }
        return array_values($items);
    }

    /** @return array<string, mixed>|null The live version, or null when there is no tutorial yet. */
    public static function getLive(int $achievementId): ?array
    {
        if (!AchievementCatalog::hasAchievement($achievementId)) {
            throw new ApiError('NOT_FOUND');
        }
        $statement = Database::pdo()->prepare(
            'SELECT v.id, v.tutorial_id, v.version_no, v.published_at, v.created_by, u.display_name, u.avatar_url
             FROM tutorials t
             JOIN tutorial_versions v ON v.id = t.live_version_id
             LEFT JOIN users u ON u.id = v.created_by
             WHERE t.achievement_id = :achievement'
        );
        $statement->execute(['achievement' => $achievementId]);
        $row = $statement->fetch();
        if ($row === false) {
            return null;
        }
        $first = self::firstPublished((int) $row['tutorial_id']);
        $isEdited = $first !== null && (int) $first['id'] !== (int) $row['id'];
        $badges = PointsService::topBadgeTitles(self::ids([$row['created_by'], $isEdited ? $first['created_by'] : null]));
        return [
            'achievement_id' => $achievementId,
            'version_no' => (int) $row['version_no'],
            'published_at' => Time::iso($row['published_at']),
            'author' => self::creditAuthor($row, $badges),
            'first_published' => $isEdited
                ? ['published_at' => Time::iso($first['published_at']), 'author' => self::creditAuthor($first, $badges)]
                : null,
            'content' => self::content((int) $row['id']),
        ];
    }

    /**
     * The first version of a tutorial that was ever published, live or replaced since.
     *
     * @return array<string, mixed>|null
     */
    private static function firstPublished(int $tutorialId): ?array
    {
        $statement = Database::pdo()->prepare(
            'SELECT v.id, v.published_at, v.created_by, u.display_name, u.avatar_url
             FROM tutorial_versions v
             LEFT JOIN users u ON u.id = v.created_by
             WHERE v.tutorial_id = :tutorial AND v.published_at IS NOT NULL
             ORDER BY v.published_at, v.id
             LIMIT 1'
        );
        $statement->execute(['tutorial' => $tutorialId]);
        $row = $statement->fetch();
        return $row === false ? null : $row;
    }

    /**
     * The author object plus the avatar, for the public tutorial credit. A deleted account has no avatar.
     *
     * @param array<string, mixed> $row created_by, display_name and avatar_url
     * @param array<int, string> $badgeTitles
     * @return array{display_name: string, top_badge_title: ?string, avatar_url: ?string}
     */
    private static function creditAuthor(array $row, array $badgeTitles): array
    {
        return self::author($row['created_by'], $row['display_name'], $badgeTitles)
            + ['avatar_url' => $row['created_by'] === null ? null : $row['avatar_url']];
    }

    /**
     * The content object from API section 4. HTML is sanitized again on the way out.
     *
     * @return array{id: ?array<string, mixed>, en: ?array<string, mixed>}
     */
    public static function content(int $versionId): array
    {
        $statement = Database::pdo()->prepare(
            'SELECT lang, body_html, video_provider, video_id FROM tutorial_translations WHERE version_id = :version'
        );
        $statement->execute(['version' => $versionId]);
        $content = ['id' => null, 'en' => null];
        foreach ($statement->fetchAll() as $row) {
            $content[$row['lang']] = [
                'body_html' => HtmlSanitizer::clean((string) $row['body_html']),
                'video' => VideoEmbed::toApi($row['video_provider'], $row['video_id']),
            ];
        }
        return $content;
    }

    /**
     * @param array<int, string> $badgeTitles
     * @return array{display_name: string, top_badge_title: ?string}
     */
    public static function author(mixed $userId, ?string $displayName, array $badgeTitles): array
    {
        if ($userId === null) {
            return ['display_name' => self::DELETED_ACCOUNT, 'top_badge_title' => null];
        }
        return ['display_name' => (string) $displayName, 'top_badge_title' => $badgeTitles[(int) $userId] ?? null];
    }

    /**
     * @param list<mixed> $values
     * @return list<int>
     */
    private static function ids(array $values): array
    {
        return array_values(array_unique(array_map('intval', array_filter($values, static fn (mixed $id): bool => $id !== null))));
    }

    /**
     * Every achievement from the JSON joined with its tutorial state. Lock holder emails are for Administrators only.
     *
     * @return array{items: list<array<string, mixed>>, total: int}
     */
    public static function listForEditor(string $query, string $state, int $page, int $perPage, bool $withEmails): array
    {
        if ($state !== '' && !in_array($state, self::LIST_STATES, true)) {
            throw ApiError::validation(['state' => 'Unknown state.']);
        }
        $states = self::editorStates();
        $badges = PointsService::topBadgeTitles(self::ids(array_merge(
            array_column($states, 'live_by'),
            array_column($states, 'open_by'),
        )));
        $needle = trim($query);

        $matches = [];
        foreach (AchievementCatalog::names() as $achievementId => $names) {
            $row = $states[$achievementId] ?? null;
            if (self::matchesQuery($achievementId, $names, $needle) && self::matchesState($row, $state)) {
                $matches[$achievementId] = ['names' => $names, 'row' => $row];
            }
        }

        $items = [];
        foreach (array_slice($matches, ($page - 1) * $perPage, $perPage, true) as $achievementId => $match) {
            $items[] = self::editorItem($achievementId, $match['names'], $match['row'], $badges, $withEmails);
        }
        return ['items' => $items, 'total' => count($matches)];
    }

    /** @return array<int, array<string, mixed>> Tutorial state per achievement */
    private static function editorStates(): array
    {
        $statement = Database::pdo()->prepare(
            'SELECT t.id, t.achievement_id, t.is_locked, t.locked_by,
                    TIMESTAMPDIFF(SECOND, t.last_activity_at, UTC_TIMESTAMP()) AS idle_seconds,
                    t.last_activity_at + INTERVAL :timeout SECOND AS expires_at,
                    locker.display_name AS locked_by_name, locker.email AS locked_by_email,
                    live.version_no AS live_no, live.published_at AS live_at, live.created_by AS live_by, live_user.display_name AS live_name,
                    open_v.id AS open_id, open_v.version_no AS open_no, open_v.status AS open_status, open_v.created_at AS open_at,
                    open_v.created_by AS open_by, open_user.display_name AS open_name
             FROM tutorials t
             LEFT JOIN users locker ON locker.id = t.locked_by
             LEFT JOIN tutorial_versions live ON live.id = t.live_version_id
             LEFT JOIN users live_user ON live_user.id = live.created_by
             LEFT JOIN tutorial_versions open_v ON open_v.open_tutorial_id = t.id
             LEFT JOIN users open_user ON open_user.id = open_v.created_by'
        );
        $statement->execute(['timeout' => (int) Config::get('lock.timeout_seconds')]);
        $states = [];
        foreach ($statement->fetchAll() as $row) {
            $states[(int) $row['achievement_id']] = $row;
        }
        return $states;
    }

    /** @param array{id: string, en: string} $names */
    private static function matchesQuery(int $achievementId, array $names, string $needle): bool
    {
        return $needle === ''
            || (string) $achievementId === $needle
            || mb_stripos($names['id'], $needle) !== false
            || mb_stripos($names['en'], $needle) !== false;
    }

    /** @param array<string, mixed>|null $row */
    private static function matchesState(?array $row, string $state): bool
    {
        return match ($state) {
            '' => true,
            'none' => $row === null || ($row['live_no'] === null && $row['open_id'] === null),
            'live' => $row !== null && $row['live_no'] !== null,
            'locked' => $row !== null && LockService::isFresh($row),
            default => $row !== null && $row['open_status'] === $state,
        };
    }

    /**
     * @param array{id: string, en: string} $names
     * @param array<string, mixed>|null $row
     * @param array<int, string> $badges
     * @return array<string, mixed>
     */
    private static function editorItem(int $achievementId, array $names, ?array $row, array $badges, bool $withEmails): array
    {
        $live = $row !== null && $row['live_no'] !== null ? [
            'version_no' => (int) $row['live_no'],
            'published_at' => Time::iso($row['live_at']),
            'author' => self::author($row['live_by'], $row['live_name'], $badges),
        ] : null;
        $open = $row !== null && $row['open_id'] !== null ? [
            'version_id' => (int) $row['open_id'],
            'version_no' => (int) $row['open_no'],
            'status' => $row['open_status'],
            'created_at' => Time::iso($row['open_at']),
            'owner_id' => $row['open_by'] === null ? null : (int) $row['open_by'],
            'author' => self::author($row['open_by'], $row['open_name'], $badges),
        ] : null;
        $lock = $row !== null && LockService::isFresh($row) ? [
            'held_by_name' => $row['locked_by_name'] ?? self::DELETED_ACCOUNT,
            'held_by_email' => $withEmails ? $row['locked_by_email'] : null,
            'expires_at' => Time::iso($row['expires_at']),
        ] : null;

        return [
            'achievement_id' => $achievementId,
            'tutorial_id' => $row === null ? null : (int) $row['id'],
            'name_id' => $names['id'],
            'name_en' => $names['en'],
            'live' => $live,
            'open_version' => $open,
            'lock' => $lock,
        ];
    }

    /**
     * Takes the lock and returns what the editor starts from. The version row waits for the first Save.
     *
     * @param array<string, mixed> $user
     * @return array<string, mixed>
     */
    public static function open(int $achievementId, array $user, bool $takeOver): array
    {
        if (!AchievementCatalog::hasAchievement($achievementId)) {
            throw new ApiError('NOT_FOUND');
        }
        $userId = (int) $user['id'];

        return Database::transaction(static function () use ($achievementId, $user, $userId, $takeOver): array {
            $pdo = Database::pdo();
            $pdo->prepare('INSERT IGNORE INTO tutorials (achievement_id) VALUES (:achievement)')->execute(['achievement' => $achievementId]);
            $select = $pdo->prepare('SELECT id FROM tutorials WHERE achievement_id = :achievement');
            $select->execute(['achievement' => $achievementId]);
            $tutorialId = (int) $select->fetchColumn();

            $tutorial = LockService::row($tutorialId);
            LockService::assertFree($tutorial, $user);

            $version = self::openVersion($tutorialId);
            if ($version !== null) {
                self::assertCanEditOpenVersion($version, $user, $takeOver);
            }
            LockService::acquire($tutorialId, $userId);

            $sourceId = $version['id'] ?? $tutorial['live_version_id'];
            $empty = ['id' => null, 'en' => null];
            return [
                'tutorial_id' => $tutorialId,
                'version_id' => $version === null ? null : (int) $version['id'],
                'status' => $version['status'] ?? null,
                'content' => $sourceId === null ? $empty : self::content((int) $sourceId),
                'rejection_reason' => ($version['status'] ?? null) === 'rejected' ? ReviewService::latestReason((int) $version['id']) : null,
                'lock' => LockService::clientLock($tutorialId),
            ];
        });
    }

    /**
     * A pending version stays closed until it is withdrawn. Someone else's version needs an Administrator take over.
     *
     * @param array<string, mixed> $version
     * @param array<string, mixed> $user
     */
    private static function assertCanEditOpenVersion(array $version, array $user, bool $takeOver): void
    {
        $isOwner = $version['created_by'] !== null && (int) $version['created_by'] === (int) $user['id'];
        if (!$isOwner && !($takeOver && Policy::isAdministrator($user))) {
            $owner = $version['created_by'] === null ? null : UserService::findById((int) $version['created_by']);
            throw new ApiError('OPEN_VERSION_EXISTS', [
                'owner_name' => $owner['display_name'] ?? self::DELETED_ACCOUNT,
                'owner_email' => Policy::isAdministrator($user) ? ($owner['email'] ?? null) : null,
                'status' => $version['status'],
            ]);
        }
        if ($version['status'] === 'pending_review') {
            throw new ApiError('INVALID_STATE', ['current_status' => 'pending_review']);
        }
    }

    /** @return array<string, mixed>|null */
    private static function openVersion(int $tutorialId): ?array
    {
        $statement = Database::pdo()->prepare('SELECT * FROM tutorial_versions WHERE open_tutorial_id = :tutorial FOR UPDATE');
        $statement->execute(['tutorial' => $tutorialId]);
        $row = $statement->fetch();
        return $row === false ? null : $row;
    }

    /**
     * @param array<string, mixed> $user
     * @return array{version_id: int, version_no: int, status: string, saved_at: ?string}
     */
    public static function save(int $tutorialId, array $user, mixed $contentInput, bool $autosave): array
    {
        $translations = self::parseContentInput($contentInput);
        $userId = (int) $user['id'];

        return Database::transaction(static function () use ($tutorialId, $user, $userId, $translations, $autosave): array {
            $pdo = Database::pdo();
            LockService::assertHeld(LockService::row($tutorialId), $userId);

            $version = self::openVersion($tutorialId);
            if ($version === null) {
                $version = self::createVersion($tutorialId, $userId);
            } else {
                self::assertCanChange($version, $user);
                if ($version['status'] === 'pending_review') {
                    throw new ApiError('INVALID_STATE', ['current_status' => 'pending_review']);
                }
                if ($version['status'] === 'rejected') {
                    self::setStatus((int) $version['id'], 'rejected', 'draft', $userId);
                }
            }
            $versionId = (int) $version['id'];

            $pdo->prepare('DELETE FROM tutorial_translations WHERE version_id = :version')->execute(['version' => $versionId]);
            $insert = $pdo->prepare(
                'INSERT INTO tutorial_translations (version_id, lang, body_html, video_provider, video_id)
                 VALUES (:version, :lang, :body, :provider, :video)'
            );
            foreach ($translations as $lang => $translation) {
                $insert->execute([
                    'version' => $versionId,
                    'lang' => $lang,
                    'body' => $translation['body_html'],
                    'provider' => $translation['provider'],
                    'video' => $translation['video_id'],
                ]);
            }
            // An autosave comes from a timer, so only a real Save counts as activity.
            if (!$autosave) {
                LockService::touch($tutorialId);
            }
            $now = $pdo->query('SELECT UTC_TIMESTAMP()')->fetchColumn();
            return [
                'version_id' => $versionId,
                'version_no' => (int) $version['version_no'],
                'status' => 'draft',
                'saved_at' => Time::iso((string) $now),
            ];
        });
    }

    /**
     * Languages with no text and no video are left out, because a missing row means "not available".
     *
     * @return array<string, array{body_html: string, provider: ?string, video_id: ?string}>
     */
    private static function parseContentInput(mixed $input): array
    {
        if (!is_array($input)) {
            throw new ApiError('BAD_REQUEST');
        }
        $translations = [];
        foreach (AchievementCatalog::LANGS as $lang) {
            $entry = $input[$lang] ?? null;
            if ($entry === null) {
                continue;
            }
            if (!is_array($entry)) {
                throw ApiError::validation(["content_input.{$lang}" => 'Must be an object or null.']);
            }
            $bodyInput = $entry['body_html'] ?? '';
            $videoUrl = $entry['video_url'] ?? '';
            if (!is_string($bodyInput) || !is_string($videoUrl)) {
                throw ApiError::validation(["content_input.{$lang}" => 'Must hold text fields.']);
            }
            $video = null;
            if (trim($videoUrl) !== '') {
                $video = VideoEmbed::parse($videoUrl)
                    ?? throw ApiError::validation(["content_input.{$lang}.video_url" => 'Must be a YouTube link.']);
            }
            $body = HtmlSanitizer::clean($bodyInput);
            $body = HtmlSanitizer::isBlank($body) ? '' : $body;
            if ($body !== '' || $video !== null) {
                $translations[$lang] = [
                    'body_html' => $body,
                    'provider' => $video['provider'] ?? null,
                    'video_id' => $video['video_id'] ?? null,
                ];
            }
        }
        return $translations;
    }

    /** @return array<string, mixed> */
    private static function createVersion(int $tutorialId, int $userId): array
    {
        $pdo = Database::pdo();
        $next = $pdo->prepare('SELECT COALESCE(MAX(version_no), 0) + 1 FROM tutorial_versions WHERE tutorial_id = :tutorial');
        $next->execute(['tutorial' => $tutorialId]);
        $versionNo = (int) $next->fetchColumn();

        $pdo->prepare('INSERT INTO tutorial_versions (tutorial_id, version_no, status, created_by) VALUES (:tutorial, :no, :status, :user)')
            ->execute(['tutorial' => $tutorialId, 'no' => $versionNo, 'status' => 'draft', 'user' => $userId]);
        $versionId = (int) $pdo->lastInsertId();
        ReviewService::log($versionId, null, 'draft', $userId, null);
        return ['id' => $versionId, 'version_no' => $versionNo, 'status' => 'draft', 'created_by' => $userId];
    }

    /**
     * @param array<string, mixed> $version
     * @param array<string, mixed> $user
     */
    private static function assertCanChange(array $version, array $user): void
    {
        $isOwner = $version['created_by'] !== null && (int) $version['created_by'] === (int) $user['id'];
        if (!$isOwner && !Policy::isAdministrator($user)) {
            throw new ApiError('FORBIDDEN');
        }
    }

    private static function setStatus(int $versionId, string $from, string $to, ?int $actorId, ?string $reason = null): void
    {
        Database::pdo()->prepare('UPDATE tutorial_versions SET status = :status WHERE id = :id')->execute(['status' => $to, 'id' => $versionId]);
        ReviewService::log($versionId, $from, $to, $actorId, $reason);
    }

    /**
     * The draft the caller holds the lock on, ready for Submit or Publish.
     *
     * @param array<string, mixed> $user
     * @return array<string, mixed>
     */
    private static function draftForLeaving(int $tutorialId, array $user): array
    {
        LockService::assertHeld(LockService::row($tutorialId), (int) $user['id']);
        $version = self::openVersion($tutorialId) ?? throw new ApiError('INVALID_STATE', ['current_status' => 'none']);
        self::assertCanChange($version, $user);
        if ($version['status'] !== 'draft') {
            throw new ApiError('INVALID_STATE', ['current_status' => $version['status']]);
        }
        if (self::langs((int) $version['id']) === []) {
            throw ApiError::validation(['content_input' => 'Add text or a video in at least one language.']);
        }
        return $version;
    }

    /**
     * @param array<string, mixed> $user
     * @return array{version_id: int, status: string}
     */
    public static function submit(int $tutorialId, array $user): array
    {
        return Database::transaction(static function () use ($tutorialId, $user): array {
            $version = self::draftForLeaving($tutorialId, $user);
            $versionId = (int) $version['id'];
            Database::pdo()->prepare('UPDATE tutorial_versions SET submitted_at = UTC_TIMESTAMP() WHERE id = :id')->execute(['id' => $versionId]);
            self::setStatus($versionId, 'draft', 'pending_review', (int) $user['id']);
            LockService::clear($tutorialId);
            return ['version_id' => $versionId, 'status' => 'pending_review'];
        });
    }

    /**
     * @param array<string, mixed> $user
     * @return array{version_id: int, status: string}
     */
    public static function publish(int $tutorialId, array $user): array
    {
        return Database::transaction(static function () use ($tutorialId, $user): array {
            $version = self::draftForLeaving($tutorialId, $user);
            self::goLive($version, (int) LockService::row($tutorialId)['live_version_id'] ?: null, (int) $user['id']);
            return ['version_id' => (int) $version['id'], 'status' => 'published'];
        });
    }

    /**
     * One transaction with the caller: old live becomes replaced, the new version goes live, points go to its creator.
     *
     * @param array<string, mixed> $version
     * @return array{points: list<array{event_key: string, points: int}>, badges: list<string>}
     */
    public static function goLive(array $version, ?int $previousLiveId, int $actorId): array
    {
        $pdo = Database::pdo();
        $versionId = (int) $version['id'];
        $tutorialId = (int) $version['tutorial_id'];
        $creatorId = $version['created_by'] === null ? null : (int) $version['created_by'];

        // Compared before the old version changes hands.
        $awards = PointsService::awardForPublish(
            $creatorId,
            $versionId,
            $previousLiveId,
            self::langs($versionId),
            $previousLiveId === null ? [] : self::langs($previousLiveId),
        );
        if ($previousLiveId !== null) {
            self::setStatus($previousLiveId, 'published', 'replaced', $actorId);
        }
        $pdo->prepare('UPDATE tutorial_versions SET published_at = UTC_TIMESTAMP() WHERE id = :id')->execute(['id' => $versionId]);
        self::setStatus($versionId, (string) $version['status'], 'published', $actorId);
        $pdo->prepare('UPDATE tutorials SET live_version_id = :version WHERE id = :id')->execute(['version' => $versionId, 'id' => $tutorialId]);
        LockService::clear($tutorialId);
        return $awards;
    }

    /** @return list<string> Languages that have content in this version */
    public static function langs(int $versionId): array
    {
        $statement = Database::pdo()->prepare('SELECT lang FROM tutorial_translations WHERE version_id = :version ORDER BY lang');
        $statement->execute(['version' => $versionId]);
        return $statement->fetchAll(PDO::FETCH_COLUMN);
    }

    /** @return array<string, mixed> */
    private static function versionForUpdate(int $versionId): array
    {
        $statement = Database::pdo()->prepare('SELECT * FROM tutorial_versions WHERE id = :id FOR UPDATE');
        $statement->execute(['id' => $versionId]);
        $row = $statement->fetch();
        if ($row === false) {
            throw new ApiError('NOT_FOUND');
        }
        return $row;
    }

    /**
     * Version owner only: pending goes back to draft.
     *
     * @return array{version_id: int, status: string}
     */
    public static function withdraw(int $versionId, int $userId): array
    {
        return Database::transaction(static function () use ($versionId, $userId): array {
            $version = self::versionForUpdate($versionId);
            if ($version['created_by'] === null || (int) $version['created_by'] !== $userId) {
                throw new ApiError('FORBIDDEN');
            }
            if ($version['status'] !== 'pending_review') {
                throw new ApiError('INVALID_STATE', ['current_status' => $version['status']]);
            }
            Database::pdo()->prepare('UPDATE tutorial_versions SET submitted_at = NULL WHERE id = :id')->execute(['id' => $versionId]);
            self::setStatus($versionId, 'pending_review', 'draft', $userId);
            return ['version_id' => $versionId, 'status' => 'draft'];
        });
    }

    /**
     * Deletes an open version. Its uploaded images are left for the image cleanup.
     *
     * @param array<string, mixed> $user
     */
    public static function discard(int $versionId, array $user): void
    {
        Database::transaction(static function () use ($versionId, $user): void {
            $version = self::versionForUpdate($versionId);
            self::assertCanChange($version, $user);
            if (!in_array($version['status'], ['draft', 'pending_review', 'rejected'], true)) {
                throw new ApiError('INVALID_STATE', ['current_status' => $version['status']]);
            }
            $tutorialId = (int) $version['tutorial_id'];
            LockService::assertFree(LockService::row($tutorialId), $user);
            Database::pdo()->prepare('DELETE FROM tutorial_versions WHERE id = :id')->execute(['id' => $versionId]);
            LockService::release($tutorialId, (int) $user['id']);
        });
    }

    /**
     * Removes a tutorial with all its versions and reverses their points. Badges stay (PRD 5.8).
     * Someone actively editing must be force unlocked first, so they are never surprised.
     *
     * @param array<string, mixed> $actor
     */
    public static function delete(int $tutorialId, array $actor): void
    {
        Database::transaction(static function () use ($tutorialId, $actor): void {
            $pdo = Database::pdo();
            $tutorial = LockService::row($tutorialId);
            LockService::assertFree($tutorial, $actor);

            $select = $pdo->prepare('SELECT id FROM tutorial_versions WHERE tutorial_id = :tutorial');
            $select->execute(['tutorial' => $tutorialId]);
            PointsService::reverseForVersions(array_map('intval', $select->fetchAll(PDO::FETCH_COLUMN)));

            $pdo->prepare('DELETE FROM tutorials WHERE id = :id')->execute(['id' => $tutorialId]);
            AuditService::record($actor, 'tutorial_delete', 'tutorial', $tutorialId, ['achievement_id' => (int) $tutorial['achievement_id']]);
        });
    }

    public static function publishedCount(): int
    {
        return (int) Database::pdo()->query('SELECT COUNT(*) FROM tutorials WHERE live_version_id IS NOT NULL')->fetchColumn();
    }
}
