<?php

declare(strict_types=1);

/** One of the error codes from API section 2. Messages are English and generic. */
final class ApiError extends RuntimeException
{
    private const CODES = [
        'BAD_REQUEST' => [400, 'The request could not be understood.'],
        'UNAUTHENTICATED' => [401, 'Please sign in.'],
        'CSRF_INVALID' => [403, 'Your session token is out of date.'],
        'FORBIDDEN' => [403, 'You do not have access to this.'],
        'ACCOUNT_DISABLED' => [403, 'This account has been disabled.'],
        'NOT_FOUND' => [404, 'Not found.'],
        'METHOD_NOT_ALLOWED' => [405, 'This method is not allowed.'],
        'LOCK_HELD' => [409, 'This tutorial is being edited by someone else.'],
        'LOCK_LOST' => [409, 'Your edit lock expired.'],
        'OPEN_VERSION_EXISTS' => [409, 'Another user already has an open version of this tutorial.'],
        'INVALID_STATE' => [409, 'This action is no longer possible.'],
        'PAYLOAD_TOO_LARGE' => [413, 'The request is too large.'],
        'UNSUPPORTED_MEDIA' => [415, 'Only JPEG, PNG, WebP and GIF images are accepted.'],
        'VALIDATION_FAILED' => [422, 'Please check the values you entered.'],
        'TOO_MANY_ITEMS' => [422, 'Too many items in one action.'],
        'RATE_LIMITED' => [429, 'Too many requests. Please wait a moment.'],
        'SERVER_ERROR' => [500, 'Something went wrong. Please try again.'],
    ];

    /** @param array<string, mixed> $details */
    public function __construct(
        public readonly string $errorCode,
        public readonly array $details = [],
        ?string $message = null,
    ) {
        parent::__construct($message ?? self::CODES[$errorCode][1]);
    }

    public function status(): int
    {
        return self::CODES[$this->errorCode][0];
    }

    /** @param array<string, mixed> $fields */
    public static function validation(array $fields): self
    {
        return new self('VALIDATION_FAILED', ['fields' => $fields]);
    }
}
