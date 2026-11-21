<?php

declare(strict_types=1);

/** Type, length and range checks for API input. Every failure is VALIDATION_FAILED, or BAD_REQUEST when a field is missing. */
final class Validator
{
    /** @param array<string, mixed> $body */
    private static function required(array $body, string $field): mixed
    {
        if (!array_key_exists($field, $body)) {
            throw new ApiError('BAD_REQUEST');
        }
        return $body[$field];
    }

    /** @param array<string, mixed> $body */
    public static function positiveInt(array $body, string $field): int
    {
        $value = self::required($body, $field);
        if (!is_int($value) || $value < 1) {
            throw ApiError::validation([$field => 'Must be a positive whole number.']);
        }
        return $value;
    }

    /** @param array<string, mixed> $body */
    public static function intRange(array $body, string $field, int $min, int $max): int
    {
        $value = self::required($body, $field);
        if (!is_int($value) || $value < $min || $value > $max) {
            throw ApiError::validation([$field => "Must be a whole number from {$min} to {$max}."]);
        }
        return $value;
    }

    /** @param array<string, mixed> $body */
    public static function bool(array $body, string $field): bool
    {
        $value = self::required($body, $field);
        if (!is_bool($value)) {
            throw ApiError::validation([$field => 'Must be true or false.']);
        }
        return $value;
    }

    /** @param array<string, mixed> $body */
    public static function text(array $body, string $field, int $maxLength): string
    {
        $value = self::required($body, $field);
        if (!is_string($value) || $value === '' || mb_strlen($value) > $maxLength) {
            throw ApiError::validation([$field => "Must be a text of 1 to {$maxLength} characters."]);
        }
        return $value;
    }

    /**
     * Text checked after trimming, with no control characters except line breaks.
     *
     * @param array<string, mixed> $body
     */
    public static function trimmedText(array $body, string $field, int $maxLength): string
    {
        $value = self::required($body, $field);
        $text = is_string($value) ? trim($value) : '';
        if ($text === '' || mb_strlen($text) > $maxLength || preg_match('/[^\P{Cc}\r\n]/u', $text) === 1) {
            throw ApiError::validation([$field => "Must be a text of 1 to {$maxLength} characters."]);
        }
        return $text;
    }

    /**
     * Unique positive integers, capped at $maxItems.
     *
     * @param array<string, mixed> $body
     * @return list<int>
     */
    public static function intList(array $body, string $field, int $maxItems): array
    {
        $value = self::required($body, $field);
        if (!is_array($value) || !array_is_list($value)) {
            throw ApiError::validation([$field => 'Must be a list of numbers.']);
        }
        if (count($value) > $maxItems) {
            throw new ApiError('TOO_MANY_ITEMS', ['max_items' => $maxItems]);
        }
        foreach ($value as $item) {
            if (!is_int($item) || $item < 1) {
                throw ApiError::validation([$field => 'Must be a list of numbers.']);
            }
        }
        return array_values(array_unique($value));
    }

    /** @param array<string, mixed> $body */
    public static function displayName(array $body, string $field): string
    {
        $value = self::required($body, $field);
        $name = is_string($value) ? trim($value) : '';
        $length = mb_strlen($name);
        if ($length < 2 || $length > 40 || preg_match('/\p{Cc}/u', $name) === 1) {
            throw ApiError::validation([$field => 'Must be 2 to 40 characters.']);
        }
        return $name;
    }
}
