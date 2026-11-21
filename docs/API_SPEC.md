# API Spec: Genshin Achievement Tracker

Draft v0.1 · Nov 5, 2026 · @Nata · Companion to the PRD and schema v1

## 1. Conventions

- **Base path**: `/api/{resource}.php?action={action}`. One file per resource, as in PRD section 9.1.
- **Methods**: only `GET` (reads, no side effects) and `POST` (every write). Shared hosting such as InfinityFree often blocks `PUT`, `PATCH` and `DELETE`, so they are not used. A wrong method returns `METHOD_NOT_ALLOWED`.
- **Body**: `POST` bodies are JSON (`Content-Type: application/json`), maximum 1 MB. The one exception is `uploads.php?action=image`, which takes `multipart/form-data`.
- **Auth**: PHP session cookie (`HttpOnly`, `SameSite=Lax`, `Secure` in production). No tokens are kept in JavaScript.
- **CSRF**: every `POST` sends header `X-CSRF-Token`. The token comes from `auth.php?action=csrf`, `me` or `login`. For `navigator.sendBeacon` (no custom headers) the token goes in the JSON body as `csrf` instead; only `editor.php?action=release` accepts that.
- **Language**: the API returns English technical text (error messages). Content (achievement text, tutorials) is returned per language and the client picks based on the ID/EN toggle.
- **Time**: every timestamp is ISO 8601 UTC, for example `2026-11-05T15:22:00Z`. The client converts to local time for display.
- **Ids**: `achievement_id` and `stage_id` are integers from the achievement JSON; database ids are integers.
- **Pagination** (list actions): `page` (default 1) and `per_page` (default 25, maximum 100). The response adds `meta: { page, per_page, total }`.

### Response envelope

Success:

```json
{ "ok": true, "data": { }, "meta": { } }
```

Error:

```json
{ "ok": false, "error": { "code": "LOCK_LOST", "message": "Your edit lock expired.", "details": { } } }
```

`meta` and `details` appear only when they carry something. The HTTP status always matches the error code (section 2).

### Roles legend

The **Who** column in each endpoint table uses: **G** Guest (no session), **T** Traveler, **C** Contributor, **A** Administrator. A higher role includes the lower ones unless noted (for example, Administrators earn no points). Disabled accounts get `ACCOUNT_DISABLED` on every call that needs a session.

## 2. Error Codes

Every error uses one of these codes. Messages are English and generic; details for debugging go to `storage/logs/app.log` only.

| Code | HTTP | When | `details` |
| --- | --- | --- | --- |
| `BAD_REQUEST` | 400 | Body is not valid JSON, unknown `action`, missing required field |  |
| `UNAUTHENTICATED` | 401 | Action needs a session and there is none or it expired |  |
| `CSRF_INVALID` | 403 | Missing or wrong `X-CSRF-Token` |  |
| `FORBIDDEN` | 403 | Role is too low, or the item belongs to someone else |  |
| `ACCOUNT_DISABLED` | 403 | Signed-in account was disabled by an Administrator |  |
| `NOT_FOUND` | 404 | Achievement, stage, version, user or file does not exist |  |
| `METHOD_NOT_ALLOWED` | 405 | `GET` on a write action or `POST` on a read action | `allowed` |
| `LOCK_HELD` | 409 | Tutorial is being edited by someone else | `locked_by_name`, `locked_by_email`, `expires_at` |
| `LOCK_LOST` | 409 | Caller no longer holds the lock (timed out, taken over or force unlocked) | `reason`: `expired`, `taken`, `force_unlocked` |
| `OPEN_VERSION_EXISTS` | 409 | Another user already has an open version (draft, pending or rejected) of this tutorial | `owner_name`, `owner_email`, `status` |
| `INVALID_STATE` | 409 | Status change not allowed from the current status (for example, approve a version that is not pending) | `current_status` |
| `PAYLOAD_TOO_LARGE` | 413 | Body over 1 MB, or upload over the size limit | `limit_bytes` |
| `UNSUPPORTED_MEDIA` | 415 | Upload is not JPEG, PNG, WebP or GIF by real MIME type | `allowed` |
| `VALIDATION_FAILED` | 422 | A field has the wrong type, length or value | `fields`: `{ name: "reason" }` |
| `TOO_MANY_ITEMS` | 422 | Bulk Apply has more stage ids than `bulk.max_items` | `max_items` |
| `RATE_LIMITED` | 429 | Too many requests in the window (section 6); also sends `Retry-After` header | `retry_after_seconds` |
| `SERVER_ERROR` | 500 | Anything unexpected; logged with a request id | `request_id` |

