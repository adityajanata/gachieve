<?php

declare(strict_types=1);

final class Logger
{
    public static function error(string $message): void
    {
        $dir = dirname(__DIR__, 2) . '/storage/logs';
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }
        $line = gmdate('Y-m-d\TH:i:s\Z') . ' ERROR ' . $message . PHP_EOL;
        file_put_contents($dir . '/app.log', $line, FILE_APPEND | LOCK_EX);
    }
}
