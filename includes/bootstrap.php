<?php

declare(strict_types=1);

// 8.3.36 patches php2shell (PRD Decisions Log 36). Refuse to run on anything older.
if (version_compare(PHP_VERSION, '8.3.36', '<')) {
    http_response_code(500);
    exit('PHP 8.3.36 or newer is required.');
}

spl_autoload_register(static function (string $class): void {
    foreach (['core', 'auth', 'services', 'content'] as $folder) {
        $file = __DIR__ . "/{$folder}/{$class}.php";
        if (is_file($file)) {
            require $file;
            return;
        }
    }
});

ini_set('display_errors', '0');
error_reporting(E_ALL);

// Warnings become exceptions, so they land in storage/logs/app.log with everything else.
set_error_handler(static function (int $severity, string $message, string $file, int $line): bool {
    if ((error_reporting() & $severity) === 0) {
        return false;
    }
    throw new ErrorException($message, 0, $severity, $file, $line);
});

set_exception_handler(static function (Throwable $e): void {
    Logger::error($e->getMessage() . ' at ' . $e->getFile() . ':' . $e->getLine());
    if (PHP_SAPI === 'cli') {
        fwrite(STDERR, $e->getMessage() . PHP_EOL);
        exit(1);
    }
    http_response_code(500);
    echo 'Something went wrong.';
});

Config::load(__DIR__ . '/config.php', __DIR__ . '/config.local.php');
