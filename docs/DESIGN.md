# DESIGN.md: Genshin Achievements

Version 0.1 · 2026-11-05 · Companion to the PRD, schema v1 and API Spec v0.1

This document fixes how Genshin Achievements looks, moves and behaves. It holds rules and values, not code. When code and this document disagree, this document wins until it is updated.

---

## 1. Design Direction

**Design read:** a fan-made achievement tracker (product UI, not a landing page) for Genshin Impact players on phone and desktop. The language is airy and calm: the page sits under an open sky (a bright morning sky with slowly drifting clouds in light mode, a night sky of twinkling stars in dark mode), panels are see-through so the sky shows through, sky blue is the one accent, shapes are soft and rounded, a quiet Anemo / Mondstadt feeling without official game art (the Primogem image is the one exception). The sky is drawn with CSS gradients plus a living layer of stars and clouds (2.9), never with images, and it stands still under reduced motion.

| Dial | Value | Why |
| --- | --- | --- |
| Design variance | 4 | A tool people use daily; predictable layout beats surprise |
| Motion intensity | 4 | Motion only for feedback and state changes, plus the slow living sky behind everything |
| Visual density | 5 | 1,558 achievements need a compact list, but rows still breathe |

**Principles**

1. **The list is the product.** Every pixel above the list must earn its place.
2. **One accent, one radius system, one icon family.** Consistency is the brand.
3. **Feedback is instant.** A click changes the screen at once (optimistic), and a failure is explained, never silent.
4. **Content follows the language toggle; technical text stays English.** Buttons, errors and validation messages are English. Labels, descriptions, hints and tutorials follow ID / EN.
5. **Readable first.** Every text and control meets WCAG AA in both themes.

**Fan-site rules**

- Footer always shows: "Fan-made project. Not affiliated with HoYoverse."
- No official game logos, character art, achievement icons or HoYoverse fonts. Visual flavor comes from color, shape and Phosphor icons only.
- **One owner-approved exception:** the Primogem currency image (`assets/img/primogem.png`) marks rewards next to their numbers. It is never used as decoration, a logo or a background (see 2.3).

---

## 2. Design Tokens

All tokens are CSS variables defined once in `assets/css/app.css` (`:root` for light, `[data-theme="dark"]` for dark). There is no CSS framework; every component reads these variables.

Contrast figures are worst cases: the text on a see-through panel, composited over the lightest and the darkest point of that theme's sky.

### 2.1 Color: Light ("Day Sky", default)

| Token | Value | Use | Contrast |
| --- | --- | --- | --- |
| `--page-sky` | gradient `#BDE2FF` to `#F2F9FF` with four soft haze ellipses | The fixed sky layer behind the page; drifting clouds sit above it (2.9) | |
| `--cloud-back`, `--cloud-mid`, `--cloud-front` | `rgb(252 254 255 / 0.95)`, `rgb(222 236 248 / 0.9)`, `rgb(190 212 232 / 0.85)` | The three layers of each drifting cloud, bright top to cooler underside | decorative |
| `--bg` | `#E4F3FF` | Fallback under the sky | |
| `--surface` | `rgb(252 254 255 / 0.78)` | Rows, panels, sidebar, inputs | |
| `--surface-muted` | `rgb(226 240 251 / 0.82)` | Segmented tracks, hover fill, skeleton | |
| `--surface-solid` | `#FCFEFF` | Anything that floats: modals, sheets, menus, dropdowns, toasts, popups, the editor | |
| `--bar` | `rgb(240 248 255 / 0.97)` | Sticky bars that rows scroll under | |
| `--header-glass` | `rgb(244 250 255 / 0.62)` | The header, with its blur | |
| `--border` | `rgb(150 190 224 / 0.5)` | Dividers and container outlines (decorative) | |
| `--border-strong` | `#5D82A1` | Input, checkbox and toggle outlines | 3.4:1 |
| `--text` | `#0E2233` | Primary text | 13.6:1 |
| `--text-muted` | `#45607A` | Descriptions, secondary text | 5.5:1 |
| `--text-subtle` | `#4A667C` | Hints, placeholders, timestamps | 5.1:1 |
| `--accent` | `#0868A3` | Primary buttons, checked boxes, links, focus ring | 5.0:1, white text 5.9:1 |
| `--accent-strong` | `#075C8F` | Accent text on `--accent-soft`, pressed state | 6.0:1 |
| `--accent-soft` | `#DDF0FC` | Selected chip, active nav item, done-row tint | |
| `--sky` | `#38BDF8` | Decorative only: progress bar fill. Never text | |
| `--danger` | `#C2352B` | Errors, destructive actions | 4.6:1 |
| `--warning` | `#935104` | Lock warning, offline banner text | 5.1:1 |

### 2.2 Color: Dark ("Night Sky")

