<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require dirname(__DIR__) . '/bootstrap.php';

$problems = [];
$stageIdsByLang = [];
$keysByLang = [];

foreach (AchievementCatalog::LANGS as $lang) {
    $seen = [];
    foreach (AchievementCatalog::items($lang) as $position => $item) {
        $label = "{$lang}[{$position}]";
        $ids = $item['id'] ?? null;
        if (!is_array($ids) || $ids === []) {
            $problems[] = "{$label}: id must be a non-empty array";
            continue;
        }
        $label .= ' id ' . $ids[0];
        $keysByLang[$lang][$ids[0]] = $ids;

        foreach ($ids as $id) {
            if (isset($seen[$id])) {
                $problems[] = "{$label}: duplicate stage id {$id}";
            }
            $seen[$id] = true;
        }

        $stageKeys = array_filter(array_keys($item), static fn (string $k): bool => (bool) preg_match('/^stage\d+$/', $k));
        $stages = $item['stages'] ?? null;
        if ($stages !== count($stageKeys)) {
            $problems[] = "{$label}: stages is " . var_export($stages, true) . ' but found ' . count($stageKeys) . ' stageN keys';
        }
        if ($stages !== count($ids)) {
            $problems[] = "{$label}: stages is " . var_export($stages, true) . ' but id holds ' . count($ids);
        }
    }
    $stageIdsByLang[$lang] = $seen;
}

$diff = static fn (array $a, array $b): array => array_keys(array_diff_key($a, $b));
foreach ($diff($stageIdsByLang['id'], $stageIdsByLang['en']) as $id) {
    $problems[] = "stage id {$id} is in id but not in en";
}
foreach ($diff($stageIdsByLang['en'], $stageIdsByLang['id']) as $id) {
    $problems[] = "stage id {$id} is in en but not in id";
}

// Progress and tutorials rely on id[0] and the stage order, so both must match per achievement.
foreach ($keysByLang['id'] as $key => $ids) {
    if (($keysByLang['en'][$key] ?? null) !== $ids) {
        $problems[] = "achievement {$key}: stage ids differ between id and en";
    }
}

if ($problems !== []) {
    fwrite(STDERR, implode(PHP_EOL, $problems) . PHP_EOL);
    fwrite(STDERR, count($problems) . ' problem(s) found.' . PHP_EOL);
    exit(1);
}

printf(
    "OK: %d achievements, %d stage ids, same ids in both files.%s",
    count($keysByLang['id']),
    count($stageIdsByLang['id']),
    PHP_EOL
);
