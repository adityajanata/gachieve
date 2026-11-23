<?php

declare(strict_types=1);

// Served as /robots.txt through .htaccess. Search engines read it only at the domain root.
require __DIR__ . '/includes/bootstrap.php';

$basePath = (string) Config::get('app.base_path');
$appUrl = (string) Config::get('app.url');

header('Content-Type: text/plain; charset=utf-8');

// Studio pages redirect Guests anyway; this keeps crawlers from trying.
// api/ and data/ stay crawlable because the tracker needs them to render; .htaccess marks them noindex.
echo "User-agent: *\n";
echo "Disallow: {$basePath}studio/\n";
if ($appUrl !== '') {
    echo "\nSitemap: {$appUrl}sitemap.xml\n";
}