| Token | Value | Contrast |
| --- | --- | --- |
| `--page-sky` | gradient `#1B2A5C` to `#070D1F` with a faint glow at the top right; no painted stars, every star is a twinkling element (2.9) | |
| `--star` | `rgb(232 240 255)` | decorative |
| `--bg` | `#0B1430` | |
| `--surface` | `rgb(16 30 62 / 0.72)` | |
| `--surface-muted` | `rgb(34 54 100 / 0.55)` | |
| `--surface-solid` | `#101E3E` | |
| `--bar` | `rgb(11 20 48 / 0.97)` | |
| `--header-glass` | `rgb(11 20 48 / 0.55)` | |
| `--border` | `rgb(120 160 230 / 0.18)` | |
| `--border-strong` | `#6A8DC6` | 3.4:1 |
| `--text` | `#E8F0FF` | 9.9:1 |
| `--text-muted` | `#B4C4E0` | 6.4:1 |
| `--text-subtle` | `#9DB1D4` | 4.6:1 |
| `--accent` | `#5CC8FF` | 6.0:1; text on accent buttons uses `#062435` (8.5:1) |
| `--accent-strong` | `#9ADCFF` | 6.7:1 on `--accent-soft` |
| `--accent-soft` | `rgb(92 200 255 / 0.18)` | |
| `--sky` | `#5CC8FF` | |
| `--danger` | `#FF8A7F` | 5.0:1 |
| `--warning` | `#F2B45A` | 6.2:1 |

### 2.3 Color rules

- **Sky blue is the only accent.** It is used the same way on every page, tracker and admin alike.
- **Done state uses the accent**, not green. A completed row gets an `--accent-soft` tint and a filled accent checkbox.
- **Semantic colors** (`--danger`, `--warning`) appear only for real states (error, destructive, lock, offline), never as decoration.
- **The Primogem image is the single documented exception** to the one-accent palette: `assets/img/primogem.png`, 16 px in rows and 20 px in the progress summary, always decorative (`alt=""`) beside its number. The number uses `--text`. There is no gold color token, and gold is never used on buttons, borders or backgrounds.
- **No pure `#000` or `#fff`**, no glow, no neon, no gradient text, no purple.
- **Shadows are tinted with the sky hue**, never black (see 2.6).
- **The night sky stays blue, never purple.** Its hue sits around navy so it does not drift into the purple-and-black default.
- **Glass is one surface only:** the header blurs what scrolls under it. Every other panel is see-through without blur, overlays are solid, and backdrops never blur (3.7).

### 2.4 Typography

**Poppins** for all interface text (weights 400, 500, 600, 700) and **JetBrains Mono** (400) only in the bulk mark JSON textarea. Both are loaded from Google Fonts with `display=swap`. All numbers use `font-variant-numeric: tabular-nums`.

| Token | Size / line height | Weight | Use |
| --- | --- | --- | --- |
| `display` | 30 / 36 | 700 | Overall progress percentage |
| `h1` | 24 / 32 | 600 | Page title (Studio pages, profile) |
| `h2` | 20 / 28 | 600 | Modal title, drawer title, section title |
| `h3` | 16 / 24 | 600 | Achievement name, category name |
| `body` | 15 / 24 | 400 | Default text, tutorial body |
| `small` | 14 / 20 | 400 | Descriptions, table cells (admin), inputs |
| `caption` | 12 / 16 | 500 | Version chip, timestamps, counters |
| `button` | 14 / 20 | 600 | All button labels |

- Body text max width 65 characters (tutorial body, descriptions in wide layouts).
- No uppercase tracking labels above sections. Headings alone are enough.
- Emphasis inside text uses Poppins 600, never another family.

### 2.5 Spacing, size and layout

- **Base unit 4 px.** Allowed steps: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.
- **Touch target** minimum 44 × 44 px for every interactive element on touch screens (checkbox hit area included).
- **Breakpoints:** `sm` 640, `md` 768, `lg` 1024, `xl` 1280.
- **Content width:** max 1280 px, centered, side padding 16 px (mobile) and 24 px (`md` and up).
- **Header height:** 56 px mobile, 64 px desktop.
- Full-height layouts use `min-height: 100dvh`, never `100vh`.

### 2.6 Radius and elevation

| Token | Value | Applies to |
| --- | --- | --- |
| `--radius-pill` | 9999 px | Buttons, chips, segmented toggles, search field, badges |
| `--radius-input` | 12 px | Inputs, selects, textareas, TinyMCE frame, checkboxes (6 px, see 3.3) |
| `--radius-card` | 16 px | Panels, list containers, sidebar, toasts, dropdown menus |
| `--radius-modal` | 24 px | Modals, drawers (inner edge), bottom sheets (top corners), SweetAlert2 popups |

This is the only radius system. No sharp corners anywhere except the 1 px dividers.

| Token | Value | Applies to |
| --- | --- | --- |
| `--shadow-sm` | `0 1px 2px rgb(10 116 180 / 0.06)` | Sticky header after scroll, hovered row |
| `--shadow-md` | `0 8px 24px rgb(10 116 180 / 0.10)` | Dropdowns, toasts |
| `--shadow-lg` | `0 24px 64px rgb(7 60 100 / 0.18)` | Modals, drawers, sheets |

In dark mode shadows switch to `rgb(0 0 0 / 0.35)` and containers rely more on `--border`.

### 2.7 Layers (z-index)

| Layer | Value |
| --- | --- |
| The fixed sky layers (painted gradient and the living sky), behind all content | -1 |
| Sticky filter bar, sticky table headers, sticky admin action bar | 30 |
| Sticky header (with its account menu), drawer, bottom sheet, dropdown | 40 |
| Modal and its backdrop | 50 |
| SweetAlert2 container | 60 |

