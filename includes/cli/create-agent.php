<?php

declare(strict_types=1);

// Creates the writer agent account Charlotte, or refreshes its name, email and picture (Decisions Log 62).
// Run once per server: php includes/cli/create-agent.php, then put the printed id in config.local.php as agent.user_id.

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require dirname(__DIR__) . '/bootstrap.php';

const AGENT_SUB = 'agent:charlotte';
const AGENT_NAME = 'Charlotte';
const AGENT_EMAIL = 'charlotte@steambird.invalid';
const AGENT_AVATAR = 'assets/img/charlotte.webp';

$root = dirname(__DIR__, 2);
$avatar = is_file($root . '/' . AGENT_AVATAR) ? AGENT_AVATAR : null;
if ($avatar === null) {
    fwrite(STDERR, 'Note: ' . AGENT_AVATAR . " is missing, so the account has no picture yet. Add the file and run this again.\n");
}

$result = UserService::upsertAgent(AGENT_SUB, AGENT_EMAIL, AGENT_NAME, $avatar);
echo ($result['is_new'] ? 'Created' : 'Updated') . ' ' . AGENT_NAME . " with user id {$result['id']}.\n";

$configured = Config::get('agent.user_id');
if ($configured === null || (int) $configured !== $result['id']) {
    echo "Set 'agent.user_id' => {$result['id']} in includes/config.local.php.\n";
}
