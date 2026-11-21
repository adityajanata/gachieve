<?php

declare(strict_types=1);

require dirname(__DIR__) . '/includes/bootstrap.php';

$adminUser = Policy::requirePage(Policy::CONTRIBUTOR);

$achievementId = ctype_digit((string) ($_GET['achievement_id'] ?? '')) ? (int) $_GET['achievement_id'] : 0;
if (!AchievementCatalog::hasAchievement($achievementId)) {
    header('Location: ' . Config::get('app.base_path') . 'studio/tutorials.php', true, 303);
    exit;
}
$names = AchievementCatalog::names()[$achievementId];

$adminPage = 'editor';
$adminScript = 'editor';
$adminTinymce = true;
$adminData = [
    'achievement-id' => $achievementId,
    'name-id' => $names['id'],
    'name-en' => $names['en'],
    'autosave-seconds' => (int) Config::get('editor.autosave_seconds'),
];

require dirname(__DIR__) . '/includes/views/studio-page.php';
