<?php

declare(strict_types=1);

require dirname(__DIR__) . '/includes/bootstrap.php';

Policy::dispatch([
    'image' => [
        'method' => 'POST',
        'role' => Policy::CONTRIBUTOR,
        'limit' => 'upload',
        'handler' => static function (array $user): never {
            $tutorialId = (string) ($_POST['tutorial_id'] ?? '');
            if (!ctype_digit($tutorialId) || (int) $tutorialId < 1) {
                throw new ApiError('BAD_REQUEST');
            }
            $file = is_array($_FILES['file'] ?? null) ? $_FILES['file'] : null;
            Response::raw(['location' => UploadService::storeImage((int) $tutorialId, (int) $user['id'], $file)]);
        },
    ],
]);
