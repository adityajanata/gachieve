<?php

declare(strict_types=1);

/** Verifies a Google ID token: RS256 signature against Google's published keys, audience, issuer and expiry. */
final class GoogleTokenVerifier
{
    private const CERTS_URL = 'https://www.googleapis.com/oauth2/v1/certs';
    private const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
    private const CLOCK_SKEW_SECONDS = 60;
    private const DEFAULT_CACHE_SECONDS = 3600;

    /** @return array{sub: string, email: string, name: string, picture: ?string} */
    public static function verify(string $credential): array
    {
        $parts = explode('.', $credential);
        if (count($parts) !== 3) {
            throw self::invalid();
        }
        $header = self::decodeSegment($parts[0]);
        $claims = self::decodeSegment($parts[1]);
        $signature = self::base64UrlDecode($parts[2]);

        if (($header['alg'] ?? null) !== 'RS256' || !is_string($header['kid'] ?? null) || $signature === null) {
            throw self::invalid();
        }
        $certificate = self::certificate($header['kid']);
        if ($certificate === null || openssl_verify($parts[0] . '.' . $parts[1], $signature, $certificate, OPENSSL_ALGO_SHA256) !== 1) {
            throw self::invalid();
        }

        $now = time();
        $clientId = (string) Config::get('auth.google_client_id');
        $valid = $clientId !== ''
            && ($claims['aud'] ?? null) === $clientId
            && in_array($claims['iss'] ?? null, self::ISSUERS, true)
            && is_int($claims['exp'] ?? null) && $claims['exp'] + self::CLOCK_SKEW_SECONDS > $now
            && is_string($claims['sub'] ?? null) && $claims['sub'] !== ''
            && is_string($claims['email'] ?? null) && $claims['email'] !== ''
            && ($claims['email_verified'] ?? false) === true;
        if (!$valid) {
            throw self::invalid();
        }

        return [
            'sub' => $claims['sub'],
            'email' => $claims['email'],
            'name' => is_string($claims['name'] ?? null) && $claims['name'] !== '' ? $claims['name'] : $claims['email'],
            'picture' => is_string($claims['picture'] ?? null) ? $claims['picture'] : null,
        ];
    }

    private static function invalid(): ApiError
    {
        return ApiError::validation(['credential' => 'The Google sign-in could not be verified.']);
    }

    /** @return array<string, mixed> */
    private static function decodeSegment(string $segment): array
    {
        $json = self::base64UrlDecode($segment);
        $decoded = $json === null ? null : json_decode($json, true, 8);
        if (!is_array($decoded)) {
            throw self::invalid();
        }
        return $decoded;
    }

    private static function base64UrlDecode(string $value): ?string
    {
        $decoded = base64_decode(strtr($value, '-_', '+/'), true);
        return $decoded === false ? null : $decoded;
    }

    private static function certificate(string $keyId): ?string
    {
        $certs = self::readCache();
        if (!isset($certs[$keyId])) {
            $certs = self::fetchCerts(); // Google rotates its keys, so an unknown id means the cache is old.
        }
        return is_string($certs[$keyId] ?? null) ? $certs[$keyId] : null;
    }

    private static function cacheFile(): string
    {
        return dirname(__DIR__, 2) . '/storage/cache/google-certs.json';
    }

    /** @return array<string, mixed> */
    private static function readCache(): array
    {
        $file = self::cacheFile();
        if (!is_file($file)) {
            return [];
        }
        $cache = json_decode((string) file_get_contents($file), true, 4);
        return is_array($cache) && ($cache['expires_at'] ?? 0) > time() ? (array) $cache['certs'] : [];
    }

    /** @return array<string, mixed> */
    private static function fetchCerts(): array
    {
        $handle = curl_init(self::CERTS_URL);
        $maxAge = self::DEFAULT_CACHE_SECONDS;
        curl_setopt_array($handle, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_HEADERFUNCTION => static function ($curl, string $line) use (&$maxAge): int {
                if (preg_match('/^cache-control:.*max-age=(\d+)/i', $line, $match) === 1) {
                    $maxAge = (int) $match[1];
                }
                return strlen($line);
            },
        ]);
        $body = curl_exec($handle);
        $status = curl_getinfo($handle, CURLINFO_HTTP_CODE);
        if (!is_string($body) || $status !== 200) {
            throw new RuntimeException('Could not fetch Google certificates: ' . curl_error($handle));
        }
        $certs = json_decode($body, true, 4, JSON_THROW_ON_ERROR);

        $file = self::cacheFile();
        if (!is_dir(dirname($file))) {
            mkdir(dirname($file), 0775, true);
        }
        file_put_contents($file, json_encode(['expires_at' => time() + $maxAge, 'certs' => $certs], JSON_THROW_ON_ERROR), LOCK_EX);
        return $certs;
    }
}
