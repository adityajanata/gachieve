<?php

declare(strict_types=1);

/** Tutorial images in uploads/YYYY/MM/DD/ (PRD 8, API 4.4). version_id is provenance only and never decides deletion. */
final class UploadService
{
    private const EXTENSIONS = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'];

    private const CLEANUP_GRACE_HOURS = 24;

    /** Matches an image reference inside stored tutorial HTML. */
    private const REFERENCE = '~uploads/(\d{4}/\d{2}/\d{2}/[a-z0-9]+\.[a-z]+)~';

    private static function root(): string
    {
        return dirname(__DIR__, 2) . '/uploads/';
    }

    /**
     * @param array<string, mixed>|null $file One entry of $_FILES
     * @return string The public location TinyMCE inserts
     */
    public static function storeImage(int $tutorialId, int $userId, ?array $file): string
    {
        $maxBytes = (int) Config::get('uploads.max_bytes');
        self::assertUploaded($file, $maxBytes);
        $mime = (string) (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
        if (!isset(self::EXTENSIONS[$mime])) {
            throw new ApiError('UNSUPPORTED_MEDIA', ['allowed' => array_keys(self::EXTENSIONS)]);
        }

        return Database::transaction(static function () use ($tutorialId, $userId, $file, $mime): string {
            LockService::assertHeld(LockService::row($tutorialId), $userId);

            $pdo = Database::pdo();
            $open = $pdo->prepare('SELECT id FROM tutorial_versions WHERE open_tutorial_id = :tutorial');
            $open->execute(['tutorial' => $tutorialId]);
            $versionId = $open->fetchColumn();

            $folder = gmdate('Y/m/d');
            $path = $folder . '/' . bin2hex(random_bytes(16)) . '.' . self::EXTENSIONS[$mime];
            if (!is_dir(self::root() . $folder)) {
                mkdir(self::root() . $folder, 0755, true);
            }
            $pdo->prepare(
                'INSERT INTO uploads (path, mime, size_bytes, uploaded_by, version_id) VALUES (:path, :mime, :size, :user, :version)'
            )->execute([
                'path' => $path,
                'mime' => $mime,
                'size' => (int) $file['size'],
                'user' => $userId,
                'version' => $versionId === false ? null : $versionId,
            ]);
            if (!move_uploaded_file($file['tmp_name'], self::root() . $path)) {
                throw new RuntimeException('Could not store an uploaded image.');
            }
            return Config::get('app.base_path') . 'uploads/' . $path;
        });
    }

    /** @param array<string, mixed>|null $file */
    private static function assertUploaded(?array $file, int $maxBytes): void
    {
        if ($file === null || !is_int($file['error'] ?? null) || $file['error'] === UPLOAD_ERR_NO_FILE) {
            throw new ApiError('BAD_REQUEST');
        }
        $tooLarge = in_array($file['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true) || (int) $file['size'] > $maxBytes;
        if ($tooLarge) {
            throw new ApiError('PAYLOAD_TOO_LARGE', ['limit_bytes' => $maxBytes]);
        }
        if ($file['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'])) {
            throw new RuntimeException('Image upload failed with code ' . $file['error']);
        }
    }

    /**
     * Files no version references and that are past the grace period for unsaved drafts.
     *
     * @return array{scanned: int, unused: list<string>, deleted_count: int, freed_bytes: int}
     */
    public static function cleanup(bool $dryRun): array
    {
        $pdo = Database::pdo();
        $referenced = [];
        foreach ($pdo->query('SELECT body_html FROM tutorial_translations WHERE body_html IS NOT NULL')->fetchAll(PDO::FETCH_COLUMN) as $html) {
            if (preg_match_all(self::REFERENCE, (string) $html, $matches) > 0) {
                $referenced += array_flip($matches[1]);
            }
        }

        $statement = $pdo->prepare(
            'SELECT id, path, size_bytes, created_at < UTC_TIMESTAMP() - INTERVAL :hours HOUR AS is_old FROM uploads ORDER BY id'
        );
        $statement->execute(['hours' => self::CLEANUP_GRACE_HOURS]);
        $rows = $statement->fetchAll();

        $unused = array_values(array_filter(
            $rows,
            static fn (array $row): bool => (int) $row['is_old'] === 1 && !isset($referenced[$row['path']]),
        ));
        $deleted = 0;
        $freed = 0;
        if (!$dryRun) {
            $delete = $pdo->prepare('DELETE FROM uploads WHERE id = :id');
            foreach ($unused as $row) {
                $file = self::root() . $row['path'];
                if (is_file($file)) {
                    unlink($file);
                    $freed += (int) $row['size_bytes'];
                }
                $delete->execute(['id' => $row['id']]);
                $deleted++;
            }
        }
        return [
            'scanned' => count($rows),
            'unused' => array_column($unused, 'path'),
            'deleted_count' => $deleted,
            'freed_bytes' => $freed,
        ];
    }
}
