<?php

declare(strict_types=1);

// Submits one tutorial for review as the writer agent (Decisions Log 62). Reads JSON from stdin:
//   { "achievement_id": 80127, "content_input": { "id": { "body_html": "...", "video_url": "..." | null } | null, "en": { ... } | null } }
// content_input has the same shape as the body of editor.php?action=save (API 4.2).
// Locally: php includes/cli/agent-submit.php < draft.json. On the VPS it runs as the forced command of the agent's SSH key.
// Prints one JSON line. Exit code 0 on success, 1 when the tutorial was not submitted, 2 when the setup is wrong.

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require dirname(__DIR__) . '/bootstrap.php';

/** @param array<string, mixed> $data */
function finish(int $code, array $data): never
{
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n";
    exit($code);
}

$agentId = Config::get('agent.user_id');
$agent = $agentId === null ? null : UserService::findById((int) $agentId);
if ($agent === null) {
    finish(2, ['ok' => false, 'error' => 'SETUP', 'message' => 'agent.user_id is not set or the account does not exist. Run includes/cli/create-agent.php.']);
}
if ((int) $agent['is_active'] !== 1) {
    finish(1, ['ok' => false, 'error' => 'ACCOUNT_DISABLED', 'message' => 'The agent account is disabled in the Studio.']);
}

$input = json_decode((string) stream_get_contents(STDIN), true);
$achievementId = is_array($input) && is_int($input['achievement_id'] ?? null) ? $input['achievement_id'] : null;
if ($achievementId === null || !array_key_exists('content_input', $input)) {
    finish(1, ['ok' => false, 'error' => 'BAD_REQUEST', 'message' => 'Expected JSON with an integer achievement_id and content_input.']);
}

$tutorialId = null;
try {
    // Never takes over: someone else's lock or open version stops the run (LOCK_HELD, OPEN_VERSION_EXISTS).
    $opened = TutorialService::open($achievementId, $agent, false);
    $tutorialId = (int) $opened['tutorial_id'];
    TutorialService::save($tutorialId, $agent, $input['content_input'], false);
    $submitted = TutorialService::submit($tutorialId, $agent);
    finish(0, ['ok' => true, 'achievement_id' => $achievementId] + $submitted);
} catch (ApiError $error) {
    // Submit clears the lock itself; after a failed save the lock must not wait for its timeout.
    if ($tutorialId !== null) {
        LockService::release($tutorialId, (int) $agent['id']);
    }
    finish(1, ['ok' => false, 'error' => $error->errorCode, 'message' => $error->getMessage(), 'details' => $error->details]);
}