The header sits at 40, above the other sticky bars, so the account menu that opens from it covers the filter bar.

No other z-index values.

### 2.8 Motion tokens

| Token | Duration | GSAP ease | Use |
| --- | --- | --- | --- |
| `press` | 120 ms | `power2.out` | Button and checkbox press |
| `check` | 200 ms | `power2.out` (check pop: `back.out(2)`) | Checkbox fill and check pop, row tint |
| `enter` | 260 ms | `power3.out` | Modal, drawer, sheet in |
| `exit` | 180 ms | `power2.in` | Modal, drawer, sheet out |
| `count` | 600 ms | `power1.out` | Progress and Primogem numbers counting |

### 2.9 Living sky

A decorative layer behind every page, built by `assets/js/core/sky.js` and animated with CSS keyframes (only `opacity` and `transform`), so it costs no GSAP work.

- **Night:** 150 stars (75 under 768 px), every one twinkling from its peak opacity to 0 and back. Tempos are random per star: about 30% slow (7 to 14 s), 55% easy (2.5 to 5 s), 15% quick (0.9 to 1.8 s); about 12% are bright and larger. Random start offsets keep them out of step.
- **Day:** 4 clouds (2 under 768 px) from svg-clouds 1.0.1 (MIT), each with a random shape seed. Its own shape animation is off; each cloud drifts left to right on a linear loop of 80 to 150 s.
- Rebuilt on theme change and when the screen crosses 768 px. `aria-hidden`, no pointer events.
- **Reduced motion:** both animations are off; stars and clouds stay still.

---

## 3. Components

Every component exists once and is reused. Custom HTML ids and classes use the prefixes from PRD 9.3: `ui-` (shared), `trk-` (tracker), `adm-` (Studio).

### 3.1 Buttons

All button labels are English, at most 3 words, one line.

| Variant | Look | Use |
| --- | --- | --- |
| Primary | `--accent` fill, white text (dark: `#062435` text), pill | The single main action of a view: Apply, Submit for Review, Publish, Approve, Save |
| Secondary | `--surface` fill, `--border-strong` 1 px outline, `--text` | Other actions: Check, Bulk Mark, Cancel, Load more |
| Ghost | No fill, `--accent` text, `--surface-muted` on hover | Low-weight actions in rows and toolbars |
| Danger | `--danger` text, outline on hover; filled only inside confirmation popups | Reject, Discard, Delete account, Force Unlock |
| Icon button | 40 px circle (44 px hit area), ghost style, `aria-label` required | Theme toggle, close, menu |

- Heights: 40 px default, 36 px compact (admin tables), 48 px for the main action in mobile sheets.
- States: hover (slightly darker fill), active (`scale 0.98`, `press`), focus-visible (ring, see 7), disabled (`--surface-muted` fill, `--text-subtle` text, no shadow), loading (label replaced by an inline spinner of the same width so the button does not resize).
- One primary button per view. Two buttons with the same intent never appear together.

### 3.2 Inputs

- Label above the input (`small`, 500, `--text`), helper text below in `--text-subtle`, error text below in `--danger` with a Phosphor `warning-circle` icon. No placeholder-as-label.
- Height 44 px, `--radius-input`, `--surface` fill, `--border-strong` outline, focus ring on focus.
- **Search field:** pill, leading `magnifying-glass` icon, clear button when filled, `Ctrl/Cmd + K` and `/` focus it on desktop. Placeholder (ID): "Cari achievement, stage, atau deskripsi". Placeholder (EN): "Search achievements, stages or descriptions".
- **Select / dropdown:** native `<select>` styled like an input on mobile; custom dropdown menu (`--radius-card`, `--shadow-md`) on desktop only where native is not enough (version filter with many options).
- **Textarea:** same style, min 6 rows; the JSON tab of bulk mark uses JetBrains Mono 13 / 20.

### 3.3 Stage checkbox (the core control)

- A real `<input type="checkbox">` with a visible label, 22 px box, 6 px radius, inside a 44 px hit area.
- Unchecked: `--surface` fill, `--border-strong` outline. Checked: `--accent` fill, white check icon (Phosphor `check`, bold).
- Label shows the stage number and its reward: "Stage 1" plus Primogem icon plus the count (for example 5). Single-stage achievements show only the reward.
- **Cascade is visible:** checking stage 3 checks 1 and 2 in order with a 40 ms stagger; unchecking stage 1 unchecks 2 and 3 in reverse order.
- **Rollback:** if saving fails, the boxes return to their previous state, the row nudges horizontally (4 px, twice, 160 ms total) and a SweetAlert2 error toast explains why.

### 3.4 Achievement row

The list uses compact rows, not cards.

```
[ Name (h3)                              v6.7   Hidden ]   [ ☐ Stage 1 ◆ 5 ] [ ☐ Stage 2 ◆ 10 ] [ ☐ Stage 3 ◆ 20 ]
[ Description (small, muted), {param0} filled from progress ]                      [ How To Achieve ]
```

