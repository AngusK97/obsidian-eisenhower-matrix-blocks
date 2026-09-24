# README media

All public media uses the fictional demo content in [`../demo/`](../demo/), never a personal vault.

## Current README previews

Captured on 2026-09-24 with the 2.7.6 production renderer in the browser test harness. The Obsidian shell and icons are simulated; these are not native Obsidian screenshots. Both READMEs disclose this distinction.

| File | Content |
|---|---|
| `renderer-overview-light.png` | Complete matrix, light theme |
| `renderer-overview-dark.png` | Complete matrix, dark theme |
| `renderer-task-details-light.png` | First quadrant and task metadata, light theme |
| `renderer-task-details-dark.png` | First quadrant and task metadata, dark theme |
| `renderer-completed-light.png` | Completed history with Due / Completed on labels, light theme |
| `renderer-completed-dark.png` | Completed history with Due / Completed on labels, dark theme |

To regenerate, start `node scripts/ui-preview.cjs`, then run `node scripts/capture-readme.cjs`. Use the Playwright and browser environment variables described in [`../../tests/browser/README.md`](../../tests/browser/README.md); no runtime plugin dependency is added. The script reads only the tracked demo note. Dates are fixed fictional data, so relative-day labels depend on the capture date. The overview keeps the default Today filter, hiding historical completed tasks while retaining their total. The completed-history close-up explicitly selects All and shows the original deadline separately from the actual completion timestamp, without countdowns.

## Historical native captures

The following earlier Obsidian captures and social card remain available but are not the current README hero/detail images.

| File | Content | Specification |
|---|---|---|
| `matrix-desktop-light.png` | Complete matrix in Obsidian's default light theme | 1936 x 1048 PNG, under 1 MB |
| `matrix-desktop-dark.png` | The same matrix in the default dark theme | 1936 x 1048 PNG, under 1 MB |
| `markdown-source.png` | Rendered matrix beside its Markdown source | 1936 x 1048 PNG, under 1.5 MB |
| `social-preview.png` | GitHub repository social card | 1280 x 640 PNG, under 1 MB |

## Native Obsidian capture checklist

- Use the isolated demo vault described in [`../demo/README.md`](../demo/README.md).
- Use the provided `Matrix Demo.md`; do not capture a personal note.
- Keep task text readable at normal GitHub README width.
- Leave enough Obsidian chrome visible to establish that the matrix belongs to a note.
- Keep the matrix as the visual focus and crop unrelated sidebars or tabs.
- Hide vault paths, account names, system notifications, and private filenames.
- Use the English interface for primary media. The Chinese README reuses the same product media.
- Do not add decorative gradients, device mockups, fake controls, or feature callouts over the interface.
- Inspect every capture at 390 px wide before delivery.

## Deferred media

Real-device mobile and workflow media are intentionally not part of the current README. If they are added later, use these filenames:

- `matrix-mobile.png` for a real Obsidian Mobile capture.
- `matrix-workflow.gif` for the insert, add, move, complete, and filter workflow.

Do not add README references until the corresponding files have been reviewed and committed.

## Publishing checklist

Before committing updated media:

1. Confirm every file referenced by the README exists.
2. Open both README files locally and check that no image is broken.
3. Check light and dark GitHub themes.
4. Keep the initial static image payload under 2 MB where practical.
5. Upload `social-preview.png` manually in GitHub repository settings after the documentation commit is approved.