## 3. Auth, Progress and Bulk

The `user` object returned by auth calls is `{ id, display_name, avatar_url, role, created_at }`. Email and `google_sub` never leave the server except the user's own email in `me`, and other users' emails sent to Administrators only: `users.php?action=list`, and the `*_email` fields of `LOCK_HELD`, `OPEN_VERSION_EXISTS` and the editor `list` lock. Those `*_email` fields are `null` for every other caller and for a deleted account (Decisions Log 57).

### 3.1 `auth.php`

| Action | Method | Who | Request | Response `data` |
| --- | --- | --- | --- | --- |
| `csrf` | GET | G |  | `{ csrf }` |
| `me` | GET | G |  | `{ user \| null, email \| null, csrf }` |
| `login` | POST | G | `{ credential }` (Google ID token) | `{ user, csrf, is_new }` |
| `logout` | POST | T |  | `{}` |

- `login` verifies the token (audience = configured client id, issuer Google, not expired), creates the user on first sign-in as Traveler (or Administrator if the email is in `auth.bootstrap_admin_emails`), regenerates the session id and returns a fresh CSRF token. A disabled account gets `ACCOUNT_DISABLED`.
- `is_new` is used only for a welcome message; Guest progress in localStorage is always imported automatically after login (see `progress.import`).
- `me` answers `ACCOUNT_DISABLED` once when the session belongs to a disabled account, and ends that session, so the client can show its popup. Later calls are plain Guest calls.

### 3.2 `progress.php`

| Action | Method | Who | Request | Response `data` |
| --- | --- | --- | --- | --- |
| `list` | GET | T |  | `{ stage_ids: [int] }` |
| `set` | POST | T | `{ stage_id, done: bool }` | `{ added: [int], removed: [int] }` |
| `import` | POST | T | `{ stage_ids: [int] }` | `{ added_count }` |

- **Cascade lives on the server.** `done: true` marks that stage and every earlier stage of the same achievement; `done: false` unmarks that stage and every later one. The response lists exactly what changed so the client can confirm its optimistic update.
- Unknown `stage_id` returns `NOT_FOUND`; the server checks ids through `AchievementCatalog`.
- `import` merges Guest progress from localStorage after sign-in: union only (never removes), cascade applied, unknown ids skipped silently. Same `bulk.max_items` cap. The client clears localStorage progress only after `ok: true`.

### 3.3 `bulk.php`

Inquiry (matching names, building the Found / Not found / Ambiguous / Invalid format / Already done report) runs in the browser. The server only receives the final stage ids.

| Action | Method | Who | Request | Response `data` |
| --- | --- | --- | --- | --- |
| `apply` | POST | T | `{ stage_ids: [int] }` | `{ history_id, added_count, already_done_count }` |
| `undo` | POST | T | `{ history_id }` | `{ removed_count }` |
| `last` | GET | T |  | `{ history_id, count, created_at, can_undo } \| null` |

- `apply` is **all or nothing** in one transaction. Any unknown id rejects the whole call with `VALIDATION_FAILED` and `details.fields.stage_ids` listing the bad ids. More than `bulk.max_items` (default 2000) returns `TOO_MANY_ITEMS`.
- Cascade applies (marking a stage also marks earlier stages). `bulk_history.stage_ids` stores only the ids **newly added** by this action, so `undo` never removes progress that existed before.
- `undo` works only on the caller's latest, not-yet-undone action; otherwise `INVALID_STATE`. Saving a new action deletes the older history row.
- Guests run bulk mark entirely in the browser and keep their single undo snapshot in localStorage.

## 4. Tutorials, Editor, Reviews and Uploads

A **translation** object is `{ body_html, video: { provider: "youtube", video_id, embed_url } | null }`, with `body_html` already sanitized. A **content** object is `{ id: translation | null, en: translation | null }`. An **author** is `{ display_name, top_badge_title | null }`, or `{ display_name: "Deleted Account", top_badge_title: null }`.

### 4.1 `tutorials.php` (public)

| Action | Method | Who | Request | Response `data` |
| --- | --- | --- | --- | --- |
| `index` | GET | G |  | `[{ achievement_id, langs: ["id","en"], has_video }]` |
| `get` | GET | G | `?achievement_id=` | `{ achievement_id, version_no, published_at, author, first_published, content } \| null` |

