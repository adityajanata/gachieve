-- =============================================================================
-- Genshin Achievement Tracker - database schema (MySQL 5.7+ / MariaDB 10.3+)
-- Select the target database first, then run: schema.sql, then seed_points.sql.
-- Local XAMPP only: database/create_database.sql creates the database.
-- This file has no CREATE DATABASE, so it imports unchanged on XAMPP, cPanel and
-- InfinityFree. All DATETIME values are UTC (connection time_zone = '+00:00').
-- Achievement content itself lives in data/achievements.{id,en}.json (SSoT).
-- The database only stores references to it:
--   achievement_id = first stage id (id[0]) of an achievement
--   stage_id       = id of one stage
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- users: signed-in accounts (Google). Guests are never stored here.
-- Deleting an account removes the row; ON DELETE rules then remove progress,
-- ledger entries, badges and bulk history, and set created_by / actor_id /
-- uploaded_by / locked_by to NULL. Tutorials stay; a NULL author is shown as
-- "Deleted Account".
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    google_sub    VARCHAR(64)     NOT NULL,
    email         VARCHAR(255)    NOT NULL,
    name          VARCHAR(255)    NOT NULL,            -- name from Google
    display_name  VARCHAR(100)    NOT NULL,            -- public name; defaults to name, user can change
    avatar_url    VARCHAR(512)    NULL,
    role          ENUM('traveler', 'contributor', 'administrator')
                                  NOT NULL DEFAULT 'traveler',
    is_active     TINYINT(1)      NOT NULL DEFAULT 1,  -- 0 = disabled, cannot sign in
    created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at DATETIME        NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_google_sub (google_sub),
    UNIQUE KEY uq_users_email (email),
    KEY idx_users_role (role)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- progress: completed stages per user
-- Stage dependency (stage 3 implies 1 and 2) is enforced by the application,
-- which writes every implied stage row.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS progress (
    user_id      BIGINT UNSIGNED NOT NULL,
    stage_id     INT UNSIGNED    NOT NULL,
    completed_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, stage_id),
    KEY idx_progress_stage (stage_id),
    CONSTRAINT fk_progress_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- tutorials: one row per achievement. live_version_id points to the version
