<?php

declare(strict_types=1);

// Defaults only. Secrets and machine-specific values go in config.local.php.
return [
    'app.name' => 'Genshin Achievements',
    'app.base_path' => '/',

    'db.host' => '127.0.0.1',
    'db.port' => 3306,
    'db.name' => '',
    'db.user' => '',
    'db.pass' => '',

    'auth.google_client_id' => '',
    'auth.bootstrap_admin_emails' => [],
    'session.lifetime_seconds' => 2592000,

    // [maximum hits, window in seconds] per group (API 6.1).
    'rate_limit.login' => [10, 600],
    'rate_limit.progress' => [120, 60],
    'rate_limit.bulk' => [10, 600],
    'rate_limit.editor' => [60, 60],
    'rate_limit.upload' => [30, 600],
    'rate_limit.review' => [30, 5],
    'rate_limit.default' => [300, 60],

    'lock.timeout_seconds' => 600,
    'lock.warn_before_seconds' => 120,
    'lock.heartbeat_seconds' => 60,
    'editor.autosave_seconds' => 30,
    'bulk.max_items' => 2000,
    'uploads.max_bytes' => 2097152,

    // The writer agent account (Decisions Log 62). Its id comes from includes/cli/create-agent.php, per server.
    'agent.user_id' => null,
    'agent.badge_title' => 'Journalist',
];
