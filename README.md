# Genshin Achievements

Fan-made Genshin Impact achievement tracker. PHP 8.3 (minimum 8.3.36), MySQL, HTML + CSS + vanilla JS. Not affiliated with HoYoverse.

## Local setup (XAMPP)

1. Run `database/create_database.sql`, select the database, then import `database/schema.sql`, then `database/seed_points.sql`.
2. Copy `includes/config.local.sample.php` to `includes/config.local.php` and fill in the values. Set `app.base_path` to `/genshinachievements/` when the project sits in that folder under `htdocs`.
3. Place `achievements.id.json` and `achievements.en.json` in `data/`.
4. Open `http://localhost/genshinachievements/`.

## Data validator

Run after every data refresh:

```bash
php includes/cli/validate-data.php
```

It checks that both files hold the same ids, that `stages` matches the `stageN` keys, and that no id is duplicated. It exits with a non-zero code on any problem.

## Config keys

Defaults are in `includes/config.php`. `includes/config.local.php` overrides them and is git-ignored.

| Key | Meaning |
| --- | --- |
| `app.base_path` | URL path of the project root, with a trailing slash |
| `lock.timeout_seconds`, `lock.warn_before_seconds`, `lock.heartbeat_seconds` | Editor lock timing |
| `editor.autosave_seconds` | Background autosave interval |
| `bulk.max_items` | Stage ids per bulk Apply or import |
| `uploads.max_bytes` | Maximum size per image |

## Documents

Product rules are in `docs/PRD.md`, endpoints in `docs/API_SPEC.md`, visual rules in `docs/DESIGN.md`.
