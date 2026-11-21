<?php

declare(strict_types=1);

/** Only the provider and video id are stored; embed URLs are built here from an allowlist (PRD 8). */
final class VideoEmbed
{
    private const YOUTUBE = 'youtube';

    private const YOUTUBE_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'www.youtube-nocookie.com'];

    private const YOUTUBE_ID = '/^[A-Za-z0-9_-]{11}$/';

    private const YOUTUBE_PATHS = '~^/(?:embed|shorts|live|v)/([^/]+)~';

    /** @return array{provider: string, video_id: string}|null Null when the link is not a supported video. */
    public static function parse(string $url): ?array
    {
        $parts = parse_url(trim($url));
        if ($parts === false || !in_array(strtolower($parts['scheme'] ?? ''), ['http', 'https'], true)) {
            return null;
        }
        $host = strtolower($parts['host'] ?? '');
        $path = $parts['path'] ?? '';
        $id = null;
        if ($host === 'youtu.be') {
            $id = explode('/', ltrim($path, '/'))[0];
        } elseif (in_array($host, self::YOUTUBE_HOSTS, true)) {
            if ($path === '/watch') {
                parse_str($parts['query'] ?? '', $query);
                $id = is_string($query['v'] ?? null) ? $query['v'] : null;
            } elseif (preg_match(self::YOUTUBE_PATHS, $path, $match) === 1) {
                $id = $match[1];
            }
        }
        return $id !== null && preg_match(self::YOUTUBE_ID, $id) === 1
            ? ['provider' => self::YOUTUBE, 'video_id' => $id]
            : null;
    }

    /** @return array{provider: string, video_id: string, embed_url: string}|null */
    public static function toApi(?string $provider, ?string $videoId): ?array
    {
        if ($provider !== self::YOUTUBE || $videoId === null || preg_match(self::YOUTUBE_ID, $videoId) !== 1) {
            return null;
        }
        return [
            'provider' => $provider,
            'video_id' => $videoId,
            'embed_url' => "https://www.youtube-nocookie.com/embed/{$videoId}",
        ];
    }
}
