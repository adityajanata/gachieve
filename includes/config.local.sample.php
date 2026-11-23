<?php

declare(strict_types=1);

// Copy to config.local.php. Keys here override includes/config.php.
return [
    'app.base_path' => '/genshinachievements/',
    // Public URL for canonical, Open Graph and the sitemap. Production: https://yourdomain/
    'app.url' => 'http://localhost/genshinachievements/',

    // Ubuntu PHP reports 8.3.6 even with the php2shell patch. Set true only after
    // `apt changelog php8.3-cli | grep CVE-2026-109618` shows the patch.
    'php.vendor_patched' => false,

    'db.name' => 'genshinachievements_db',
    'db.user' => 'root',
    'db.pass' => '',

    'auth.google_client_id' => '',
    'auth.bootstrap_admin_emails' => [],

    // Printed by: php includes/cli/create-agent.php
    'agent.user_id' => null,
];
