<?php

declare(strict_types=1);

/** Who may do what, and the checks every endpoint shares, in one place. */
final class Policy
{
    public const GUEST = 'guest';
    public const TRAVELER = 'traveler';
    public const CONTRIBUTOR = 'contributor';
    public const ADMINISTRATOR = 'administrator';

    private const RANK = [self::GUEST => 0, self::TRAVELER => 1, self::CONTRIBUTOR => 2, self::ADMINISTRATOR => 3];

    /**
     * Runs one action of an endpoint file: method, session, role, CSRF, rate limit, then the handler.
     * Each route is ['method' => 'GET', 'role' => Policy::GUEST, 'limit' => 'default', 'handler' => callable].
     * The handler receives the signed-in user (or null) and returns the response data.
     *
     * session: false for public reads that need no session. writes_session: true for routes that change it
     * (sign in, sign out, a new CSRF token); every other route releases the session lock before its handler.
     *
     * @param array<string, array{method: string, role: string, handler: callable, limit?: string, csrf_in_body?: bool, session?: bool, writes_session?: bool}> $routes
     */
    public static function dispatch(array $routes): never
    {
        try {
            $route = $routes[Request::query('action') ?? ''] ?? throw new ApiError('BAD_REQUEST');
            if (Request::method() !== $route['method']) {
                throw new ApiError('METHOD_NOT_ALLOWED', ['allowed' => [$route['method']]]);
            }
            // Public reads never open a session: no cookie for new visitors, nothing personal in a cacheable answer.
            $user = null;
            if ($route['session'] ?? true) {
                Session::start();
                $user = Auth::current();
            }
            self::requireRole($route['role'], $user);
            if ($route['method'] === 'POST') {
                // navigator.sendBeacon cannot set headers; the routes that allow it take the token from the body.
                $bodyToken = ($route['csrf_in_body'] ?? false) ? (Request::json()['csrf'] ?? null) : null;
                Csrf::verify(Request::header('X-CSRF-Token') ?? (is_string($bodyToken) ? $bodyToken : null));
            }
            $group = $route['limit'] ?? 'default';
            RateLimitService::hit($group, self::rateActor($group, $user));
            // PHP holds the session file lock until it is closed, which would queue this user's other requests.
            if (!($route['writes_session'] ?? false)) {
                Session::close();
            }
            Response::ok($route['handler']($user));
        } catch (ApiError $error) {
            Response::error($error);
        } catch (Throwable $error) {
            $requestId = bin2hex(random_bytes(8));
            Logger::error("[{$requestId}] {$error->getMessage()} at {$error->getFile()}:{$error->getLine()}");
            Response::error(new ApiError('SERVER_ERROR', ['request_id' => $requestId]));
        }
    }

    /**
     * Gate for an admin page shell. Anyone without the role goes back to the tracker.
     *
     * @return array<string, mixed> The signed-in user
     */
    public static function requirePage(string $role): array
    {
        Session::start();
        try {
            $user = Auth::current();
            self::requireRole($role, $user);
            return $user;
        } catch (ApiError) {
            header('Location: ' . Config::get('app.base_path'), true, 303);
            exit;
        }
    }

    /** @param array<string, mixed> $user */
    public static function isAdministrator(array $user): bool
    {
        return $user['role'] === self::ADMINISTRATOR;
    }

    /**
     * The writer agent account (Decisions Log 62): no sign-in, no points, a fixed title, never deleted or re-roled.
     *
     * @param array<string, mixed> $user
     */
    public static function isAgent(array $user): bool
    {
        return self::isAgentId((int) $user['id']);
    }

    public static function isAgentId(?int $userId): bool
    {
        $agentId = Config::get('agent.user_id');
        return $userId !== null && $agentId !== null && $userId === (int) $agentId;
    }

    /** @param array<string, mixed>|null $user */
    private static function requireRole(string $role, ?array $user): void
    {
        if ($role === self::GUEST) {
            return;
        }
        if ($user === null) {
            throw new ApiError('UNAUTHENTICATED');
        }
        if (self::RANK[$user['role']] < self::RANK[$role]) {
            throw new ApiError('FORBIDDEN');
        }
    }

    /** @param array<string, mixed>|null $user */
    private static function rateActor(string $group, ?array $user): string
    {
        return $user !== null && $group !== 'login' ? 'user:' . $user['id'] : 'ip:' . Request::ip();
    }
}
