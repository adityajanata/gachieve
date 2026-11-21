<?php

declare(strict_types=1);

/** Trail of Administrator actions. actor_name is a snapshot, so entries survive account deletion. */
final class AuditService
{
    /**
     * @param array<string, mixed> $actor
     * @param array<string, mixed>|null $detail
     */
    public static function record(array $actor, string $action, ?string $targetType, ?int $targetId, ?array $detail = null): void
    {
        Database::pdo()->prepare(
            'INSERT INTO admin_audit_log (actor_id, actor_name, action, target_type, target_id, detail)
             VALUES (:actor, :name, :action, :type, :target, :detail)'
        )->execute([
            'actor' => $actor['id'],
            'name' => $actor['display_name'],
            'action' => $action,
            'type' => $targetType,
            'target' => $targetId,
            'detail' => $detail === null ? null : json_encode($detail, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
        ]);
    }

    /** @return array{items: list<array<string, mixed>>, total: int} */
    public static function list(string $action, ?int $actorId, int $page, int $perPage): array
    {
        $where = [];
        $params = [];
        if ($action !== '') {
            $where[] = 'action = :action';
            $params['action'] = $action;
        }
        if ($actorId !== null) {
            $where[] = 'actor_id = :actor';
            $params['actor'] = $actorId;
        }
        $clause = $where === [] ? '' : ' WHERE ' . implode(' AND ', $where);
        $pdo = Database::pdo();

        $count = $pdo->prepare("SELECT COUNT(*) FROM admin_audit_log{$clause}");
        $count->execute($params);

        $statement = $pdo->prepare(
            "SELECT actor_name, action, target_type, target_id, detail, created_at FROM admin_audit_log{$clause}
             ORDER BY id DESC LIMIT :limit OFFSET :offset"
        );
        foreach ($params as $name => $value) {
            $statement->bindValue($name, $value);
        }
        $statement->bindValue('limit', $perPage, PDO::PARAM_INT);
        $statement->bindValue('offset', ($page - 1) * $perPage, PDO::PARAM_INT);
        $statement->execute();

        return [
            'items' => array_map(static fn (array $row): array => [
                'actor_name' => $row['actor_name'],
                'action' => $row['action'],
                'target_type' => $row['target_type'],
                'target_id' => $row['target_id'] === null ? null : (int) $row['target_id'],
                'detail' => $row['detail'] === null ? null : json_decode((string) $row['detail'], true, 16, JSON_THROW_ON_ERROR),
                'created_at' => Time::iso($row['created_at']),
            ], $statement->fetchAll()),
            'total' => (int) $count->fetchColumn(),
        ];
    }
}
