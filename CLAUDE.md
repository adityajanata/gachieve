# CLAUDE.md

Gachieve: a fan-made Genshin Impact achievement tracker. PHP 8.3 native backend, MySQL, HTML + CSS (tokens in `assets/css/app.css`, no framework) + vanilla JS (ES modules) frontend.

## Read before coding

Before writing or changing any code in a session, read these files completely, in this order:

1. `docs/PRD.md`: what the product does, roles, rules, Decisions Log (section 11), folder structure (section 9)
2. `docs/API_SPEC.md`: every endpoint, request and response shape, error codes, rate limits, client rules
3. `docs/DESIGN.md`: tokens, components, layouts, states, motion, accessibility, copy rules
4. `database/schema.sql` and `database/seed_points.sql`: the frozen v1 schema

Do not start coding from memory of an earlier session; re-read. If a task touches only one area, still read all three docs once per session, then re-read the relevant sections before each step.

## Which document wins

When documents disagree, follow this order (highest first):

1. The user's latest instruction in the conversation
2. PRD section 11 (Decisions Log)
3. `database/schema.sql`
4. `docs/API_SPEC.md`
5. `docs/DESIGN.md`
6. The rest of `docs/PRD.md`

If a conflict is not covered below, stop and ask. Never resolve it silently.

### Known conflicts, already resolved

| PRD body says | Correct rule | Source |
| --- | --- | --- |
| 5.4: user confirms a summary before the first sign-in merge | Guest progress is imported **automatically** after every sign-in; toast shows the count | Decisions Log 39, API 3.1 and 6.4 |
| 5.5: "How to get" button enabled only when a tutorial exists | Button "How To Achieve" is always shown; muted when no tutorial, opens the "not available yet" notice | DESIGN 3.4 |
| 6: animate.css, anime.js and GSAP are optional | **GSAP only** | Decisions Log 37, DESIGN 6 |
| 5.7: lock is released on Save | Save keeps the lock; it is released on Submit, Publish, `release` (editor close), timeout or force unlock | API 4.2 |
| 9.3: config key `lock.timeout_minutes` | Keys are in seconds: `lock.timeout_seconds`, `lock.warn_before_seconds`, `lock.heartbeat_seconds` | API 6.2 |
| 5.1: filters include partial, multi-stage | v1 filters: status (All, Done, On progress, Not done), version, has tutorial, hidden, plus sort | Decisions Log 45, DESIGN 4.1 |
| 9.1: folder structure "draft for review" | Approved; treat it as final | User decision |
| 9.1 (old copies): `RateLimiter` in `core/` | Rate limit SQL is in `services/RateLimitService` | Decisions Log 42 |

## Hard rules

**Stack**

- PHP **8.3, minimum 8.3.36** (php2shell patch), or a distribution build with the patch backported and `php.vendor_patched` set to `true` in `config.local.php` (Decisions Log 63). `declare(strict_types=1);` in every PHP file. No framework, no Composer, no Node on the server.
- MySQL through PDO only: prepared statements with bound parameters, emulated prepares off, `utf8mb4`, connection `time_zone = '+00:00'`. All DATETIME values are UTC.
- Frontend libraries from CDN with **pinned exact versions** and SRI hashes, each allowed by its exact path in the CSP: GSAP, SweetAlert2, Phosphor Icons (web), svg-clouds (day sky clouds, Decisions Log 53), Google Fonts (Poppins, JetBrains Mono). No CSS framework (Decisions Log 52). TinyMCE is self-hosted in `assets/js/vendor/tinymce/`, and tippy.js 6.3.7 with Popper 2.11.8 (Studio tooltips) in `assets/js/vendor/tippy-6.3.7/` and `popper-2.11.8/` with their source maps and licenses (Decisions Log 59). Vendor files are never edited; a versioned vendor folder caches for a year, so a new version goes in a new folder. The two exceptions are Google's `gsi/client` script and Cloudflare's Web Analytics `beacon.min.js` (Decisions Log 65), which their publishers ship with no version to pin. The favicon `assets/img/favicon.svg` is the one file allowed to repeat token colors outside `app.css` (Decisions Log 64).

**Structure and layering** (PRD 9.1 to 9.3)

