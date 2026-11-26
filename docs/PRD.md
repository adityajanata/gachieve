# PRD: Gachieve

Draft v0.2 · Data: Genshin Impact achievements, v1.0 through v7.1

## 1. Summary

A website where Genshin Impact players track which achievements they have earned, search the full list, and open a how-to tutorial for each one. Two features set it apart from similar sites: **a tutorial modal on every achievement card** (text or video, managed by staff) and **bulk marking by name or by name + stage, with an inquiry step before anything is saved**.

## 2. Goals and Non-Goals

**Goals**

- Fast achievement tracking that works without an account.
- Progress stored safely in the cloud for signed-in users.
- Per-achievement tutorials in Indonesian and English, managed through the Studio area.
- Bulk import of progress with a validation (inquiry) step so users see exactly what will change.

**Non-Goals (v1)**

- Automatic sync with the game account (no official API).
- Social features (comments, leaderboards).
- Public tutorial submissions from Travelers or Guests.

## 3. Roles and Permissions

| Role | Tracking | Progress storage | Browse tutorials | Write tutorials | Earns points and badges | Manage users and roles |
| --- | --- | --- | --- | --- | --- | --- |
| Guest | Yes | Browser localStorage (lost if cache is cleared) | Yes | No | No | No |
| Traveler | Yes | Cloud (MySQL) | Yes | No | No | No |
| Contributor | Yes | Cloud (MySQL) | Yes | Yes (draft and submit for review) | Yes | No |
| Administrator | Yes | Cloud (MySQL) | Yes | Yes (publish directly, approve, reject, delete) | No | Yes |

- A new Google sign-in becomes a **Traveler** by default. The first Administrator is the project owner; an Administrator promotes Travelers to Contributors (or other Administrators) from the Users page.
- Role checks always happen on the server. Hiding a button in the UI is never treated as access control.
- Only Administrators can approve, reject or publish tutorials. Contributors can only draft and submit for review.

## 4. Data Source (Single Source of Truth)

The `data/` folder holds `achievements.id.json` and `achievements.en.json`. They are the base for the whole app.

**Fields per item**: `id` (array, one id per stage), `name`, `achievementGroupId`, `achievementGroupName`, `isHidden`, `sortOrder`, `stages`, `stage1..stageN` (`title`, `description`, `progress`, `reward`), `version`, and `dupealias` (only for duplicate titles).

**Data rules**

