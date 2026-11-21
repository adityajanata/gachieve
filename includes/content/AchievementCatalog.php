<?php

declare(strict_types=1);

/** The only server code that reads data/*.json. Cached in memory per request. */
final class AchievementCatalog
{
    public const LANGS = ['id', 'en'];

    /** @var array<string, list<array<string, mixed>>> */
    private static array $items = [];

    /** @var array<int, array{ids: list<int>, index: int}>|null */
    private static ?array $stages = null;

    /** @var array<int, array{id: string, en: string}>|null */
    private static ?array $names = null;

    /** @return list<array<string, mixed>> */
    public static function items(string $lang): array
    {
        if (!in_array($lang, self::LANGS, true)) {
            throw new InvalidArgumentException("Unknown language: {$lang}");
        }
        if (!isset(self::$items[$lang])) {
            $file = dirname(__DIR__, 2) . "/data/achievements.{$lang}.json";
            self::$items[$lang] = json_decode((string) file_get_contents($file), true, 32, JSON_THROW_ON_ERROR);
        }
        return self::$items[$lang];
    }

    /** @return array<int, array{ids: list<int>, index: int}> */
    private static function stages(): array
    {
        if (self::$stages === null) {
            self::$stages = [];
            foreach (self::items('id') as $item) {
                foreach ($item['id'] as $index => $stageId) {
                    self::$stages[$stageId] = ['ids' => $item['id'], 'index' => $index];
                }
            }
        }
        return self::$stages;
    }

    /**
     * Every achievement in data order: its key (first stage id) and its name in both languages.
     *
     * @return array<int, array{id: string, en: string}>
     */
    public static function names(): array
    {
        if (self::$names === null) {
            self::$names = [];
            foreach (self::LANGS as $lang) {
                foreach (self::items($lang) as $item) {
                    self::$names[$item['id'][0]][$lang] = $item['name'];
                }
            }
        }
        return self::$names;
    }

    public static function hasAchievement(int $achievementId): bool
    {
        return isset(self::names()[$achievementId]);
    }

    public static function hasStage(int $stageId): bool
    {
        return isset(self::stages()[$stageId]);
    }

    /**
     * That stage and every earlier stage of the same achievement.
     *
     * @return list<int>
     */
    public static function stageWithEarlier(int $stageId): array
    {
        $stage = self::stages()[$stageId];
        return array_slice($stage['ids'], 0, $stage['index'] + 1);
    }

    /**
     * That stage and every later stage of the same achievement.
     *
     * @return list<int>
     */
    public static function stageWithLater(int $stageId): array
    {
        $stage = self::stages()[$stageId];
        return array_slice($stage['ids'], $stage['index']);
    }

    /**
     * Every stage of the achievement this stage belongs to, in order.
     *
     * @return list<int>
     */
    public static function allStagesOf(int $stageId): array
    {
        return self::stages()[$stageId]['ids'];
    }

    /**
     * Known ids with their earlier stages added. Unknown ids are left out.
     *
     * @param list<int> $stageIds
     * @return list<int>
     */
    public static function expandCascade(array $stageIds): array
    {
        $expanded = [];
        foreach ($stageIds as $stageId) {
            if (self::hasStage($stageId)) {
                foreach (self::stageWithEarlier($stageId) as $id) {
                    $expanded[$id] = true;
                }
            }
        }
        return array_keys($expanded);
    }
}
