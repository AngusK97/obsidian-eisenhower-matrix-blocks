# README media

The repository publishes the static product media below. Every capture comes from the isolated demo vault in [`../demo/`](../demo/), not from a personal vault.

| File | Content | Specification |
|---|---|---|
| `matrix-desktop-light.png` | Complete matrix in Obsidian's default light theme | 1936 x 1048 PNG, under 1 MB |
| `matrix-desktop-dark.png` | The same matrix in the default dark theme | 1936 x 1048 PNG, under 1 MB |
| `markdown-source.png` | Rendered matrix beside its Markdown source | 1936 x 1048 PNG, under 1.5 MB |
| `social-preview.png` | GitHub repository social card | 1280 x 640 PNG, under 1 MB |

## Capture checklist

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

Mobile and workflow media are intentionally not part of the current README. If they are added later, use these filenames:

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