- `index` lets cards show a tutorial icon without loading every tutorial; it sends `ETag` and `Cache-Control: max-age=300`.
- `get` returns only the live (published) version. `null` means no tutorial yet; the client shows the default notice. Here each `author` also has `avatar_url` (`null` for a deleted account or no picture). `author` and `published_at` belong to the live version; `first_published` is `{ published_at, author }` of the first version ever published, or `null` while the live version is that first one. The modal shows them as Published by and Last edit by (DESIGN 4.3). The single-video rule (show it in both languages with a note) is applied by the client from `content`.

### 4.2 `editor.php` (Contributor, Administrator)

| Action | Method | Who | Request | Response `data` |
| --- | --- | --- | --- | --- |
| `list` | GET | C | `?q=&state=&page=&per_page=` | `[{ achievement_id, name_id, name_en, live, open_version, lock }]` + `meta` |
| `open` | POST | C | `{ achievement_id, take_over?: bool }` | `{ tutorial_id, version_id \| null, status \| null, content, rejection_reason \| null, lock }` |
| `heartbeat` | POST | C | `{ tutorial_id, active: bool }` | `{ lock }` |
| `save` | POST | C | `{ tutorial_id, content_input, autosave: bool }` | `{ version_id, version_no, status, saved_at }` |
| `submit` | POST | C | `{ tutorial_id }` | `{ version_id, status: "pending_review" }` |
| `publish` | POST | A | `{ tutorial_id }` | `{ version_id, status: "published" }` |
| `withdraw` | POST | C | `{ version_id }` | `{ version_id, status: "draft" }` |
| `discard` | POST | C | `{ version_id }` | `{}` |
| `release` | POST | C | `{ tutorial_id }` (sendBeacon allowed) | `{}` |

- **`list`** is built from the achievement JSON joined with tutorial state, so every achievement appears. `state` filter: `none`, `live`, `draft`, `pending_review`, `rejected`, `locked`. `lock` is `{ held_by_name, held_by_email, expires_at } | null`; `held_by_email` is `null` unless the caller is an Administrator. Each row also has `tutorial_id` (`null` until a tutorial row exists), `live` is `{ version_no, published_at, author } | null` and `open_version` is `{ version_id, version_no, status, created_at, owner_id, author } | null`.
- **`open`** takes the lock (creating the `tutorials` row on first use). It returns `LOCK_HELD` if someone else holds a fresh lock, and `OPEN_VERSION_EXISTS` if another user owns the open version. An Administrator may pass `take_over: true` to edit that version; ownership and points stay with the creator. A `pending_review` version stays closed for everyone and returns `INVALID_STATE`; its owner uses `withdraw` first. If there is no open version, `content` is a copy of the live version as the starting point. `lock` is `{ expires_at, timeout_seconds, warn_before_seconds, heartbeat_seconds }`.
- **`heartbeat`** is sent every `heartbeat_seconds`. `active: true` means the user typed or clicked since the last beat; only then is `last_activity_at` moved forward. Lost lock returns `LOCK_LOST`.
- **`save`** first checks `tutorials.locked_by` equals the caller and the lock is fresh, otherwise `LOCK_LOST` (stale tabs can never overwrite). The first save creates the version row as `draft`; a `rejected` version goes back to `draft`. `content_input` is `{ id: { body_html, video_url } | null, en: { … } | null }`; the server sanitizes HTML and parses `video_url` into a YouTube id (`VALIDATION_FAILED` if not YouTube). Autosave on the 2-minute warning and on timeout uses the same action with `autosave: true`.
- **`submit`** needs text or a video in at least one language (`VALIDATION_FAILED` otherwise), moves `draft` to `pending_review`, writes a `tutorial_reviews` row and releases the lock.
- **`publish`** is the Administrator path: the open version becomes `published`, the old live version becomes `replaced`, `tutorials.live_version_id` moves, the lock is released. Administrators earn no points, but a version a Contributor created and an Administrator took over still grants its points to that Contributor (Decisions Log 19).
- **`withdraw`** (version owner only) moves `pending_review` back to `draft`. **`discard`** deletes an open version (owner or Administrator); its uploaded images are left for the image cleanup.
- **`release`** drops the lock when the editor closes; the client saves first. It accepts CSRF in the body because it is called with `navigator.sendBeacon`.