-- currently shown to everyone (must have status = published; enforced in app).
--
-- Edit lock: only one person may edit a tutorial at a time.
--   is_locked        set to 1 when someone opens the editor, back to 0 on
--                    submit / publish / release / timeout / force unlock.
--                    Save keeps the lock.
--   last_activity_at refreshed by the editor heartbeat.
-- A browser that crashes cannot release its own lock, so the flag alone is
-- never trusted: the app treats a lock as free when
--   is_locked = 0  OR  last_activity_at < NOW() - lock timeout (default 10 min).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tutorials (
    id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    achievement_id   INT UNSIGNED    NOT NULL,
    live_version_id  BIGINT UNSIGNED NULL,
    is_locked        TINYINT(1)      NOT NULL DEFAULT 0,
    locked_by        BIGINT UNSIGNED NULL,
    locked_at        DATETIME        NULL,
    last_activity_at DATETIME        NULL,
    created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_tutorials_achievement (achievement_id),
    KEY idx_tutorials_locked_by (locked_by),
    CONSTRAINT fk_tutorials_locked_by
        FOREIGN KEY (locked_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- tutorial_versions: every draft / pending / published / rejected / replaced
-- revision. A new edit of a published tutorial creates a new row; the live
-- version stays in tutorials.live_version_id until the new one is approved,
-- at which point the old live version becomes 'replaced' (history only).
-- A rejected version returns to 'draft' when the Contributor edits it again.
-- open_tutorial_id + uq_versions_one_open: at most one open version (draft,
-- pending_review or rejected) per tutorial. It is VIRTUAL because a STORED
-- generated column cannot sit on a column with an ON DELETE CASCADE foreign key.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tutorial_versions (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    tutorial_id  BIGINT UNSIGNED NOT NULL,
    version_no   INT UNSIGNED    NOT NULL,
    status       ENUM('draft', 'pending_review', 'published', 'rejected', 'replaced')
                                 NOT NULL DEFAULT 'draft',
    created_by   BIGINT UNSIGNED NULL,
    created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    submitted_at DATETIME        NULL,
    published_at DATETIME        NULL,
    open_tutorial_id BIGINT UNSIGNED GENERATED ALWAYS AS (
        CASE WHEN status IN ('draft', 'pending_review', 'rejected')
             THEN tutorial_id ELSE NULL END
    ) VIRTUAL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_versions_tutorial_no (tutorial_id, version_no),
    UNIQUE KEY uq_versions_one_open (open_tutorial_id),
    KEY idx_versions_status (status),
    KEY idx_versions_creator (created_by),
    CONSTRAINT fk_versions_tutorial
        FOREIGN KEY (tutorial_id) REFERENCES tutorials (id) ON DELETE CASCADE,
    CONSTRAINT fk_versions_creator
        FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- tutorials.live_version_id references tutorial_versions (circular), so the
-- constraint is added after both tables exist.
ALTER TABLE tutorials
    ADD CONSTRAINT fk_tutorials_live_version
        FOREIGN KEY (live_version_id) REFERENCES tutorial_versions (id)
        ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- tutorial_translations: content per language, per version.
-- One language is enough; a missing row means "not available in that language".
-- body_html is sanitized by the server (allowlist) BEFORE it is stored.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tutorial_translations (
    version_id     BIGINT UNSIGNED NOT NULL,
    lang           ENUM('id', 'en') NOT NULL,
    body_html      MEDIUMTEXT       NULL,
    video_provider VARCHAR(20)      NULL,   -- allowlist, e.g. youtube
    video_id       VARCHAR(64)      NULL,   -- id only; embed URL is built server-side
    stage_notes    JSON             NULL,   -- {"80212": "note", "80213": "note"}
    PRIMARY KEY (version_id, lang),
    CONSTRAINT fk_translations_version
        FOREIGN KEY (version_id) REFERENCES tutorial_versions (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- tutorial_reviews: audit log of every status change
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tutorial_reviews (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    version_id  BIGINT UNSIGNED NOT NULL,
    from_status ENUM('draft', 'pending_review', 'published', 'rejected', 'replaced') NULL,
    to_status   ENUM('draft', 'pending_review', 'published', 'rejected', 'replaced') NOT NULL,
    actor_id    BIGINT UNSIGNED NULL,
    reason      TEXT            NULL,   -- required by the app when rejecting
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_reviews_version (version_id),
    KEY idx_reviews_actor (actor_id),
    CONSTRAINT fk_reviews_version
        FOREIGN KEY (version_id) REFERENCES tutorial_versions (id) ON DELETE CASCADE,
    CONSTRAINT fk_reviews_actor
        FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- point_rules: configurable point values (edited from Points Settings)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS point_rules (
    event_key   VARCHAR(64)  NOT NULL,
    label       VARCHAR(255) NOT NULL,
    points      INT          NOT NULL DEFAULT 0,
    is_active   TINYINT(1)   NOT NULL DEFAULT 1,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                             ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (event_key)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- badges: configurable milestones (edited from Points Settings)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS badges (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    badge_key   VARCHAR(64)  NOT NULL,
    title       VARCHAR(100) NOT NULL,
    min_points  INT UNSIGNED NOT NULL,
    sort_order  INT          NOT NULL DEFAULT 0,
    is_active   TINYINT(1)   NOT NULL DEFAULT 1,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                             ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_badges_key (badge_key),
    KEY idx_badges_threshold (is_active, min_points)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- point_ledger: every point change. Unique per user + event + version + type,
-- so approving the same version twice can never double-count. A reversal is a
-- separate entry (entry_type = 'reversal') with negative points.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS point_ledger (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id     BIGINT UNSIGNED NOT NULL,
    event_key   VARCHAR(64)     NOT NULL,
    entry_type  ENUM('award', 'reversal') NOT NULL DEFAULT 'award',
    points      INT             NOT NULL,   -- negative for reversals
    version_id  BIGINT UNSIGNED NOT NULL,
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_ledger_once (user_id, event_key, version_id, entry_type),
    KEY idx_ledger_user (user_id),
    KEY idx_ledger_version (version_id),
    CONSTRAINT fk_ledger_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_ledger_event
        FOREIGN KEY (event_key) REFERENCES point_rules (event_key) ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- user_badges: badges earned (kept even if points are later reversed).
-- seen_at stays NULL until the user has seen the congratulation notice.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_badges (
    user_id    BIGINT UNSIGNED NOT NULL,
    badge_id   INT UNSIGNED    NOT NULL,
    awarded_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    seen_at    DATETIME        NULL,
    PRIMARY KEY (user_id, badge_id),
    CONSTRAINT fk_user_badges_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_user_badges_badge
        FOREIGN KEY (badge_id) REFERENCES badges (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- uploads: tracking of tutorial images stored in uploads/YYYY/MM/DD/
-- version_id = the version being edited at upload time (provenance only).
-- Versions copy content from each other, so one image can be used by many
-- versions: version_id NEVER decides deletion. Cleanup scans every
-- tutorial_translations.body_html for references and removes files that nothing
-- references and that are older than 24 hours.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS uploads (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    path        VARCHAR(255)    NOT NULL,   -- relative, e.g. 2026/11/03/ab12cd.webp
    mime        VARCHAR(100)    NOT NULL,
    size_bytes  INT UNSIGNED    NOT NULL,
    uploaded_by BIGINT UNSIGNED NULL,
    version_id  BIGINT UNSIGNED NULL,
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_uploads_path (path),
    KEY idx_uploads_user (uploaded_by),
    KEY idx_uploads_version (version_id),
    CONSTRAINT fk_uploads_user
        FOREIGN KEY (uploaded_by) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT fk_uploads_version
        FOREIGN KEY (version_id) REFERENCES tutorial_versions (id) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- bulk_history: last bulk-mark action per signed-in user, for Undo.
-- Guests keep their undo snapshot in localStorage instead.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bulk_history (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id    BIGINT UNSIGNED NOT NULL,
    stage_ids  JSON            NOT NULL,   -- stages newly marked by this action
    created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    undone_at  DATETIME        NULL,
    PRIMARY KEY (id),
    KEY idx_bulk_user (user_id, created_at),
    CONSTRAINT fk_bulk_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- rate_limits: fixed-window request counters (shared hosting has no Redis).
-- rate_key = SHA-256 of action + IP or user id; raw IPs are never stored.
-- Old rows are purged daily.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rate_limits (
    rate_key     CHAR(64)     NOT NULL,
    window_start DATETIME     NOT NULL,
    hits         INT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (rate_key),
    KEY idx_rate_limits_window (window_start)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- admin_audit_log: trail of Administrator actions. actor_name is a snapshot, so
-- entries stay readable after the account is deleted.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    actor_id    BIGINT UNSIGNED NULL,
    actor_name  VARCHAR(100)    NOT NULL,
    action      VARCHAR(64)     NOT NULL,
    target_type VARCHAR(64)     NULL,
    target_id   BIGINT UNSIGNED NULL,
    detail      JSON            NULL,
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_audit_action (action, created_at),
    KEY idx_audit_actor (actor_id, created_at),
    CONSTRAINT fk_audit_actor
        FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- schema_migrations: migration files applied on top of this v1 baseline.
-- Later changes ship as database/migrations/0002_*.sql and onward.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_migrations (
    version    VARCHAR(64) NOT NULL,
    applied_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (version)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

INSERT IGNORE INTO schema_migrations (version) VALUES ('0001_schema_v1');

SET FOREIGN_KEY_CHECKS = 1;
