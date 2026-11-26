<?php

declare(strict_types=1);

// Served as /sitemap.xml through .htaccess. Public pages: the tracker and the privacy policy.
require __DIR__ . '/includes/bootstrap.php';

$appUrl = (string) Config::get('app.url');
if ($appUrl === '') {
    http_response_code(404);
    exit;
}

// The page changes when the achievement data is refreshed.
$lastModified = max(
    (int) filemtime(__DIR__ . '/data/achievements.id.json'),
    (int) filemtime(__DIR__ . '/data/achievements.en.json'),
);

header('Content-Type: application/xml; charset=utf-8');

echo '<?xml version="1.0" encoding="UTF-8"?>', "\n";
?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc><?= htmlspecialchars($appUrl, ENT_XML1 | ENT_QUOTES, 'UTF-8') ?></loc>
        <lastmod><?= gmdate('Y-m-d', $lastModified) ?></lastmod>
    </url>
    <url>
        <loc><?= htmlspecialchars($appUrl . 'privacy.php', ENT_QUOTES | ENT_XML1, 'UTF-8') ?></loc>
        <lastmod><?= gmdate('Y-m-d', (int) filemtime(__DIR__ . '/privacy.php')) ?></lastmod>
    </url>
</urlset>