- **Left:** name, description (with `{param0}` replaced using the stage's progress target; stages sharing one description show every target on one line, for example "30 / 150 / 300"), version chip (`caption`, pill, `--surface-muted`), and a "Hidden" chip for hidden achievements.
- **Right (desktop) / below (mobile):** stage checkboxes in a row.
- **Stages with their own text:** when a stage title differs from the name (for example Zoo Tycoon stage 3), or the description text differs between stages beyond `{param0}`, the stages switch to a vertical list, each with its own description, and its own title when that differs.
- **Tutorial action:** ghost button "How To Achieve" with a `book-open` icon. When a tutorial exists the icon is filled in `--accent`; when none exists the button is still shown in `--text-subtle` and opens the default "not available yet" notice.
- **Done row:** every stage checked gives the row an `--accent-soft` tint and the name a small filled `seal-check` icon. No strike-through.
- Rows are grouped in one `--radius-card` container per category with 1 px `--border` dividers between rows (bottom border only, never top and bottom).
- Row min height 72 px desktop; padding 16 px.

### 3.5 Chips and segmented toggles

- **Category chip (mobile):** pill, 36 px high, `--surface` with outline; selected uses `--accent-soft` fill and `--accent-strong` text. Shows the name and `12/57`.
- **Segmented toggle:** pill track in `--surface-muted`, selected segment is `--surface` with `--shadow-sm`. Used for language (ID | EN), status filter (All | Done | On progress | Not done) and the bulk mark mode tabs, where one segment is always selected, and for the on/off filters (Has tutorial | Hidden), where each segment switches on and off by itself, so both, one or neither can be active.

### 3.6 Progress summary

One wide panel under the header, not three equal cards:

- Left: the overall percentage in `display`, under it "1.204 / 1.558 achievement selesai" (`small`, muted).
- Middle: a thin 8 px progress bar (`--sky` fill on `--surface-muted`, pill).
- Right: Primogem icon plus "9.870 / 14.085 Primogem" (number in `h3`, tabular).
- Totals are computed from the loaded JSON (currently 1,558 achievements, 14,085 Primogems) and always follow the data.
- Mobile: the three parts stack; the percentage and Primogems sit on one line above the bar.

**Narrowed view.** While a category is chosen or any filter control is active (status other than All, a version, Has tutorial, Hidden), the summary splits into two panels of the same shape:

- Left, titled "Semua achievement": the totals above, unchanged.
- Right: the same parts counted only over the achievements that match the chosen category and filters. Its title is "Hasil filter", the category name when only a category is chosen, or "Hasil filter di {kategori}" when both are.
- The percentage is achievements done out of the matching set, so the status filter Done always shows 100%, and On progress and Not done show 0% (an achievement in progress is not done yet).
- Search and sort never open or change the right panel.
- From 768 px the panels sit side by side, each stacked inside; below 768 px the right panel sits under the left one.
- With nothing narrowing the list, the summary is the single wide panel again and the left title is hidden.

### 3.7 Modal, drawer and bottom sheet

| Container | Where | Size |
| --- | --- | --- |
| Modal | Desktop: tutorial, profile, confirmations not handled by SweetAlert2 | Max width 720 px, max height 85 dvh, internal scroll, `--radius-modal` |
| Drawer (right) | Desktop: bulk mark | Width 560 px, full height, left corners 24 px |
| Bottom sheet | Mobile: tutorial, filters, profile | Max height 92 dvh, top corners 24 px, drag handle, close button |
| Full screen | Mobile: bulk mark | 100 dvh, sticky header with close and the primary action at the bottom |

- Backdrop `rgb(10 21 32 / 0.45)` with no blur, because a full-screen blur made overlays stutter; click on backdrop closes (except while saving).
- Focus moves into the container on open, is trapped while open and returns to the trigger on close. `Esc` closes.
- Page scroll is locked while open.

### 3.8 SweetAlert2 (all alerts, toasts and confirmations)

Every alert, toast, confirmation and prompt uses SweetAlert2, wrapped once in `assets/js/core/toast.js` (toasts) and `assets/js/core/modal.js` (confirmations), so no page calls SweetAlert2 directly.

- **Styling:** `buttonsStyling: false`; buttons get our Primary / Secondary / Danger classes via `customClass`. Popup uses `--surface`, `--text`, `--radius-modal`, `--shadow-lg`, Poppins. Toast uses `--radius-card`, `--shadow-md`. Both follow the active theme.
- **Animation:** SweetAlert2's default show / hide classes are replaced with our own opacity plus scale (0.96 to 1) using the `enter` / `exit` durations; disabled under reduced motion.
- **Icons:** SweetAlert2's built-in icons are replaced with Phosphor icons through `iconHtml` (`check-circle` accent, `warning-circle` danger, `warning` warning, `info` accent).
- **Toast:** top right on desktop, top center on mobile, 3,000 ms (errors and info 5,000 ms), pause on hover, max one visible (a new toast replaces the old).
- **Text:** toast and popup text is English when it is technical (errors) and follows ID / EN when it is content. Button labels are always English: OK, Cancel, Undo, Retry, Keep editing, Save and close, Delete, Reject.

| Situation | Type | Example |
| --- | --- | --- |
| Progress save failed or offline | Error toast | "Could not save. Changes were reverted." |
| Bulk mark applied | Success toast with **Undo** button | "128 stage ditandai selesai" |
| Guest progress imported after sign-in | Success toast | "Progres dari browser ini sudah digabung ke akun Anda" |
| New badge earned | Popup with badge icon and title | "Badge baru: Trailblazer" |
| Lock expiring in 2 minutes | Popup with live countdown; Keep editing / Save and close | |
| Lock lost | Popup; Copy text / Reopen | "Your edit lock expired." On timeout it adds a blue info callout (3.9): the lock is released, the text is saved as a draft (or, if the last save failed, use Copy text), and Reopen locks it again if nobody else has opened it. |
| Bulk approve: 31st tick | Info toast (`info` icon) | "Maksimal 30 tutorial dalam sekali persetujuan, karena server hanya mengizinkan 30 persetujuan setiap 10 menit." |
| Bulk approve finished | Success toast, or error toast when any was not approved | "30 tutorial disetujui. 300 poin diberikan ke penulisnya." |
| Reject tutorial | Prompt with required textarea (1 to 1,000 chars); Reject / Cancel | |
| Delete account, discard draft, force unlock, delete user | Danger confirmation; destructive button on the right | |

### 3.9 Skeleton, empty and banners

- **Skeleton:** rows with the same shape as achievement rows (two text bars plus three checkbox blocks) in `--surface-muted`, with a slow shimmer (1.6 s) that becomes static under reduced motion. Never a lone spinner for page loads.
- **Empty state:** large Phosphor icon (48 px, `--text-subtle`), one sentence and one action. Example: "Tidak ada achievement yang cocok dengan pencarian." plus **Clear filters**.
- **Banner:** full-width strip under the header, `--radius-card`, icon plus one sentence plus optional action. Used for the Guest notice ("Progres disimpan di browser ini. Masuk untuk menyimpannya ke akun.", dismissible, with no button of its own because sign-in lives in the header), offline ("Anda sedang offline. Perubahan belum tersimpan.") and the rejection reason in the editor.
- **Info callout** (`ui-banner-info`): the banner on `--accent-soft` with a Fill `info` icon in `--accent-strong`, text in `--text`, left aligned, padding 12 / 16, `role="note"`. Used inside popups to explain what just happened, for example the lock timeout (3.8).

### 3.10 Avatar, badges and account menu

- **Avatar:** 32 px circle with the Google photo; fallback is the first letter of `display_name` on `--accent-soft`.
- **Account menu** (dropdown on desktop, sheet on mobile): display name with the user's own email under it as a `caption` label in `--text-muted`, top badge, then Profile, My Points (Contributor), Studio (Contributor and Administrator, `pencil-ruler` icon), Sign out.
- **Names in messages:** a toast or popup that names a person shows "Name (email)" when the viewer may see that email (their own, or any user for an Administrator), and the name alone otherwise (PRD Decisions Log 57).
- **Contributor badges:** Phosphor icon inside a pill, tinted with a step of the sky scale so tiers stay on-palette:

| Badge | Icon | Tint |
| --- | --- | --- |
| Wayfinder | `compass` | Sky 200 |
| Trailblazer | `path` | Sky 300 |
| Seasoned Guide | `map-trifold` | Sky 400 |
| Master Cartographer | `globe-hemisphere-west` | Sky 700 (`#0369A1`), white icon; Sky 600 misses AA for the 12 px title |
| Legend of Teyvat | `crown-simple` | Sky 800, white icon |

Badge art can replace the icons later without changing layout (same 24 / 48 px slots).

### 3.11 Icons

- **Phosphor Icons** (web font build from CDN), one family only. Regular weight by default, Fill weight only for "on" states (checked tutorial icon, done seal, active nav item).
- Sizes 16, 20, 24 and 48 px. Icon-only buttons always have `aria-label`.
- No hand-drawn SVG icons and no emoji in the interface.

### 3.12 Tooltip

- tippy.js through `core/tooltip.js`, theme `ui`: `--surface-solid`, 1 px `--border`, `--radius-input`, `--shadow-md`, padding 8 / 12, `small` text in `--text`, max width 280 px, no arrow, no animation, layer `--z-overlay`.
- Opens on hover and keyboard focus after 200 ms, and on a 400 ms hold on touch. The target gets `tabindex="0"` when it is not focusable, and tippy links it with `aria-describedby`.
- Plain text only, following the ID / EN toggle. A tooltip explains; it never holds the only copy of something the user needs to act.
- Used on the editor's "Locked by you" status (cursor `help`).

---

## 4. Page Layouts

### 4.1 Tracker (`index.php`)

Numbers in the sketches below are examples only.

**Desktop (≥ 1024 px)**

```
┌ Header 64 px (sticky) ─────────────────────────────────────────────────────────────┐
│ Genshin Achievements      [ Search ............................. ]  Bulk Mark  ID|EN ◐ (avatar) │
├────────────────────────────────────────────────────────────────────────────────────┤
│ [Guest banner, if Guest]                                                            │
│ [ 77%  1.204 / 1.558 selesai   ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▭▭▭   ◆ 9.870 / 14.085 Primogem ]      │
├──────────────────────┬─────────────────────────────────────────────────────────────┤
│ Sidebar 280 px       │ Filter bar (sticky under header)                             │
│ (sticky, own scroll) │ All|Done|On progress|Not done Version▾ Tutorial|Hidden Sort▾ │
│ Semua kategori       ├─────────────────────────────────────────────────────────────┤
│ Keajaiban Dunia 412/980 │ Category title (h2) + its own progress                   │
│ Ingatan Hati   20/57 │ ┌ rows ───────────────────────────────────────────────────┐ │
│ ...                  │ │ achievement row                                          │ │
│                      │ │ achievement row                                          │ │
│                      │ └──────────────────────────────────────────────────────────┘ │
│                      │ [ Load more ]                                                 │
├──────────────────────┴─────────────────────────────────────────────────────────────┤
│ Footer: Fan-made project. Not affiliated with HoYoverse.                             │
└────────────────────────────────────────────────────────────────────────────────────┘
```

- **Sidebar:** "Semua kategori" first, then the 73 categories in data order, each with name (wraps to at most 2 lines; names reach about 60 characters) and `done/total`. Active item uses `--accent-soft` and a Fill icon.
- **Header actions:** wordmark (Poppins 700, `--text`, with a small `wind` icon in `--accent`), search, Bulk Mark (secondary), language toggle, theme toggle, then avatar or the Google sign-in button (Google's own rendered button, pill shape, "outline" theme in light and "filled_black" in dark).
- **Filters** (all combine with search): status (All, Done, On progress, Not done; On progress shows achievements with some stages done but not all, which in the data means a 3-stage achievement with 1 or 2 done, and Not done still includes them; the label is "On progress" in both languages; in the phone sheet below 480 px the four options form a 2 by 2 grid), version (1.0 to 7.1, multi-select), has tutorial and hidden (on/off segments; hidden shows only achievements marked hidden in the data), sort (Default order, Name A to Z, Version newest, Version oldest). Version and sort are both dropdown buttons that open a panel under them; sort reads "Urutkan" and, for any order but the default, "Urutkan: Versi terbaru"; picking an order applies it and closes the panel, and the active one has a check. In the bar the sort panel opens toward the left.
- **Rendering large lists:** rows render in chunks of 50 per category or result set. An IntersectionObserver near the end loads the next chunk, with a **Load more** button as fallback. This keeps "Keajaiban Dunia" (980 rows) light on phones.
- **Search results:** replace the category view with one list grouped by category headings, matched words highlighted with `--accent-soft` background.

**Tablet (768 to 1023 px):** sidebar becomes the horizontal chip row (as mobile); filters stay inline; Bulk Mark is an icon button (as mobile), so the search field keeps its width.

**Mobile (< 768 px)**

```
┌ Header 56 px ───────────────────────────┐
│ ≋ Genshin Achievements     ⇪  ID|EN  ◐  ●│   (⇪ = Bulk Mark icon button)
├─────────────────────────────────────────┤
│ [ Search ............................ ] │   sticky with the header
│ ‹ chip  chip  chip  chip ›               │   scroll-snap categories
│ [ Filter (2) ]                           │   opens filter bottom sheet
├─────────────────────────────────────────┤
│ 77%   ◆ 9.870 / 14.085                  │
│ ▬▬▬▬▬▬▬▬▬▬▬▬▭▭▭                         │
├─────────────────────────────────────────┤
│ Name                        v6.7         │
│ Description                              │
│ [☐ Stage 1 ◆5] [☐ Stage 2 ◆10]           │   stages wrap below text
│ [☐ Stage 3 ◆20]       How To Achieve     │
└─────────────────────────────────────────┘
```

- Below 480 px the wordmark drops its `wind` icon and takes two lines, so the header actions fit.
- The search field and chip row stay sticky; the progress summary scrolls away.
- The filter button shows the number of active filters.

### 4.2 Bulk Mark (drawer on desktop, full screen on mobile)

1. Title "Bulk Mark" and a short hint for the active mode.
2. Segmented tabs: **By name** | **By name + stage (JSON)**. Each tab shows a small format example under the textarea.
3. Textarea (JSON tab in JetBrains Mono).
4. **Check** (secondary) runs Inquiry in the browser.
5. Result groups, each a collapsible section with an icon and a count: Found (accent), Already done (muted), Ambiguous (warning; each item offers its candidates as radio options, using `dupealias` only to tell them apart), Not found (danger), Invalid format (danger, with line numbers).
6. Sticky footer: summary "128 stage akan ditandai" and **Apply** (primary, disabled until Check has run and at least one item is Found or resolved).
7. After Apply: the drawer closes, rows update, a success toast offers **Undo**.
8. Below the report, a section "Aksi massal terakhir" shows the count and date of the last action with **Undo**, when one can still be undone.
9. Last, a section "Cadangan" holds **Export** and **Import** (PRD 5.4).

### 4.3 How To Achieve (modal on desktop, bottom sheet on mobile)

- Header: achievement name (h2), category (caption), close button.
- Credit row, above the video: a bordered box with a 40 px avatar (first letter when there is no picture), the label "Dipublikasikan oleh" in caption, the name in 14/20 weight 600 with the top badge chip, and the date and time ("7 Nov 2026 12.30") in caption. Once a later version is live, a second panel "Terakhir diedit oleh" sits on the right with the live version's author and time. The two panels split with a 1 px divider from 768 px and stack below it.
- Language note when needed (viewer language has no text, or the only video is in the other language), as an inline banner in `--surface-muted`.
- Video: 16:9 facade with the YouTube thumbnail and a large play button; the iframe (`youtube-nocookie.com`) loads only after a tap. Rounded `--radius-card`.
- Body: sanitized HTML with prose styles (headings, lists, quotes with an accent left border, images max width 100% with `--radius-card`, links in `--accent`).
- No tutorial: empty state "Tutorial untuk achievement ini belum tersedia." plus, for Contributors, **Write Tutorial**.

### 4.4 Profile and My Points

- **Profile** (modal / sheet): avatar, display name input, email (read only), **Save**; a separated danger zone with **Delete Account** (danger confirmation).
- **My Points** (Contributor, in the Studio): total points in `display`, next badge with "35 poin lagi menuju Seasoned Guide" and a thin progress bar, earned badges as a wrapping row of badge pills, recent ledger entries as a simple list (date, event, points; reversals in `--danger`).

### 4.5 Studio

Same tokens and components, denser and plainer. No hero, no decorative panels.

- **Shell:** pages live at `/studio`, tab title "Studio - Genshin Achievements". Left sidebar nav 240 px: All Tutorials and My Points (Contributor) first, then an "Admin" group heading (`caption`, `--text-subtle`) over Dashboard, Approvals, Users, Points Settings, Audit Log and Maintenance, shown to Administrators only. Items are hidden when the role lacks access, and the active item is in `--accent-soft`. On mobile the sidebar becomes a top bar with a menu sheet titled "Studio".
- **Tables:** `small` text, row height 48 px, header row sticky, bottom divider per row, actions at the row end as ghost buttons or a "more" menu, pagination at the bottom (Previous / page numbers / Next). On mobile each row becomes a stacked block with label and value pairs.
- **Dashboard:** one panel with four numbers separated by vertical dividers (users by role, pending reviews, published tutorials, active locks), then the pending reviews list.
- **All Tutorials:** search plus state filter chips (None, Live, Draft, Pending, Rejected, Locked); each row shows names ID and EN, live version, open version status chip, lock holder, **Edit**.
- **Editor:** top bar with achievement name, status chip, lock status ("Locked by you" plus time left, shown in `--warning` during the last 2 minutes, with a tooltip explaining the lock, 3.12), language tabs ID | EN, each showing a check icon once it has content, TinyMCE per tab (frame `--radius-input`, toolbar on `--surface-muted`), YouTube URL input with live thumbnail preview, sticky action bar: Preview (ghost), Save (secondary), Submit for Review (primary, Contributor) or Publish (primary, Administrator), Discard (danger ghost). Autosave status text: "Saved 12:04" or "Saving...".
- **Approvals:** queue table with a checkbox column and "Pilih semua di halaman ini" above it. While anything is selected, a sticky bar shows "12 dari 30 dipilih" (progress "Menyetujui 7 dari 30" while running) and **Approve selected** (primary, one confirmation). The selection holds at most 30 and survives page changes; the 31st tick shows an info toast naming the 30 per 10 minutes limit. The result is one toast: success with the points total, or the approved and not approved counts with the reason. Then a review page with Proposed and Live side by side on desktop (stacked tabs on mobile), review history below, sticky bar with Approve (primary) and Reject (danger, opens the prompt).
- **Users:** the user cell has a 32 px avatar (first letter when there is no picture), the name with the top badge chip, and the email below. For the writer agent Charlotte the role is plain text and there is no Delete button; Disable stays.
- **Approvals author:** a tutorial from the writer agent shows a 24 px round robot chip (`ph-fill ph-robot`, `--accent-soft` with `--accent-strong`) after the name, with the tooltip "Ditulis oleh agen AI" (3.12).
- **Points Settings, Audit Log, Maintenance:** standard tables and forms. Maintenance shows the dry-run list first, then **Delete Unused** behind a danger confirmation.

---

## 5. States

| State | Where | Treatment |
| --- | --- | --- |
| Loading data JSON | Tracker first load | Skeleton summary plus 8 skeleton rows |
| Loading more rows | End of list | 3 skeleton rows under the list |
| Saving a stage | Row | No spinner; optimistic change, button state unchanged |
| Save failed / offline | Row | Rollback, nudge, error toast; offline banner while offline |
| No results | List | Empty state with Clear filters |
| Category fully done | Category heading | `seal-check` Fill icon beside the title |
| Data failed to load | Tracker | Inline panel: "Data achievement gagal dimuat." plus **Retry** |
| Not signed in | Tracker | Guest banner (dismissible, remembered in localStorage) |
| Account disabled | Any | Danger popup, session ends, back to Guest mode |
| Lock held by someone | Editor open | Popup naming the holder (with email for Administrators) and time left, **OK** |
| Lock warning / lost | Editor | SweetAlert2 popups from 3.8 |
| Rejected version | Editor | Danger-tinted banner with the reason at the top |
| Submitting / approving | Buttons | Loading button state; other actions disabled |

---

## 6. Motion

GSAP is the only animation library. Every animation answers "what does this tell the user?"; if there is no answer, there is no animation.

| Moment | Animation | Purpose |
| --- | --- | --- |
| Stage checked | Fill grows from 70% as it fades in, box scale 0.9 to 1, check pops in with a small overshoot (`check`), row tint fades in. Unchecking shrinks the check out in 150 ms | Feedback |
| Cascade | Earlier stages follow with a 40 ms stagger | Shows the dependency |
| Rollback | Horizontal nudge 4 px twice (160 ms) | Error feedback |
| Progress and Primogem numbers | Count to the new value (`count`) | State change |
| Modal / drawer / sheet | Fade plus 12 px slide (sheet from bottom, drawer from right) (`enter` / `exit`) | State change |
| SweetAlert2 popup and toast | Fade plus scale 0.96 to 1 | State change |
| Rows appearing (load more) | Fade in, 20 ms stagger, max 12 animated rows per batch | Continuity |

| Living sky | Stars twinkle, clouds drift (CSS keyframes, see 2.9) | Atmosphere: the owner-approved exception to "every animation is feedback" |

- **Not animated:** page load hero effects, hover floats, parallax, infinite loops (except the skeleton shimmer and the living sky in 2.9), marquee, confetti.
- GSAP drives every animation in the table except the living sky, whose endless loops run as CSS keyframes so they cost no script time.
- Only `transform` and `opacity` animate.
- **Reduced motion:** `gsap.matchMedia()` with `(prefers-reduced-motion: reduce)` turns every animation above into an instant change; the skeleton shimmer becomes static, and the stars and clouds stand still (CSS `prefers-reduced-motion`).
- No `scroll` event listeners; lazy loading uses IntersectionObserver.

---

## 7. Accessibility

- WCAG AA contrast for all text and for control outlines (3:1), verified in both themes (tables in 2.1 and 2.2).
- **Focus ring:** 2 px `--accent` outline with 2 px offset in `--bg`, on `:focus-visible` only, on every interactive element.
- Full keyboard use: Tab order follows the layout; Space toggles stage checkboxes; `Esc` closes overlays; `/` or `Ctrl/Cmd + K` focuses search.
- Progress changes are announced through one `aria-live="polite"` region ("Stage 2 ditandai selesai").
- Each stage checkbox has an accessible name that includes the achievement and stage ("Dua Puluh Lima Gansa, Stage 1").
- Language attribute on `<html>` follows the toggle (`id` / `en`).
- Theme: follows `prefers-color-scheme` until the user picks one; the choice is remembered in localStorage.

---

## 8. Language and Copy

- **Buttons and technical messages:** English, short (OK, Cancel, Apply, Check, Undo, Retry, Sign in, Bulk Mark, How To Achieve, Load more, Clear filters).
- **Labels, hints, descriptions, empty states, banners:** Indonesian (semi-formal, "Anda") or English, following the toggle. Examples: "Selesai", "Belum selesai", "Semua kategori", "Cari achievement, stage, atau deskripsi".
- "Achievement" and "stage" stay as English terms in Indonesian copy, matching the game's player vocabulary; "Primogem" is never translated.
- Indonesian text runs about 20 to 30 percent longer than English, so no label sits in a fixed-width box; buttons size to their English label.
- Numbers use the language's format: `1.558` and `14.085` in ID, `1,558` and `14,085` in EN (via `Intl.NumberFormat`).
- Dates: "12 Okt 2026" (ID) / "12 Oct 2026" (EN), always converted from UTC to the viewer's local time.

---

## 9. Anti-Slop Rules (adopted)

- No em dash or en dash in any interface text; use a period, comma, colon or hyphen.
- No emoji in the interface.
- No purple, no glow, no neon, no gradient text, no pure black or white.
- One accent, one radius system, one icon family, one theme per page (no section flips).
- No uppercase tracking eyebrow labels, no section numbering labels, no decorative dots.
- No three equal cards; summaries use one panel with dividers.
- No hand-drawn SVG icons or fake screenshots; no official game art (the Primogem image in 1 and 2.3 is the one exception).
- No invented numbers in UI: every count comes from the data or the API.
- No `100vh`, no `scroll` listeners, no animation without a purpose, reduced motion always respected.
- Copy self-check before release: every visible string is read once for grammar, clarity and the ID / EN split.

---

## 10. Implementation Notes (for later, not code)

- Libraries from CDN with pinned versions and SRI: GSAP, SweetAlert2, Phosphor Icons (web), svg-clouds 1.0.1 (loaded by `core/sky.js` only in light mode), Google Fonts (Poppins, JetBrains Mono). Self-hosted in `assets/js/vendor/`: TinyMCE, and tippy.js 6.3.7 with Popper 2.11.8 (Studio pages only). No CSS framework: the small base reset lives at the top of `assets/css/app.css`.
- Tokens live only in `assets/css/app.css`, and the dark theme switches via `data-theme` on `<html>`.
- The sky is a `position: fixed` layer on `.ui-page::before`, not `background-attachment: fixed`, which iOS ignores. The living sky (2.9) is a second fixed layer, `.ui-sky`, at the same z-index and inserted before it in the DOM order of `.ui-page`.
- svg-clouds builds its SVG filter with `crypto.randomUUID`, which exists only on secure origins (https, localhost); elsewhere the day sky shows the gradient alone.
- SweetAlert2 is only called from `core/toast.js` and `core/modal.js`.
- GSAP timelines live with the component that owns them (`tracker/progress.js`, `core/modal.js`), each cleaned up when the element is removed.

---

## 11. Out of Scope for This Document

- Code and finished HTML.
- Pixel-final mockups (a separate visual mockup follows this document).
- Every UI string word by word (only patterns and key examples are fixed here).
- API behavior (see API Spec) and database (see schema v1).
- Image assets (logo art, badge art) until they exist.
