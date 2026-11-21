<?php

declare(strict_types=1);

// Copy to config.local.php. Keys here override includes/config.php.
return [
    'app.base_path' => '/genshinachievements/',

    'db.name' => 'genshinachievements_db',
    'db.user' => 'root',
    'db.pass' => '',

    'auth.google_client_id' => '',
    'auth.bootstrap_admin_emails' => [],

    // Printed by: php includes/cli/create-agent.php
    'agent.user_id' => null,
];