### 4.3 `reviews.php` (Administrator)

| Action | Method | Who | Request | Response `data` |
| --- | --- | --- | --- | --- |
| `queue` | GET | A | `?page=&per_page=` | `[{ version_id, achievement_id, name_id, name_en, version_no, created_by_name, created_by_is_agent, submitted_at, is_update, langs }]` + `meta` |
| `get` | GET | A | `?version_id=` | `{ proposed: content, live: content \| null, history: [review] }` |
| `approve` | POST | A | `{ version_id }` | `{ status: "published", points: [{ event_key, points }], badges: [badge_key] }` |
| `reject` | POST | A | `{ version_id, reason }` | `{ status: "rejected" }` |

- Both writes check the version is still `pending_review` (`INVALID_STATE` otherwise), so two Administrators cannot act on it twice.
- `approve` runs in one transaction: version `published`, old live `replaced`, `live_version_id` moved, review row written, points granted to the creator through `PointsService` (the ledger unique key stops double awards), badges checked.
- `reject` needs `reason` of 1 to 1000 characters; the Contributor sees it in `editor.open` as `rejection_reason`.
- A review is `{ from_status, to_status, actor_name, reason, created_at }`.

### 4.4 `uploads.php` (Contributor, Administrator)

| Action | Method | Who | Request | Response |
| --- | --- | --- | --- | --- |
| `image` | POST | C | multipart: `file`, `tutorial_id` | `{ location }` |

- Response is TinyMCE's expected shape, `{ "location": "/uploads/2026/11/05/<random>.webp" }`, not the envelope. Errors still use the normal error envelope.
- Requires the caller to hold the lock on `tutorial_id`. Checks real MIME type (JPEG, PNG, WebP, GIF) and `uploads.max_bytes` (default 2 MB), stores under a random name in `uploads/YYYY/MM/DD/`, writes an `uploads` row with the open `version_id` as provenance.

## 5. Users, Points and Admin

Every Administrator write in this section also writes an `admin_audit_log` row (action key in brackets).

### 5.1 `users.php`

| Action | Method | Who | Request | Response `data` |
| --- | --- | --- | --- | --- |
| `update_profile` | POST | T | `{ display_name }` | `{ user }` |
| `delete_me` | POST | T | `{ confirm: "DELETE" }` | `{}` |
| `list` | GET | A | `?q=&role=&active=&page=&per_page=` | `[{ id, display_name, email, avatar_url, is_agent, top_badge_title, role, is_active, points, created_at, last_login_at }]` + `meta` |
| `set_role` | POST | A | `{ user_id, role }` | `{ user }` \[`role_change`\] |
| `set_active` | POST | A | `{ user_id, active: bool }` | `{ user }` \[`account_disable` / `account_enable`\] |
| `delete` | POST | A | `{ user_id }` | `{}` \[`account_delete`\] |

- `display_name`: 2 to 40 characters after trimming, no control characters.
- `delete_me` and `delete` remove the user and their progress, keep their tutorials (author shows as "Deleted Account"), release any lock they hold and end their session.
- An Administrator cannot change their own role, disable or delete themselves (`FORBIDDEN`), so there is always at least one Administrator.
- The writer agent (`is_agent: true`, PRD Decisions Log 62) cannot get a new role or be deleted (`FORBIDDEN`); `set_active` works on it. Its `top_badge_title` is always the configured title ("Journalist"), and it never earns points.
- A disabled user gets `ACCOUNT_DISABLED` on their next request; their lock is released.

### 5.2 `points.php`

| Action | Method | Who | Request | Response `data` |
| --- | --- | --- | --- | --- |
| `mine` | GET | C |  | `{ total, badges: [{ id, badge_key, title, awarded_at, seen }], next_badge: { title, min_points, remaining } \| null, recent: [ledger] }` |
| `mark_seen` | POST | C | `{ badge_ids: [int] }` | `{}` |
| `settings` | GET | A |  | `{ rules: [rule], badges: [badge] }` |
| `save_rule` | POST | A | `{ event_key, points, is_active }` | `{ rule }` \[`points_settings_change`\] |
| `save_badge` | POST | A | `{ id?, badge_key, title, min_points, sort_order, is_active }` | `{ badge }` \[`points_settings_change`\] |