- Both files must contain exactly the same set of ids. The achievement key is the **first stage id** (`id[0]`), because names differ between languages.
- Progress is stored per **stage id** (for example 80212, 80213, 80214).
- The JSON files are read-only for the app. They change only through a data update, never through the Studio area. Updates are pulled manually from theBowja/genshin-db with a local Node script that lives outside this project, and the resulting files are placed in \`data/\` by hand.
- A validator script checks: same ids in both files, `stages` matches the number of `stageN` keys, and no duplicate ids.
- All achievements are shown, hidden or not, since the goal is tracking what the player already earned.

**`{param0}` rendering**

Descriptions such as "Survive {param0} points of DMG..." take the number from that stage's `progress` field. Each stage therefore shows its own value (30, 150, 300). Descriptions without a placeholder are shown as they are.

**Version updates**

The data is fetched from theBowja/genshin-db. New game versions only append new ids; existing ids never change, so saved progress and tutorials stay valid. The validator runs on every data refresh.

**Display notes**

When a stage title differs from the achievement name (for example stage 3 of "Zoo Tycoon"), the stage title is shown next to that stage and is searchable; a match opens the achievement. `dupealias` is never displayed; it only helps tell duplicate-name achievements apart in the Ambiguous list of bulk mark.

## 5. Features

### 5.1 Achievement List and Cards

- Each card shows title, description, reward, release version, group, and a Hidden badge.
- Multi-stage achievements have one checkbox per stage. **Stages are dependent**: checking stage 3 also checks stages 1 and 2; unchecking stage 1 also unchecks stages 2 and 3.
- Filters: group, version, status (done, partial, not done), hidden, multi-stage, has tutorial. v1 ships a subset, with partial named On progress (Decisions Log 45).
- Summary stats: total completed, Primogems earned and remaining, percent per group.

### 5.2 Search

- Searches achievement titles, stage titles and descriptions in the active language, so a stage whose title differs from the achievement name (for example stage 3 of "Zoo Tycoon") is found too.
- Client-side fuzzy search with debounce, no page reload.

### 5.3 Language Toggle

- ID (default) and EN, top right corner, remembered in localStorage.
- Progress is language-independent because it is keyed by id.

**Interface text**

- Buttons stay in English in both languages.
- Labels, headings and hints follow the language toggle (ID or EN), from translation files in `assets/js/i18n/`.

### 5.4 Progress: Guest and Signed-in

- **Guest**: localStorage, format `{ version, updatedAt, done: { [stageId]: timestamp } }`.
- **Signed-in**: Google sign-in, progress saved to MySQL per user.
- **First sign-in merge**: local progress is merged into the cloud (union only, nothing in the cloud is removed). The user sees a summary and confirms before the merge.
- JSON export and import as a manual backup, in the Bulk Mark drawer. Import only adds progress (union, stage cascade applied, unknown ids skipped) and can be undone like a bulk action.

**Sync behavior**

- Every check or uncheck updates the screen **immediately** (optimistic) and is sent to the server right away for signed-in users. Guests write to localStorage immediately.
- If saving fails, including when offline, the screen is rolled back and a message is shown. A rollback covers the whole stage cascade (for example checking stage 3 that also checked stages 1 and 2).

### 5.5 How To Achieve Tutorials

- Each card has a "How to get" button, enabled only when a **Published** tutorial exists.
- The button opens a **modal** with a **text** tutorial (rich text and images) and/or a **video** tutorial (embedded).
- Tutorials attach to the achievement (`id[0]`). Per-stage notes are not part of version 1: the `stage_notes` column exists but stays empty (Decisions Log 46).
- Tutorials are **multi-language (ID and EN)**. Only one language is required. If the active language has no content, the modal shows a default notice that the tutorial is not yet available in that language.
- **Mobile friendly and light**: video uses a click-to-load facade (thumbnail first, iframe only after a tap) with a responsive 16:9 container; images are lazy-loaded, responsive, and capped in width; the modal is full-screen on small devices.
- Tutorials are written in a **TinyMCE** rich-text editor (see 5.7) by Contributors and Administrators.

**Tutorial content rules**

- One YouTube video link per language: one for ID and one for EN. Version 1 supports **YouTube only**, through a provider allowlist that can be extended later.
- If only one video exists, it is shown in **both** languages. In the language that does not own the video, a note in the language of the page being viewed says the video is available in the other language. Example: a video only in ID shows in the EN view with an English note saying it is available in Indonesian; a video only in EN shows in the ID view with an Indonesian note saying it is available in English.
- **Submit for Review** requires at least one language that has text or a video.

### 5.6 Bulk Mark

Opened from a "Bulk Mark" button. Two input modes, both followed by a mandatory **Inquiry** step.

**Mode A: by name (plain title)**

- One title per line. Lines are validated independently of each other.
- A match marks every stage of that achievement.

**Mode B: by name + stage (JSON)**

```json
[
  { "name": "Lilin Menyala di Tengah Angin", "stage": 2 },
  { "name": "Petualang Belantara Berkilauan", "stage": 3 }
]
```

- `stage` means "mark up to this stage", consistent with dependent stages.
- The format itself is validated first: JSON syntax, required keys, `stage` is an integer within the achievement's stage count. Errors point to the exact item.
- A sample format button fills the textarea with the example above.

**Inquiry step (no data is changed here)**

After the user submits input, the system checks it and shows a report:

| Result | Meaning |
| --- | --- |
| Found | Matches exactly one achievement (and a valid stage in Mode B) |
| Not found | No achievement has that name; each missing name is listed |
| Ambiguous | More than one achievement matches; the user picks one |
| Invalid format | Mode B only: malformed JSON or bad `stage`; shows where |
| Already done | Found, but already marked; skipped on apply |

- Matching is case-insensitive, trims spaces, and normalizes quotes. It uses the active language first, then the other language as a fallback.
- The user can fix the input and re-run the inquiry as many times as needed.
- **Apply** only processes Found items. Not found and invalid items are never silently dropped; they stay visible in the report and can be copied.
- The last bulk action can be undone. Undo removes only what that action added, and a stage stays when a later stage of the same achievement is still done, because stages are dependent.

**Limits and where it runs**

- The Inquiry step runs in the browser against the already loaded JSON, so it puts no load on the server. Apply sends only stage ids, and the server re-validates every id against the JSON before saving.
- Maximum items per bulk action is a config value (`bulk_max_items`, default 2000, higher than the number of achievements so "mark everything" still works), on top of the 1 MB request body cap. Above the limit the user gets a clear message and nothing is processed.

### 5.7 Studio and Tutorial Review Workflow

The Studio (`/studio`) is available to Contributor and Administrator, with different scopes. Pages only Administrators can open sit under an "Admin" heading in its nav.

- **Dashboard** (Administrator): signed-in user count, tutorial counts per status, achievements without a tutorial.
- **All Tutorials** (Contributor, Administrator): a WordPress-style list of every achievement id in the SSoT JSON, showing ID and EN names, tutorial status, last editor and date, with search, a status filter and an **Edit** button that opens the edit page.
- **Edit Tutorial** (Contributor, Administrator): ID and EN tabs, TinyMCE editor, video embed field, live modal preview, **Save Draft** and **Submit for Review**.
- **Approvals** (Administrator only): queue of tutorials waiting for review, side-by-side preview, **Approve** and **Reject** (with required reason). Several queued tutorials can be approved at once, up to 30 (Decisions Log 61).
- **Users** (Administrator): list of signed-in users with avatar, top badge, role, join date, completed count; change roles. The writer agent Charlotte is listed too; its role is fixed and it cannot be deleted, only disabled (Decisions Log 62).

**Status workflow**

| Status | Set by | Next step |
| --- | --- | --- |
| Draft | Contributor saves | Contributor continues, or submits for review |
| Pending Review | Contributor clicks Submit for Review | Appears on the Approvals page |
| Published | Administrator approves | Visible to everyone in the card modal |
| Rejected | Administrator rejects with a reason | Returns to All Tutorials; the Contributor sees the reason, edits the same version (it returns to Draft), and resubmits |

- A reject always requires a reason (textbox), stored with the reviewer and time, and shown to the Contributor on the Edit page.
- Every status change is recorded in a review log (who, when, from, to, reason). When a new version is approved, the previously live version becomes Replaced: kept for history, never shown.
- Administrators publish directly with no approval step: the edit page shows a Publish button instead of Submit for Review. A Contributor can Withdraw a Pending Review version back to Draft; while it is pending, the editor stays locked unless it is withdrawn. A draft belongs to its creator: other Contributors cannot take it over (Administrators can), and points go to the version's creator. The version row is created at the first Save, not when the editor opens.
- Editing a Published tutorial creates a new version (Draft, then Pending Review). The live version stays visible until the new one is approved. If the new version is rejected, the live version stays visible; the Contributor sees the reason and can revise and resubmit.

**TinyMCE editor**

- Basic formatting: bold, italic, underline, strikethrough, text color, background color, headings, lists, quotes, links, and code.
- Pasted or dragged images are uploaded automatically to `uploads/YYYY/MM/DD/` and inserted as responsive images.
- Self-hosted in \`assets/js/vendor/tinymce/\` (no CDN, no API key); the editor config lives in one shared file used by every edit page.

**Edit locking**

- Only one person can edit a tutorial at a time. Each tutorial has a lock (`is_locked`, `locked_by`, `locked_at`, `last_activity_at`). Opening Edit Tutorial acquires the lock when it is free. While it is held, anyone else sees "Being edited by (name)" and cannot open the editor.
- The lock is released (`is_locked` back to false) on Save, Submit for Review, Cancel, or timeout.
- **Inactivity timeout**: 10 minutes without activity (typing, editor changes, save). With 2 minutes left, a popup warns that the session will be disconnected and the lock released; any interaction or a "Keep editing" button resets the timer. At timeout the lock is released.
- The editor sends a periodic heartbeat while it is open and active. Because a crashed tab cannot release its own lock, the server never trusts the flag alone: a lock counts as free when `is_locked` is false **or** `last_activity_at` is older than the timeout.
- The timeout (10 minutes) and warning (2 minutes) are configuration values, not hardcoded. At timeout, the editor content is autosaved as a draft before the lock is released, so nothing the Contributor typed is lost. An Administrator can force unlock any tutorial from All Tutorials.

### 5.8 Contributor Points and Badges

Contributors earn points for approved tutorial work and unlock badges with titles at point milestones, similar to Facebook's contributor levels. **No point value, badge title or threshold is hardcoded.** Everything is data, seeded from defaults and editable by an Administrator.

**Point rules (defaults, all editable)**

| Event key | Default points | Awarded when |
| --- | --- | --- |
| `tutorial_published_new` | 10 | A tutorial for an achievement with no live tutorial is approved |
| `tutorial_published_update` | 3 | A new version of an already published tutorial is approved |
| `translation_added` | 5 | An approved version adds a language that the live version did not have |

**Badge milestones (defaults, all editable)**

| Badge key | Title | Minimum points |
| --- | --- | --- |
| `wayfinder` | Wayfinder | 10 |
| `trailblazer` | Trailblazer | 50 |
| `seasoned_guide` | Seasoned Guide | 150 |
| `master_cartographer` | Master Cartographer | 400 |
| `legend_of_teyvat` | Legend of Teyvat | 1000 |

**Rules**

- Points are granted only when a version is **approved**, never on submit, so spam does not earn anything.
- Each reward is recorded once in a point ledger, unique per user, event and version, so approving twice never double-counts. A user's total is always the SUM of their ledger entries; no cached total is stored.
- If an approved version is later removed, a negative ledger entry reverses its points. A badge, once awarded, is kept.
- Administrators and the writer agent (Decisions Log 62) do not earn points.
- When a total crosses a badge threshold, the badge is awarded automatically in the same database transaction, and the Contributor sees a congratulation notice until it is marked as seen.
- The current badge title shows next to the Contributor's name in All Tutorials and as credit in the tutorial modal. The profile shows total points, earned badges, and progress to the next badge.

**Parameterization**

- Rules and badges live in the tables `point_rules` and `badges`, seeded from `database/seed_points.sql`.
- An Administrator-only **Points Settings** page edits point values, badge titles, thresholds, order, and an active toggle.
- One points service in `includes/` is the only code that reads rules, writes the ledger and awards badges. Nothing else computes points.

### 5.9 Accounts

- **Display name**: the public name shown in tutorial credits. It defaults to the Google name and the user can change it.
- **Disabled accounts**: an Administrator can disable an account (`is_active` off); it can no longer sign in.
- **Becoming a Contributor**: only an Administrator promotes a Traveler, from the Users page. There is no request flow in version 1.
- **Deleting an account** removes the user's progress, points, badges and bulk history. Tutorials the user wrote stay, and their author is shown as **Deleted Account**.

## 6. Architecture and Tech Stack

| Area | Decision |
| --- | --- |
| Frontend | HTML + CSS (design tokens in `app.css`, no framework) + JavaScript, libraries from CDN; font Poppins; GSAP (Decisions Log 37, 52); tippy.js with Popper for Studio tooltips, self-hosted (Decisions Log 59) |
| Rich text | TinyMCE, self-hosted in \`assets/js/vendor/tinymce/\`, for the tutorial editor |
| Backend | PHP 8.3 native (minimum 8.3.36, which patches php2shell, or a distribution build with the patch backported; Decisions Log 63) with PDO |
| Database | MySQL (local with XAMPP first, then cPanel or InfinityFree) |
| Auth | Sign in with Google (Google Identity Services); the PHP backend verifies the ID token and creates a session |
| Achievement data | Static JSON in `data/`, loaded by the client and cached |
| Media | Tutorial images in `uploads/YYYY/MM/DD/`; videos are embeds only |
| Hosting | Local XAMPP now; deploy later after it works locally |

No Node on the server. `node_modules` is only used locally for data preparation if needed.

## 7. Database (MySQL)

| Table | Purpose | Key columns |
| --- | --- | --- |
| `users` | Signed-in accounts | id, google\_sub (unique), email, name, display\_name, avatar, role (traveler, contributor, administrator), is\_active, created\_at |
| `progress` | Completed stages per user | user\_id, stage\_id, completed\_at (unique on user\_id + stage\_id) |
| `tutorials` | One row per achievement | id, achievement\_id (unique), live\_version\_id (nullable), is\_locked, locked\_by, locked\_at, last\_activity\_at, created\_at |
| `tutorial_versions` | Every draft and published revision | id, tutorial\_id, version\_no, status (draft, pending\_review, published, rejected, replaced), created\_by, submitted\_at, published\_at |
| `tutorial_translations` | Content per language, per version | version\_id, lang (id or en), body\_html (sanitized), video\_provider, video\_id, stage\_notes (JSON); a language may be absent |
| `tutorial_reviews` | Review log | id, version\_id, from\_status, to\_status, actor\_id, reason, created\_at |
| `point_rules` | Configurable point values | event\_key (unique), points, is\_active |
| `badges` | Configurable milestones | badge\_key (unique), title, min\_points, sort\_order, is\_active |
| `point_ledger` | Every point change | id, user\_id, event\_key, entry\_type (award or reversal), points (negative for reversal), version\_id, created\_at (unique on user\_id + event\_key + version\_id + entry\_type) |
| `user_badges` | Badges earned | user\_id, badge\_id, awarded\_at, seen\_at (null until the notice is seen) |
| `uploads` | Tutorial image tracking | id, path, mime, size, uploaded\_by, version\_id (nullable, provenance only), created\_at |
| `bulk_history` | Last bulk action, for undo | id, user\_id, stage\_ids (JSON), created\_at |
| rate\_limits | Fixed-window request counters for rate limiting (no Redis needed) | rate\_key (SHA-256 of action + IP or user id, primary key), window\_start, hits; old rows purged daily |
| admin\_audit\_log | Trail of Administrator actions: force unlock, role change, disable or delete account, delete tutorial, points settings, image cleanup | id, actor\_id, actor\_name (snapshot), action, target\_type, target\_id, detail (JSON), created\_at |
| schema\_migrations | Which migration files were applied on top of the v1 baseline | version (primary key), applied\_at |

## 8. Security Requirements

- **SQL injection**: every query uses PDO prepared statements with bound parameters. No string concatenation or interpolation of user input into SQL, ever. Emulated prepares are turned off.
- **XSS**: all output is escaped by context (HTML, attribute, JS, URL). User-supplied text is never inserted with `innerHTML`; the client uses `textContent`. Tutorial rich text is sanitized against an allowlist on save and again on render.
- **Video embeds**: only the provider and video id are stored; the embed URL is built server-side from an allowlist of providers.
- **Sessions**: HttpOnly, Secure (in production), SameSite cookies; session id regenerated on login.
- **CSRF**: token on every state-changing request.
- **Authorization**: role checked server-side on every endpoint; Guest actions never touch the database.
- **Input validation**: type, length and range checks on every API input, including bulk mark payloads (maximum size per request).
- **Other**: Content-Security-Policy header, rate limiting on login and bulk endpoints, generic error messages to the client with details only in server logs.
- **Rate limiting**: fixed-window counters in the `rate_limits` table, keyed by a hash of action plus IP (or user id when signed in); raw IPs are never stored. Applies to login, progress writes, bulk Apply, uploads and tutorial saves, with limits kept in config.
- **Audit trail**: sensitive Administrator actions are written to `admin_audit_log` with an actor name snapshot, so entries survive account deletion.
- **Time**: every DATETIME is stored in UTC (the connection runs with `time_zone = '+00:00'`); local time is applied only when displaying.

**Uploads and rich text**

- Image uploads accept only JPEG, PNG, WebP and GIF, checked by real MIME type (not file extension), with a size limit. Files are renamed with random names and stored under `uploads/YYYY/MM/DD/`.
- The `uploads/` folder never executes scripts (PHP disabled there through server config) and only Contributors and Administrators with a valid session and CSRF token can upload.
- Tutorial HTML is sanitized on the server with an allowlist (tags, attributes, safe URL schemes) before saving, and treated as untrusted on render.

**Image cleanup**

- Each upload records the version being edited (`version_id`) as provenance only. Versions copy content from each other, so one image can be used by many versions, and `version_id` never decides deletion.
- An Administrator-only **Clean unused images** action scans every version's `body_html`, then deletes files that nothing references and that are older than 24 hours (grace period for unsaved drafts).

## 9. Code and Folder Conventions

- Keep the code tidy and easy to maintain. One module per responsibility; no duplicated code or functions.
- If a new function looks similar to an existing one, **ask first** (reuse or extend), or give it a clearly unique name, id and class.
- Unique, descriptive ids and CSS classes; shared UI pieces (modal, toast, card) are built once and reused.
- `assets/` contains exactly three folders: `js`, `css`, `img`.

### 9.1 Folder Structure (v1, draft for review)

The project root is the web root (InfinityFree only gives `htdocs/`, so there is no folder above it to hide code in). Private folders are closed with `.htaccess` instead.

```
genshin-achievements/
├── index.php                  Tracker page (Guest and signed-in)
├── privacy.php                Privacy policy, ID and EN in one page (Decisions Log 67)
├── robots.php                 Served as /robots.txt (rewrite), built from config (Decisions Log 64)
├── sitemap.php                Served as /sitemap.xml (rewrite), built from config (Decisions Log 64)
├── .htaccess                  Security headers, deny dotfiles, deny private folders, robots and sitemap rewrites
├── .gitignore
├── README.md                  Local setup, import order, config keys
│
├── studio/                    Studio pages (HTML shells; data comes from api/)
│   ├── index.php              Dashboard
│   ├── tutorials.php          All Tutorials (Contributor, Administrator)
│   ├── editor.php             Tutorial editor with TinyMCE and lock
│   ├── approvals.php          Approval queue (Administrator)
│   ├── users.php              Users, roles, disable, delete (Administrator)
│   ├── points.php             Points Settings: rules and badges (Administrator)
│   ├── my-points.php          My Points (Contributor)
│   ├── audit.php              Audit log viewer (Administrator)
│   └── maintenance.php        Clean unused images (Administrator)
│
├── api/                       JSON endpoints, thin: check method, role, CSRF, rate limit → service → JSON
│   ├── auth.php               Sign in, sign out, current user, CSRF token
│   ├── progress.php           Load, set and unset stages; import guest progress
│   ├── bulk.php               Apply bulk mark, undo last
│   ├── tutorials.php          Public read of published tutorials
│   ├── editor.php             Open, save, submit, withdraw, heartbeat, release
│   ├── reviews.php            Approve, reject (Administrator)
│   ├── uploads.php            Image upload for TinyMCE
│   ├── users.php              Profile (display name, delete own account), admin user actions
│   ├── points.php             My points and badges, mark badges seen, settings (Administrator)
│   └── admin.php              Dashboard, force unlock, delete tutorial, audit log list, image cleanup
│
├── includes/                  PHP only, denied from the web
│   ├── bootstrap.php          Autoloader, config, error handling, session, DB time zone
│   ├── config.php             Defaults (no secrets)
│   ├── config.local.sample.php
│   ├── config.local.php       Real secrets, git-ignored
│   ├── core/                  Config, Database, Session, Csrf, Request, Response,
│   │                          Validator, Logger, ApiError, Time
│   ├── auth/                  Auth, GoogleTokenVerifier, Policy (who may do what)
│   ├── services/              The only place with SQL:
│   │                          ProgressService, BulkService, TutorialService,
│   │                          LockService, ReviewService, PointsService,
│   │                          UploadService, UserService, AuditService,
│   │                          RateLimitService
│   ├── content/               AchievementCatalog (reads data/*.json for server checks),
│   │                          HtmlSanitizer, VideoEmbed
│   ├── cli/                   Command line only: validate-data.php (data validator), create-agent.php and agent-submit.php (writer agent, Decisions Log 62)
│   └── views/                 Shared page parts: head, header, footer, studio-nav, studio-page
│
├── assets/
│   ├── css/                   app.css (tokens, base reset, shared and tracker parts), studio.css
│   ├── js/
│   │   ├── core/              api.js, i18n.js, storage.js, toast.js, modal.js, dom.js,
│   │   │                      motion.js, theme.js, theme-init.js, lang-init.js, badge.js,
│   │   │                      tutorial-view.js, sky.js, tooltip.js
│   │   ├── i18n/              labels.id.js, labels.en.js (content labels only)
│   │   ├── tracker/           catalog.js, search.js, progress.js, cards.js,
│   │   │                      bulk-mark.js, bulk-inquiry.js, backup.js, account.js,
│   │   │                      filters.js, category-nav.js, summary.js,
│   │   │                      tutorial-modal.js, main.js, privacy.js (privacy page wiring),
│   │   │                      banner-init.js (classic script in head, before first paint:
│   │   │                      guest banner guess from localStorage, so it causes no layout shift),
│   │   │                      bulk-prompt.md (Bulk Mark AI prompt, owner-edited)
│   │   ├── studio/            shell.js, ui.js, dashboard.js, tutorials.js, editor.js,
│   │   │                      tinymce-config.js, lock.js, approvals.js, users.js,
│   │   │                      points.js, my-points.js, audit.js, maintenance.js
│   │   └── vendor/            Self-hosted, never edited: tinymce/, tippy-6.3.7/,
│   │                          popper-2.11.8/ (with source maps and licenses)
│   └── img/                   Logo, icons, badge art, placeholders, favicon.svg
│
├── data/                      achievements.id.json, achievements.en.json (SSoT, read-only, public)
├── uploads/                   YYYY/MM/DD/ tutorial images; .htaccess blocks script execution
├── database/                  Denied from the web
│   ├── create_database.sql    Local XAMPP only
│   ├── schema.sql             v1 baseline
│   ├── seed_points.sql
│   └── migrations/            0002_*.sql and later
└── storage/
    └── logs/                  app.log; denied from the web, git-ignored
```

### 9.2 Layering Rules

- One direction only: `studio/*.php` and `api/*.php` → `includes/services` → `includes/core`. Services never read `$_GET`, `$_POST` or the session directly, and never echo output; endpoints never write SQL.
- Each endpoint file covers one resource and dispatches on `?action=`; shared checks (method, role, CSRF, rate limit, JSON body) live once in `core/Request` and `auth/Policy`, not in each endpoint.
- Studio pages are HTML shells built from `includes/views/`; all data loads through `api/`, so the tracker and the Studio share one client (`assets/js/core/api.js`).
- Front-end JavaScript uses native ES modules (`type="module"`), no bundler. Each file exports one responsibility; `main.js` (tracker) and each Studio page file only wire modules together.
- The server re-reads `data/*.json` only through `AchievementCatalog`, cached in memory per request, to validate stage ids for progress and bulk Apply.

### 9.3 Naming

- PHP: one class per file, file name equals class name (`TutorialService.php`), `declare(strict_types=1)` everywhere; classes autoloaded from the `includes/` subfolders.
- JavaScript and CSS files: kebab-case (`bulk-mark.js`).
- HTML ids and custom CSS classes carry an area prefix so they never collide: `trk-` (tracker), `adm-` (Studio; the prefix predates the rename), `ui-` (shared pieces such as modal and toast).
- Database: snake\_case tables and columns (as in `schema.sql`); config keys in dot notation (`lock.timeout_minutes`).

## 10. Non-Functional Requirements

- The list holds roughly a thousand items: lazy or virtual rendering so it stays smooth on phones.
- Mobile first. Guests can use the site offline once data is cached.
- Accessible modals: focus trap, Esc to close, readable contrast.
- Portable deployment: configuration through one config file so moving from XAMPP to cPanel or InfinityFree only changes credentials and paths.

## 11. Decisions Log

No open questions remain. Decisions taken:

1. Tutorial statuses: Draft, Pending Review, Published, Rejected, Replaced.
2. One language is enough per tutorial; a missing language shows a default "not yet available" notice.
3. A new version of a Published tutorial never hides the live one; the live version is replaced only on approval, and stays if the new version is rejected.
4. Administrators publish directly without approval.
5. TinyMCE is self-hosted under `assets/js/vendor/`.
6. Login uses Sign in with Google (Google Identity Services); progress and tutorials live in MySQL.
7. Achievement ids are append-only (data from theBowja/genshin-db).
8. Roles are Guest, Traveler, Contributor, Administrator.
9. Contributor points and badges are fully parameterized in the database and edited from an Administrator-only Points Settings page.
10. When a new version is approved, the old live version becomes Replaced.
11. A rejected version is edited in place (back to Draft) and resubmitted; no new version is created.
12. Tutorials are edit-locked per tutorial, with a 10-minute inactivity timeout and a warning 2 minutes before release.
13. Badge notices are tracked with a seen flag.
14. Point totals are computed with SUM over the ledger; no cached column.
15. Uploads record `version_id` for provenance only; cleanup is an Administrator action that scans references.
16. Administrators can force unlock a tutorial.
17. On lock timeout, the editor content is autosaved as a draft.
18. A Contributor can Withdraw a Pending Review version back to Draft.
19. A draft belongs to its creator; other Contributors cannot take it over, Administrators can; points go to the creator.
20. The version row is created at the first Save.
21. Users have a changeable `display_name` (default: Google name) used for public credit.
22. Administrators can disable accounts (`is_active`).
23. Only Administrators promote Travelers to Contributors.
24. Deleting an account keeps its tutorials, shown as "Deleted Account".
25. One YouTube video per language in version 1; Submit for Review needs text or a video in at least one language.
26. Progress sync is optimistic: the screen changes at once and rolls back, including the stage cascade, if saving fails or the user is offline.
27. Technical text (buttons, error messages, validation messages) is always English; content text (labels, descriptions, hints, achievement data, tutorials) follows the ID/EN toggle.
28. Bulk mark Inquiry runs in the browser; Apply is re-validated on the server; maximum items per action is configurable (default 2000).
29. Stage titles that differ from the achievement name are shown and searchable.
30. A single video is shown in both languages, with a note in the viewer's language saying which language the video is in.
31. Achievement data is pulled manually with a local Node script and placed in `data/` by the project owner; the app only reads it.
32. Rate limiting uses a database table (`rate_limits`) because shared hosting has no Redis; Administrator actions are recorded in `admin_audit_log`.
33. Schema v1 is frozen: no `CREATE DATABASE` inside `schema.sql` (it imports unchanged on XAMPP, cPanel and InfinityFree), all times are UTC, and later changes ship as numbered migration files tracked in `schema_migrations`.
34. Only one open version (draft, pending review or rejected) can exist per tutorial; the database enforces it with a generated column and a unique key.
35. Every tutorial save checks that `locked_by` is the user saving; a stale tab whose lock expired and was taken by someone else gets an error and cannot overwrite. No extra column is needed.
36. Runtime is PHP 8.3, minimum 8.3.36 (the php2shell patch, CVE-2026-109618 and CVE-2026-109619), or an older distribution build with that patch backported (Decisions Log 63). No framework and no Composer dependencies in version 1.
37. The site is named **Gachieve** (renamed from Genshin Achievements, Decisions Log 66); visual rules live in DESIGN.md (white and sky blue, light and dark themes, soft rounded shapes, Poppins, Phosphor icons, GSAP only).
38. Every alert, toast, confirmation and prompt uses SweetAlert2, styled with the project tokens and called only through the shared toast and modal modules.
39. Guest progress in localStorage is merged into the account automatically after sign-in.
40. Export and Import live in the Bulk Mark drawer. Import only adds progress and can be undone.
41. Bulk Undo keeps a stage when a later stage of that achievement is still done.
42. Rate limit SQL lives in `services/RateLimitService`, not `core/`, because SQL belongs only in services.
43. For smooth overlays, backdrops have no blur and the page behind a dialog is not `inert`; the focus trap and `aria-modal` cover it.
44. `schema.sql` was corrected once before any deployment to match decisions 33 and 34, and is frozen from that baseline.
45. v1 filters are status, version, has tutorial and hidden, plus sort. Status is All, Done, On progress and Not done: On progress (same label in both languages) is a multi-stage achievement with some stages done but not all, and Not done still includes it. Has tutorial and hidden are independent on/off segments in one joined track. Version and sort are dropdown buttons that open a panel; sort applies on pick and the button names a non-default order (DESIGN 4.1).
46. Per-stage notes are left out of version 1. The `stage_notes` column stays empty, so they can return later without a migration.
47. An Administrator can delete a tutorial with `admin.php?action=delete_tutorial`; its points are reversed and badges stay.
48. A version a Contributor created still grants them points when an Administrator takes it over and publishes it. Administrators themselves earn none.
49. `translation_added` applies only to a new version of a live tutorial, so a new tutorial earns `tutorial_published_new` alone.
50. The editor Preview saves the draft first and shows what the server sanitized, so it matches what readers get.
51. The look is an open sky: a morning sky in light mode and a still night sky with stars in dark mode, drawn in CSS only. Panels are see-through; only the header blurs (it supersedes the "no blur" part of 43 for the header alone). Overlays and their backdrops stay solid and unblurred.
52. Tailwind CSS is removed. No utility was in use, and its base reset is replaced by a small reset in `app.css`. CDN libraries carry SRI hashes and the CSP lists their exact package paths.
53. The sky moves (supersedes "still" in 51): every star twinkles at its own random tempo at night, and clouds from svg-clouds 1.0.1 drift by day. Both are CSS loops in `core/sky.js` and `app.css`, fewer on phones, and stop under reduced motion. They are the one atmosphere animation allowed beside the feedback animations (DESIGN 2.9, 6).
54. Rewards show the Primogem image `assets/img/primogem.png` instead of a gold icon, and the `--primogem` color token is removed. It is the owner-approved exception to the no-game-art rule (DESIGN 1, 2.3).
55. The sticky header sits on layer 40 so its account menu covers the sticky filter bar (DESIGN 2.7).
56. While a category or a filter control narrows the list, the progress summary splits into two panels: all achievements, and the narrowed set with its own count, percentage, bar and Primogems. Search and sort never narrow it (DESIGN 3.6).
57. A user's email is shown only to that user and to Administrators: the user's own account menu and welcome toast, and, for Administrators, messages that name another user (Users page, lock and open version notices, force unlock). For everyone else the server sends `null` in those email fields and the message shows the name alone. Public places such as the tutorial author line never show an email (API 2, 3, 4.2).
58. The area for tutorial work and administration is called **Studio** and lives at `/studio` (the `studio/` folder; renamed from `admin/`). Contributors and Administrators share it; Administrator-only pages sit under an "Admin" heading in its nav. `api/admin.php` keeps its name because every action in it is Administrator-only (DESIGN 3.10, 4.5).
59. Studio tooltips use tippy.js 6.3.7 with Popper 2.11.8, self-hosted in versioned folders under `assets/js/vendor/` with their source maps and MIT licenses (moved off jsDelivr so DevTools can load the source maps under the CSP, and so the CSP lists fewer outside sources). The `.htaccess` caches versioned vendor folders for a year (a new version gets a new folder) and serves `.map` as JSON. They load on Studio pages only and called only through `core/tooltip.js`. Tooltips hold plain text, use the project tokens instead of tippy's own CSS and have no animation. The first one explains the editor's "Locked by you" status. When the lock times out, the lock lost popup adds a blue info callout saying the lock is released, whether the text was saved as a draft, and how to reopen (DESIGN 3.8, 3.9, 3.12).
60. The How To Achieve modal shows the credit above the video: "Published by" with the avatar, name, top badge, date and time of the first published version, and, once a later version is live, "Last edit by" on the right with the live version's author and time. `tutorials.get` adds `avatar_url` to each author and `first_published`; no schema change (API 4.1, DESIGN 4.3). The avatar is one shared piece, `core/avatar.js`, used by the account menu too.
61. Approvals has bulk approve: a checkbox per queue row, "Select all on this page", and **Approve selected** in a sticky bar with one confirmation. The client calls the existing `reviews.approve` once per version, in order, so each version keeps its own checks; there is no bulk endpoint. A selection holds at most 30 versions (the `review` rate limit, API 6.1), kept across pages; the 31st tick is refused with a notice that names the limit. A rate limit stops the run, and versions that were not approved stay selected. Reject stays one at a time because each needs its own reason (DESIGN 4.5).
62. The writer agent is an account named Charlotte: role Contributor, email `charlotte@steambird.invalid`, picture `assets/img/charlotte.webp`, and `google_sub` `agent:charlotte`, which no Google id can match (they are digits only), so it has no sign-in path; `Auth::login` refuses it as well. The server knows it by the config key `agent.user_id` (set per server from `includes/cli/create-agent.php`), not by a schema change. It earns no points or badges; its title is always `agent.badge_title` ("Journalist"). Administrators cannot change its role or delete it (`FORBIDDEN`); Disable is its off switch. It submits through `includes/cli/agent-submit.php` (stdin JSON `{ achievement_id, content_input }`, the editor save shape), which runs open, save and submit as Charlotte through `TutorialService`, never takes over, and releases its lock on failure. On a VPS the script is the forced command of an SSH key (`command=...`, `no-pty`, `no-port-forwarding`), so the key cannot open a shell; there is no web endpoint or token. An Administrator still reviews every submission; the queue marks it with a robot chip. This replaces the earlier rule that the agent only writes draft files and a human presses Submit.
63. Distribution PHP builds keep their base version number while security patches are backported: Ubuntu 24.04 reports `8.3.6` (empty `PHP_EXTRA_VERSION`) although `8.3.6-0ubuntu0.24.04.13` and later carry `CVE-2026-109618_109619.patch`. The app cannot tell such a build from an unpatched one, so the bootstrap guard also accepts PHP older than 8.3.36 when the per-server config key `php.vendor_patched` is exactly `true` (default `false`). Set it in `config.local.php` only after `apt changelog php8.3-cli` lists both CVEs, and check again after any move to a new server or distribution release.
64. Search basics for the tracker page (M5). The per-server config key `app.url` holds the absolute public URL ending in `app.base_path` (for example `https://example.com/`); empty leaves out the canonical link, `og:url` and the sitemap. `includes/views/head.php` prints a meta description and Open Graph tags (`og:type`, `og:site_name`, `og:title`, `og:description`, `og:locale` `id_ID` with alternate `en_US`, `twitter:card` `summary`) only for pages that set `$pageDescription`, which is the tracker alone; its title is "Gachieve | Tracker Achievement Genshin Impact" and its description is Indonesian, the default language. There is no `og:image` until an image that is not game art exists. Studio pages send `noindex, nofollow`. `robots.php` and `sitemap.php` in the root are served as `/robots.txt` and `/sitemap.xml` through `.htaccess`, so no domain is written into a file: robots disallows `studio/` and names the sitemap, and the sitemap lists the tracker with `lastmod` taken from the newer data file. `api/` and `data/` stay crawlable because the tracker renders from them, but send `X-Robots-Tag: noindex`. `mod_deflate` also compresses HTML, plain text, XML and SVG. The favicon is `assets/img/favicon.svg`, the Phosphor `wind` icon (bold, MIT) of the wordmark; a favicon cannot read `app.css`, so it repeats the two `--accent` values (DESIGN 2.1, 2.2), the one place a color sits outside the tokens. Public tutorial pages with their own URLs are not part of this decision.
65. Visitor statistics use Cloudflare Web Analytics, chosen over Google Analytics 4 because it sets no cookie (so no consent banner), is lighter, and analytics plays no part in ranking. The beacon `https://static.cloudflareinsights.com/beacon.min.js` is loaded by `includes/views/head.php` with `defer` and `data-cf-beacon` holding the site token from the per-server config key `analytics.cf_beacon_token`; empty (the default) loads nothing, so local and staging send no data. It loads only on pages without `noindex`, which keeps it off the Studio. Cloudflare publishes the beacon with no version to pin, so it carries no SRI hash: the second exception beside Google's `gsi/client`. The CSP allows that exact script path in `script-src` and `https://cloudflareinsights.com/cdn-cgi/rum`, where it reports, in `connect-src`. The site does not need to be proxied through Cloudflare.
66. The product is renamed from Genshin Achievements to **Gachieve** (supersedes the name in 37). The name comes from the config key `app.name`, so the wordmark, page titles and `og:site_name` follow it. The local folder and `app.base_path` keep `genshinachievements`, the local database keeps `genshinachievements_db`, and the comment in the frozen `schema.sql` keeps the old name.
67. A privacy policy page, `privacy.php` in the root (M5). It holds the whole text in Indonesian and English as two `<article class="ui-lang-block" lang="…">` blocks, and `app.css` shows the one that matches `<html lang>`, so the ID / EN toggle switches it with no extra code. `assets/js/core/lang-init.js`, a classic script in the head of every page beside `theme-init.js`, sets `<html lang>` from the stored language before first paint, so an English reader never sees the Indonesian text first. `assets/js/tracker/privacy.js` wires only the shared header controls (theme, sky, language, header shadow) and switches the tab title. The page uses the header without tracker tools, so it has no search, Bulk Mark or Google sign-in button. It sets no `$pageDescription`, because `head.php` would point its canonical link at the tracker; it is still indexed, so the Cloudflare beacon loads there. The contact address is `admin@gachieve.com`, the policy cites Indonesia's Personal Data Protection Law (UU No. 27 Tahun 2022), and it sets no minimum age. The footer of every page links to it ("Kebijakan Privasi" / "Privacy Policy", label `privacyLink`), and the sitemap lists it with `lastmod` from the file time of `privacy.php` (extends 64). Any change to what the app collects, stores, shows or sends to a third party must update this page and its "last updated" date in both languages.

## 12. Milestones

1. **M1**: data folder and validator, list, search, filters, language toggle, Guest progress.
2. **M2**: multi-stage with dependency, `{param0}`, stats, bulk mark (Modes A and B with inquiry), export and import.
3. **M3**: Google sign-in, MySQL schema, cloud progress, merge on first login, roles.
4. **M4**: tutorial modal, TinyMCE editor, review workflow, contributor points and badges, Studio area (All Tutorials, Approvals, Points Settings, users, dashboard).
5. **M5**: security review, performance, polish, deployment to cPanel or InfinityFree.

## 13. Success Metrics

- A user can mark 50 achievements through bulk mark in under one minute.
- No progress is lost during the first-login merge.
- Share of achievements with a tutorial grows with each game version.
