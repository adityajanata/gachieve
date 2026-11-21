<?php

declare(strict_types=1);

final class UserService
{
    /** @return array<string, mixed>|null */
    public static function findById(int $id): ?array
    {
        $statement = Database::pdo()->prepare('SELECT * FROM users WHERE id = :id');
        $statement->execute(['id' => $id]);
        $row = $statement->fetch();
        return $row === false ? null : $row;
    }

    /**
     * Finds or creates the account behind a verified Google identity. The Google name and photo stay
     * current; display_name belongs to the user and is only set on creation.
     *
     * @param array{sub: string, email: string, name: string, picture: ?string} $identity
     * @return array{user: array<string, mixed>, is_new: bool}
     */
    public static function signIn(array $identity): array
    {
        return Database::transaction(static function () use ($identity): array {
            $pdo = Database::pdo();
            $select = $pdo->prepare('SELECT id FROM users WHERE google_sub = :sub FOR UPDATE');
            $select->execute(['sub' => $identity['sub']]);
            $existingId = $select->fetchColumn();

            // Email is unique: another Google account already holding it would fail the write below.
            $taken = $pdo->prepare('SELECT id FROM users WHERE email = :email AND google_sub <> :sub');
            $taken->execute(['email' => $identity['email'], 'sub' => $identity['sub']]);
            if ($taken->fetchColumn() !== false) {
                throw ApiError::validation(['credential' => 'This email is already linked to another Google account.']);
            }

            if ($existingId !== false) {
                $pdo->prepare(
                    'UPDATE users SET email = :email, name = :name, avatar_url = :avatar, last_login_at = UTC_TIMESTAMP()
                     WHERE id = :id'
                )->execute([
                    'email' => $identity['email'],
                    'name' => $identity['name'],
                    'avatar' => $identity['picture'],
                    'id' => $existingId,
                ]);
                return ['user' => self::findById((int) $existingId), 'is_new' => false];
            }

            $pdo->prepare(
                'INSERT INTO users (google_sub, email, name, display_name, avatar_url, role, last_login_at)
                 VALUES (:sub, :email, :name, :display_name, :avatar, :role, UTC_TIMESTAMP())'
            )->execute([
                'sub' => $identity['sub'],
                'email' => $identity['email'],
                'name' => $identity['name'],
                'display_name' => mb_substr($identity['name'], 0, 40),
                'avatar' => $identity['picture'],
                'role' => self::roleForNewUser($identity['email']),
            ]);
            return ['user' => self::findById((int) $pdo->lastInsertId()), 'is_new' => true];
        });
    }

    private static function roleForNewUser(string $email): string
    {
        $adminEmails = array_map('strtolower', (array) Config::get('auth.bootstrap_admin_emails'));
        return in_array(strtolower($email), $adminEmails, true) ? 'administrator' : 'traveler';
    }

    /** @return array<string, mixed> */
    public static function updateDisplayName(int $id, string $displayName): array
    {
        Database::pdo()
            ->prepare('UPDATE users SET display_name = :name WHERE id = :id')
            ->execute(['name' => $displayName, 'id' => $id]);
        return self::findById($id);
    }

    /** Foreign keys remove progress, points, badges and bulk history. Tutorials stay, shown as Deleted Account. */
    public static function delete(int $id): void
    {
        $remove = static function () use ($id): void {
            LockService::releaseAllBy($id);
            Database::pdo()->prepare('DELETE FROM users WHERE id = :id')->execute(['id' => $id]);
        };
        // deleteByAdmin already runs in a transaction of its own.
        Database::pdo()->inTransaction() ? $remove() : Database::transaction($remove);
    }

    /**
     * The Users page. Each filter is optional.
     *
     * @return array{items: list<array<string, mixed>>, total: int}
     */
    public static function listForAdmin(string $query, string $role, ?bool $active, int $page, int $perPage): array
    {
        $where = [];
        $params = [];
        if (trim($query) !== '') {
            $like = '%' . addcslashes(trim($query), '\\%_') . '%';
            $where[] = '(u.display_name LIKE :name OR u.email LIKE :email)';
            $params['name'] = $like;
            $params['email'] = $like;
        }
        if ($role !== '') {
            self::assertRole($role);
            $where[] = 'u.role = :role';
            $params['role'] = $role;
        }
        if ($active !== null) {
            $where[] = 'u.is_active = :active';
            $params['active'] = $active ? 1 : 0;
        }
        $clause = $where === [] ? '' : ' WHERE ' . implode(' AND ', $where);
        $pdo = Database::pdo();

        $count = $pdo->prepare("SELECT COUNT(*) FROM users u{$clause}");
        $count->execute($params);

        $statement = $pdo->prepare(
            "SELECT u.id, u.display_name, u.email, u.avatar_url, u.role, u.is_active, u.created_at, u.last_login_at,
                    (SELECT COALESCE(SUM(l.points), 0) FROM point_ledger l WHERE l.user_id = u.id) AS points
             FROM users u{$clause}
             ORDER BY u.id
             LIMIT :limit OFFSET :offset"
        );
        foreach ($params as $name => $value) {
            $statement->bindValue($name, $value);
        }
        $statement->bindValue('limit', $perPage, PDO::PARAM_INT);
        $statement->bindValue('offset', ($page - 1) * $perPage, PDO::PARAM_INT);
        $statement->execute();
        $rows = $statement->fetchAll();
        $badges = PointsService::topBadgeTitles(array_map(static fn (array $row): int => (int) $row['id'], $rows));

        return [
            'items' => array_map(static fn (array $row): array => [
                'id' => (int) $row['id'],
                'display_name' => $row['display_name'],
                'email' => $row['email'],
                'avatar_url' => $row['avatar_url'],
                'is_agent' => Policy::isAgentId((int) $row['id']),
                'top_badge_title' => $badges[(int) $row['id']] ?? null,
                'role' => $row['role'],
                'is_active' => (int) $row['is_active'] === 1,
                'points' => (int) $row['points'],
                'created_at' => Time::iso($row['created_at']),
                'last_login_at' => Time::iso($row['last_login_at']),
            ], $rows),
            'total' => (int) $count->fetchColumn(),
        ];
    }

