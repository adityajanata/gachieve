<?php

declare(strict_types=1);

/** Allowlist cleaner for tutorial HTML (PRD 8). Runs on every save and again on every render. */
final class HtmlSanitizer
{
    /** Tag => attributes it may keep. */
    private const ALLOWED = [
        'p' => ['style'],
        'br' => [],
        'hr' => [],
        'strong' => [],
        'b' => [],
        'em' => [],
        'i' => [],
        'u' => [],
        's' => [],
        'span' => ['style'],
        'h2' => ['style'],
        'h3' => ['style'],
        'h4' => ['style'],
        'ul' => [],
        'ol' => [],
        'li' => ['style'],
        'blockquote' => [],
        'code' => [],
        'pre' => [],
        'a' => ['href', 'title'],
        'img' => ['src', 'alt', 'width', 'height'],
    ];

    /** Removed along with everything inside. Any other unknown tag is unwrapped and keeps its text. */
    private const DROPPED = [
        'script', 'style', 'iframe', 'object', 'embed', 'applet', 'svg', 'math', 'template', 'noscript',
        'form', 'input', 'button', 'textarea', 'select', 'option', 'link', 'meta', 'base', 'head', 'title',
        'audio', 'video', 'source', 'track', 'canvas', 'frame', 'frameset', 'noframes', 'noembed', 'xmp',
    ];

    private const RENAMED = ['h1' => 'h2', 'h5' => 'h4', 'h6' => 'h4'];

    private const COLOR = '/^(#[0-9a-f]{3,8}|rgba?\([0-9.,%\s]+\)|[a-z]{3,20})$/i';

    private const STYLE_VALUES = [
        'color' => self::COLOR,
        'background-color' => self::COLOR,
        'text-decoration' => '/^(underline|line-through|none)(\s+(underline|line-through))?$/i',
        'text-align' => '/^(left|center|right|justify)$/i',
    ];

    private const SAFE_SCHEMES = ['http', 'https', 'mailto'];

    public static function clean(string $html): string
    {
        if (trim($html) === '') {
            return '';
        }
        $document = new DOMDocument('1.0', 'UTF-8');
        $previous = libxml_use_internal_errors(true);
        $document->loadHTML(
            '<!doctype html><html><head><meta charset="utf-8"></head><body>' . $html . '</body></html>',
            LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING,
        );
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        $body = $document->getElementsByTagName('body')->item(0);
        if ($body === null) {
            return '';
        }
        self::walk($body);

        $output = '';
        foreach ($body->childNodes as $child) {
            $output .= $document->saveHTML($child);
        }
        return trim($output);
    }

    /** True when cleaned HTML has nothing a reader would see. */
    public static function isBlank(string $cleanHtml): bool
    {
        if (str_contains($cleanHtml, '<img')) {
            return false;
        }
        $text = html_entity_decode(strip_tags($cleanHtml), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        return trim(str_replace("\u{00A0}", ' ', $text)) === '';
    }

    private static function walk(DOMNode $parent): void
    {
        foreach (iterator_to_array($parent->childNodes, false) as $node) {
            if ($node instanceof DOMText) {
                continue;
            }
            if (!$node instanceof DOMElement) {
                $parent->removeChild($node);
                continue;
            }
            $tag = strtolower($node->tagName);
            if (in_array($tag, self::DROPPED, true)) {
                $parent->removeChild($node);
                continue;
            }
            self::walk($node);
            if (isset(self::RENAMED[$tag])) {
                $node = self::rename($node, self::RENAMED[$tag]);
                $tag = $node->tagName;
            }
            if (!isset(self::ALLOWED[$tag])) {
                self::unwrap($node);
                continue;
            }
            self::cleanAttributes($node, $tag);
            if ($tag === 'a' && !$node->hasAttribute('href')) {
                self::unwrap($node);
            } elseif ($tag === 'img' && !$node->hasAttribute('src')) {
                $parent->removeChild($node);
            }
        }
    }

    private static function rename(DOMElement $node, string $tag): DOMElement
    {
        $replacement = $node->ownerDocument->createElement($tag);
        foreach (iterator_to_array($node->childNodes, false) as $child) {
            $replacement->appendChild($child);
        }
        foreach (iterator_to_array($node->attributes, false) as $attribute) {
            $replacement->setAttribute($attribute->name, $attribute->value);
        }
        $node->parentNode->replaceChild($replacement, $node);
        return $replacement;
    }

    private static function unwrap(DOMElement $node): void
    {
        $parent = $node->parentNode;
        foreach (iterator_to_array($node->childNodes, false) as $child) {
            $parent->insertBefore($child, $node);
        }
        $parent->removeChild($node);
    }

    private static function cleanAttributes(DOMElement $node, string $tag): void
    {
        foreach (iterator_to_array($node->attributes, false) as $attribute) {
            $name = strtolower($attribute->name);
            $value = trim($attribute->value);
            $clean = in_array($name, self::ALLOWED[$tag], true) ? self::cleanValue($name, $value) : null;
            $node->removeAttribute($attribute->name);
            if ($clean !== null && $clean !== '') {
                $node->setAttribute($name, $clean);
            }
        }
        if ($tag === 'a' && $node->hasAttribute('href')) {
            $node->setAttribute('target', '_blank');
            $node->setAttribute('rel', 'noopener noreferrer nofollow');
        }
        if ($tag === 'img' && $node->hasAttribute('src')) {
            $node->setAttribute('loading', 'lazy');
            $node->setAttribute('decoding', 'async');
        }
    }

    private static function cleanValue(string $name, string $value): ?string
    {
        return match ($name) {
            'href' => self::safeLink($value),
            'src' => self::uploadedImage($value),
            'style' => self::safeStyle($value),
            'width', 'height' => ctype_digit($value) ? $value : null,
            default => $value,
        };
    }

    private static function safeLink(string $url): ?string
    {
        $compact = (string) preg_replace('/[\x00-\x20\x7F]+/', '', $url);
        $parts = parse_url($compact);
        if ($parts === false || !isset($parts['scheme'])) {
            return null;
        }
        return in_array(strtolower($parts['scheme']), self::SAFE_SCHEMES, true) ? $compact : null;
    }

    /** Images may only come from this site's uploads folder. Stored relative, so moving the base path keeps them working. */
    private static function uploadedImage(string $src): ?string
    {
        $base = preg_quote((string) Config::get('app.base_path'), '~');
        $pattern = '~^(?:' . $base . ')?(uploads/\d{4}/\d{2}/\d{2}/[a-z0-9]+\.(?:jpg|png|webp|gif))$~';
        return preg_match($pattern, $src, $match) === 1 ? $match[1] : null;
    }

    private static function safeStyle(string $style): ?string
    {
        $kept = [];
        foreach (explode(';', $style) as $declaration) {
            [$property, $value] = array_map('trim', explode(':', $declaration, 2) + [1 => '']);
            $property = strtolower($property);
            if (isset(self::STYLE_VALUES[$property]) && preg_match(self::STYLE_VALUES[$property], $value) === 1) {
                $kept[] = "{$property}: {$value}";
            }
        }
        return $kept === [] ? null : implode('; ', $kept) . ';';
    }
}
