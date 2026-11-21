<?php

declare(strict_types=1);

require dirname(__DIR__) . '/includes/bootstrap.php';

Policy::dispatch([
    'dashboard' => [
        'method' => 'GET',
        'role' => Policy::ADMINISTRATOR,
        'handler' => static fn (): array => [
            'users_by_role' => UserService::countsByRole(),
            'pending_reviews' => ReviewService::pendingCount(),
            'published_tutorials' => TutorialService::publishedCount(),
            'active_locks' => LockService::activeCount(),
        ],
    ],
    'force_unlock' => [
        'method' => 'POST',
        'role' => Policy::ADMINISTRATOR,
        'handler' => static function (array $user): array {
            $tutorialId = Validator::positiveInt(Request::json(), 'tutorial_id');
            Database::transaction(static function () use ($user, $tutorialId): void {
                LockService::forceUnlock($tutorialId);
                AuditService::record($user, 'force_unlock', 'tutorial', $tutorialId);
            });
            return [];
        },
    ],
    'delete_tutorial' => [
        'method' => 'POST',
        'role' => Policy::ADMINISTRATOR,
        'handler' => static function (array $user): array {
            TutorialService::delete(Validator::positiveInt(Request::json(), 'tutorial_id'), $user);
            return [];
        },
    ],
    'audit' => [
        'method' => 'GET',
        'role' => Policy::ADMINISTRATOR,
        'handler' => static function (): never {
            ['page' => $page, 'per_page' => $perPage] = Request::pagination();
            $actor = Request::query('actor_id');
            $actorId = $actor !== null && ctype_digit($actor) ? (int) $actor : null;
            // The audit filter is also named action, so it comes from a dedicated query key.
            $result = AuditService::list(Request::query('filter_action') ?? '', $actorId, $page, $perPage);
            Response::page($result['items'], $page, $perPage, $result['total']);
        },
    ],
    'cleanup_images' => [
        'method' => 'POST',
        'role' => Policy::ADMINISTRATOR,
        'handler' => static function (array $user): array {
            $dryRun = Validator::bool(Request::json(), 'dry_run');
            $result = UploadService::cleanup($dryRun);
            if (!$dryRun) {
                AuditService::record($user, 'image_cleanup', null, null, [
                    'deleted_count' => $result['deleted_count'],
                    'freed_bytes' => $result['freed_bytes'],
                ]);
            }
            return $result;
        },
    ],
]);