    private static function assertRole(string $role): void
    {
        if (!in_array($role, [Policy::TRAVELER, Policy::CONTRIBUTOR, Policy::ADMINISTRATOR], true)) {
            throw ApiError::validation(['role' => 'Unknown role.']);
        }
    }

    /** The agent keeps its role and is never deleted: its tutorials would lose their author. Disable is its off switch. */
    private static function assertNotAgent(int $userId): void
    {
        if (Policy::isAgentId($userId)) {
            throw new ApiError('FORBIDDEN');
        }
    }

    /**
     * An Administrator never acts on their own account here, so at least one Administrator always remains.
     *
     * @param array<string, mixed> $actor
     * @return array<string, mixed> The target row
     */
    private static function targetFor(array $actor, int $userId): array
    {
        if ((int) $actor['id'] === $userId) {
            throw new ApiError('FORBIDDEN');
        }
        return self::findById($userId) ?? throw new ApiError('NOT_FOUND');
    }

    /**
     * @param array<string, mixed> $actor
     * @return array<string, mixed>
     */
    public static function setRole(array $actor, int $userId, string $role): array
    {
        self::assertRole($role);
        self::assertNotAgent($userId);
        return Database::transaction(static function () use ($actor, $userId, $role): array {
            $target = self::targetFor($actor, $userId);
            Database::pdo()->prepare('UPDATE users SET role = :role WHERE id = :id')->execute(['role' => $role, 'id' => $userId]);
            if ($role === Policy::TRAVELER) {
                LockService::releaseAllBy($userId); // A Traveler can no longer edit, so the lock should not wait for its timeout.
            }
            AuditService::record($actor, 'role_change', 'user', $userId, ['from' => $target['role'], 'to' => $role]);
            return self::findById($userId);
        });
    }

    /**
     * @param array<string, mixed> $actor
     * @return array<string, mixed>
     */
    public static function setActive(array $actor, int $userId, bool $active): array
    {
        return Database::transaction(static function () use ($actor, $userId, $active): array {
            self::targetFor($actor, $userId);
            Database::pdo()->prepare('UPDATE users SET is_active = :active WHERE id = :id')->execute(['active' => $active ? 1 : 0, 'id' => $userId]);
            if (!$active) {
                LockService::releaseAllBy($userId);
            }
            AuditService::record($actor, $active ? 'account_enable' : 'account_disable', 'user', $userId);
            return self::findById($userId);
        });
    }

    /** @param array<string, mixed> $actor */
    public static function deleteByAdmin(array $actor, int $userId): void
    {
        self::assertNotAgent($userId);
        Database::transaction(static function () use ($actor, $userId): void {
            $target = self::targetFor($actor, $userId);
            AuditService::record($actor, 'account_delete', 'user', $userId, ['display_name' => $target['display_name']]);
            self::delete($userId);
        });
    }

    /** @return array<string, int> */
    public static function countsByRole(): array
    {
        $counts = [Policy::TRAVELER => 0, Policy::CONTRIBUTOR => 0, Policy::ADMINISTRATOR => 0];
        foreach (Database::pdo()->query('SELECT role, COUNT(*) AS total FROM users GROUP BY role')->fetchAll() as $row) {
            $counts[$row['role']] = (int) $row['total'];
        }
        return $counts;
    }

    /**
     * Creates the writer agent account, or updates its name, email and picture when it exists (Decisions Log 62).
     * Its google_sub is not a Google id (those are digits only), so no Google sign-in can ever reach it.
     *
     * @return array{id: int, is_new: bool}
     */
    public static function upsertAgent(string $sub, string $email, string $displayName, ?string $avatarUrl): array
    {
        return Database::transaction(static function () use ($sub, $email, $displayName, $avatarUrl): array {
            $pdo = Database::pdo();
            $select = $pdo->prepare('SELECT id FROM users WHERE google_sub = :sub FOR UPDATE');
            $select->execute(['sub' => $sub]);
            $existingId = $select->fetchColumn();
            $values = ['email' => $email, 'name' => $displayName, 'display_name' => $displayName, 'avatar' => $avatarUrl];
            if ($existingId !== false) {
                $pdo->prepare(
                    'UPDATE users SET email = :email, name = :name, display_name = :display_name, avatar_url = :avatar WHERE id = :id'
                )->execute($values + ['id' => $existingId]);
                return ['id' => (int) $existingId, 'is_new' => false];
            }
            $pdo->prepare(
                "INSERT INTO users (google_sub, email, name, display_name, avatar_url, role)
                 VALUES (:sub, :email, :name, :display_name, :avatar, 'contributor')"
            )->execute($values + ['sub' => $sub]);
            return ['id' => (int) $pdo->lastInsertId(), 'is_new' => true];
        });
    }

    /**
     * The user object from API section 3. Email and google_sub never appear here.
     *
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    public static function publicUser(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'display_name' => $row['display_name'],
            'avatar_url' => $row['avatar_url'],
            'role' => $row['role'],
            'created_at' => Time::iso($row['created_at']),
        ];
    }
}
