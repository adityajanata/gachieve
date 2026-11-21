<?php

declare(strict_types=1);

final class Time
{
    /** A UTC DATETIME from the database as ISO 8601, for example 2026-11-05T15:22:00Z. */
    public static function iso(?string $datetime): ?string
    {
        return $datetime === null ? null : str_replace(' ', 'T', $datetime) . 'Z';
    }
}
