# Genshin Achievement Extractor: Instructions

> Read these instructions together with the attached screen recording of the Genshin Impact Achievements menu.
> The game UI in the video can be in **Indonesian or English**.
> Do the job straight away without asking questions, and output JSON in the format below.

## Task

Go through every achievement category opened in the video and list:

1. Every achievement that is **already completed**, and
2. Every achievement that is **not completed yet but already has progress** (at least 1 lit star).

Achievements with **0 lit stars** are skipped (not started / not obtained yet).

## Reading the row

| Right-hand column | Meaning |
|---|---|
| Stamp `Tercapai` (ID) / `Achieved` (EN) + date | Completed |
| Progress number, e.g. `0/1`, `7/10`, `379/500` | Not completed |

Inside each category, unfinished achievements are listed first and completed ones come after. Since completed achievements now count too, **scroll coverage matters**: every row in the video has to be read, not just the top ones.

## Stars and stage (badge on the left of the name)

First check how many star slots the badge has (1 or 3), then count how many are lit.
Lit star = bright white. Unlit star = dark, blends into the badge background.

| Star slots | Lit | Stage |
|---|---|---|
| 1 | 0 | skip |
| 1 | 1 | 1 |
| 3 | 0 | skip |
| 3 | 1 | 1 |
| 3 | 2 | 2 |
| 3 | 3 | 3 |

In short: **stage = number of lit stars**. Completed or not doesn't matter for the output: a completed 1-star achievement and a 3-star achievement with 1 lit star are both just `stage: 1`.

Sanity check for 3-star achievements that are still in progress: the primogem reward of the tier being worked on is usually 5 → 10 → 20. A reward of 10 means 1 star is lit; a reward of 20 means 2 stars are lit.

## Output format

One JSON array, in the order the achievements appear in the video:

```json
[
  { "name": "Lilin Menyala di Tengah Angin", "stage": 1 },
  { "name": "Petualang Belantara Berkilauan", "stage": 2 }
]
```

- Only two fields per item: `name` and `stage`. **No extra fields.**
- Write the name **exactly** as it appears in the game, in the video's language (keep dots, exclamation marks, question marks and commas).
- Escape quotes inside names: `"\"Pembunuhan Feng Shui!\""`.
- No duplicates (the video scrolls, so the same row shows up in many frames).

## Technical workflow (for Claude)

1. Run `ffprobe` to check duration and resolution.
2. Extract 1 frame per second with `ffmpeg -vf fps=1`.
3. Crop the right-hand panel (about `crop=1120:860:730:140` for 1920x1080) and stack 2 frames vertically to read them faster.
4. Read every frame and record every row with its progress or stamp.
5. **Watch for rows cut off at the top or skipped by fast scrolling**, especially when switching categories. If a category's percentage doesn't add up, or a row is cut off, extract dense frames (`fps=5`) around that moment.
6. For badges that are hard to read, crop the badge (~110x110 px at x≈745) and scale it 3x to count slots and lit stars.
7. Output the final JSON plus a short summary: total count and how many items are at each stage.