- `total` is `SUM(points)` from `point_ledger`; `recent` holds the last 20 entries `{ event_key, entry_type, points, created_at }`.
- Unseen badges (`seen: false`) let the client show a "new badge" popup once, then call `mark_seen`.
- Changing rules affects future awards only; badges are turned off with `is_active`, never deleted.
- Administrators calling `mine` get `total: 0` and no badges, since they earn no points.

### 5.3 `admin.php` (Administrator)

| Action | Method | Who | Request | Response `data` |
| --- | --- | --- | --- | --- |
| `dashboard` | GET | A |  | `{ users_by_role, pending_reviews, published_tutorials, active_locks }` |
| `force_unlock` | POST | A | `{ tutorial_id }` | `{}` \[`force_unlock`\] |
| `delete_tutorial` | POST | A | `{ tutorial_id }` | `{}` \[`tutorial_delete`\] |
| `audit` | GET | A | `?filter_action=&actor_id=&page=&per_page=` | `[{ actor_name, action, target_type, target_id, detail, created_at }]` + `meta` |
| `cleanup_images` | POST | A | `{ dry_run: bool }` | `{ scanned, unused: [path], deleted_count, freed_bytes }` \[`image_cleanup`, only when not a dry run\] |

- After `force_unlock`, the previous holder's next heartbeat or save gets `LOCK_LOST` with `reason: "force_unlocked"`; their client keeps the unsaved text locally so it is not lost.
- `delete_tutorial` removes the tutorial with all its versions and writes a reversal ledger entry for every award those versions earned; badges stay. It returns `LOCK_HELD` while someone else holds a fresh lock, so force unlock comes first. Images are left for the image cleanup.
- `cleanup_images` deletes only files not referenced in any `body_html` and older than 24 hours. The client always shows the dry-run list first.

## 6. Limits, Timing and Client Rules

### 6.1 Rate limits (config defaults)

Keyed by user id when signed in, otherwise by IP (both hashed in `rate_limits`). All values live in config under `rate_limit.*`.

| Group | Actions | Limit |
| --- | --- | --- |
| `login` | `auth.login` | 10 per 10 minutes per IP |
| `progress` | `progress.set` | 120 per minute |
| `bulk` | `bulk.apply`, `bulk.undo`, `progress.import` | 10 per 10 minutes |
| `editor` | `editor.save`, `editor.heartbeat` | 60 per minute |
| `upload` | `uploads.image` | 30 per 10 minutes |
| `review` | `reviews.approve`, `reviews.reject`, `editor.submit`, `editor.publish` | 30 per 10 minutes |
| `default` | every other action | 300 per minute |

### 6.2 Lock and editor timing (config defaults)

| Key | Default | Meaning |
| --- | --- | --- |
| `lock.timeout_seconds` | 600 | Inactivity before the lock counts as free |
| `lock.warn_before_seconds` | 120 | Warning popup this long before expiry |
| `lock.heartbeat_seconds` | 60 | How often the editor sends `heartbeat` |
| `editor.autosave_seconds` | 30 | Background autosave interval while there are unsaved changes |
| `bulk.max_items` | 2000 | Stage ids per bulk Apply or import |
| `uploads.max_bytes` | 2097152 | 2 MB per image |

### 6.3 Client rules

- **One client.** Every call goes through `assets/js/core/api.js`, which adds the CSRF header, parses the envelope and throws a typed error carrying `code`.
- **Optimistic progress.** The card changes at once (including the cascade); on any error or when offline it rolls back to the state before the click and shows a toast. When `progress.set` succeeds, the client applies the server's `added` and `removed` lists as the final truth.
- **`CSRF_INVALID`**: fetch a fresh token with `auth.csrf` and retry the call once.
- **`UNAUTHENTICATED`** on a tracker call: switch to Guest mode with a toast; nothing is written to localStorage until the user chooses. In the editor: keep the text locally and ask the user to sign in again.
- **`LOCK_LOST`**: stop autosave and heartbeat, keep the editor text in memory, show a popup with Copy to clipboard and Reopen.
- **`RATE_LIMITED`**: wait `retry_after_seconds` before the next try; never retry in a tight loop.
- **Messages**: show `error.message` (English) for technical errors; content text follows the ID/EN toggle.

### 6.4 Decisions

- Guest progress import runs **automatically** right after sign-in: if localStorage holds progress, the client calls `progress.import` without asking, then clears it on success and shows a toast with `added_count`.
- Rate limit numbers in 6.1 are accepted as starting values; tune after testing on the real host.