- Project root is the web root. `includes/`, `database/`, `storage/` are denied by `.htaccess`; `uploads/` never executes scripts.
- One direction only: `api/*.php`, `studio/*.php` and the command line scripts in `includes/cli/` → `includes/services/` → `includes/core/`. SQL lives **only** in `includes/services/`. Services never read `$_GET`, `$_POST` or the session and never echo. Endpoints never write SQL.
- One endpoint file per resource, dispatching on `?action=`. Shared checks (method, role, CSRF, rate limit, JSON body) live once in `core/Request` and `auth/Policy`.
- Every frontend API call goes through `assets/js/core/api.js`. Every alert, toast, confirmation and prompt goes through `assets/js/core/toast.js` or `assets/js/core/modal.js` (SweetAlert2 is never called directly elsewhere). Every tooltip goes through `assets/js/core/tooltip.js` (tippy.js is never called directly elsewhere).
- `assets/` contains exactly `js/`, `css/`, `img/`.
- `data/achievements.id.json` and `data/achievements.en.json` are the read-only single source of truth. Never modify them; the server reads them only through `AchievementCatalog`.

**Naming**

- PHP: one class per file, file name equals class name.
- JS and CSS files: kebab-case.
- Custom HTML ids and CSS classes use an area prefix: `trk-` (tracker), `adm-` (Studio), `ui-` (shared).
- Database: snake_case. Config keys: dot notation.

**No duplication**

- Before writing a new function, search for an existing one that does the same or nearly the same thing. If one is similar, **ask the user first** whether to reuse or extend it. Never create a near-copy.
- Shared UI pieces (button, modal, sheet, toast, tooltip, banner, row, chip, skeleton) are built once and reused.

**Security** (PRD 8)

- No user input concatenated into SQL, ever.
- Escape all output by context. Use `textContent`, never `innerHTML`, for user text. Tutorial HTML is sanitized on save and on render.
- CSRF token on every POST (`X-CSRF-Token` header; body `csrf` only for `editor.php?action=release`).
- Role checks on the server for every action. Hiding a button is not access control.
- A user's email reaches only that user and Administrators; for anyone else the server sends `null` (Decisions Log 57).
- Rate limits, upload MIME checks and size limits exactly as in API 6.1 and 4.4.
- Every tutorial save checks `tutorials.locked_by` equals the caller and the lock is fresh.
- Secrets live only in `includes/config.local.php` (git-ignored). Never commit them.

**Database**

- `schema.sql` is the frozen v1 baseline. Never edit it. Any change is a new file `database/migrations/NNNN_description.sql`, recorded in `schema_migrations`, and needs the user's approval first.

**API**

- Implement endpoints exactly as specified in `docs/API_SPEC.md`: same actions, methods, field names, envelope and error codes. Do not invent endpoints, fields or error codes; ask first.
- Only GET and POST.

**Design** (DESIGN.md)

- Use the tokens; never hard-code colors, radii, shadows or z-index values outside `assets/css/app.css`.
- One accent (sky blue), one radius system, one icon family (Phosphor), Poppins only (JetBrains Mono only in the bulk mark JSON textarea).
- Light and dark themes both work. WCAG AA contrast. `prefers-reduced-motion` respected through `gsap.matchMedia()`; the living sky's CSS loops stop through the same media query in `app.css` (DESIGN 2.9).
- No em dash or en dash in UI text, no emoji in the UI, no `100vh` (use `dvh`), no `scroll` event listeners (use IntersectionObserver).

**Language**

- Technical text is always English: button labels, error messages, validation messages.
- Content text follows the ID / EN toggle: labels, hints, descriptions, empty states, banners, tutorials. Indonesian copy is semi-formal ("Anda").

## How to work

1. Before each task, say which PRD milestone (M1 to M5) and which doc sections it covers.
2. Propose a short plan (files to create or change) and wait for approval when the task touches more than a few files or changes a shared module.
3. Build in small steps; one responsibility per file.
4. After PHP changes, run `php -l` on every changed file. Test against local XAMPP with the real data files.
5. If a decision changes during the work, tell the user which doc needs updating. Do not edit `docs/` without asking.
6. Do not commit or push unless the user asks.

## Local setup (XAMPP)

1. Run `database/create_database.sql` (local only), select the database, then import `database/schema.sql`, then `database/seed_points.sql`.
2. Copy `includes/config.local.sample.php` to `includes/config.local.php` and fill in database credentials, `auth.google_client_id` and `auth.bootstrap_admin_emails`. In Google Cloud Console, add `http://localhost` to the client's Authorized JavaScript origins. No client secret is needed.
3. Place the achievement JSON files in `data/`.
