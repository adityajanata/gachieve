<?php

declare(strict_types=1);

final class Config
{
    /** @var array<string, mixed> */
    private static array $values = [];

    public static function load(string $defaultsFile, string $localFile): void
    {
        $values = require $defaultsFile;
        if (is_file($localFile)) {
            $values = array_merge($values, require $localFile);
        }
        self::$values = $values;
    }

    public static function get(string $key): mixed
    {
        if (!array_key_exists($key, self::$values)) {
            throw new RuntimeException("Unknown config key: {$key}");
        }
        return self::$values[$key];
    }
}
