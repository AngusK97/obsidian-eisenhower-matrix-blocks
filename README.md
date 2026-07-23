<p align="right"><strong>English</strong> | <a href="README.zh-CN.md">简体中文</a></p>

# Eisenhower Matrix Blocks for Obsidian

[![CI](https://github.com/AngusK97/obsidian-eisenhower-matrix-blocks/actions/workflows/ci.yml/badge.svg)](https://github.com/AngusK97/obsidian-eisenhower-matrix-blocks/actions/workflows/ci.yml)
[![GitHub release](https://img.shields.io/github/v/release/AngusK97/obsidian-eisenhower-matrix-blocks?sort=semver)](https://github.com/AngusK97/obsidian-eisenhower-matrix-blocks/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Eisenhower matrices that live inside your Obsidian notes.**

Insert an independent four-quadrant task board anywhere in Markdown, complete tasks in place, and keep a filterable history without a global database.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/matrix-desktop-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="docs/assets/matrix-desktop-light.png">
  <img src="docs/assets/matrix-desktop-light.png" alt="Eisenhower Matrix Blocks embedded in an Obsidian note">
</picture>

- **Local to every note:** each matrix owns its tasks and completed history, and a note can contain more than one matrix.
- **Markdown-backed:** tasks, quadrants, ordering, and completion times travel with the note through Obsidian Sync, Remotely Save, or Git.
- **A complete workflow:** add, edit, move, complete, restore, delete, and filter tasks without leaving the matrix.

The matrix is inserted at the editor cursor and remains part of the note instead of becoming a separate global dashboard.

## Quick start

1. [Install the plugin](#installation) and enable **Eisenhower Matrix Blocks** in Obsidian.
2. Open an editable Markdown note and place the cursor where the matrix should appear.
3. Click the grid icon in the left ribbon, or run **Eisenhower Matrix Blocks: Insert matrix at cursor** from the command palette.
4. Use Live Preview or Reading view to work with the rendered matrix.

Each insertion creates a new independent board ID. Use the command again when you want another matrix in the same note.

## Installation

Eisenhower Matrix Blocks is not yet listed in Obsidian's Community Plugins browser. Until it is accepted, install it with BRAT or from a release.

### BRAT

1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) community plugin.
2. Choose **Add beta plugin**.
3. Enter `AngusK97/obsidian-eisenhower-matrix-blocks`.
4. Enable **Eisenhower Matrix Blocks** in Obsidian's community plugin settings.

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/AngusK97/obsidian-eisenhower-matrix-blocks/releases/latest).
2. Create `<Vault>/.obsidian/plugins/eisenhower-matrix-blocks/`.
3. Copy the three files into that folder.
4. Reload Obsidian and enable **Eisenhower Matrix Blocks**.

## What makes it different

Many task tools collect work into a global database or dedicated view. Eisenhower Matrix Blocks keeps the ownership boundary at the note:

- A project note can own its own matrix and completion history.
- The same note can contain multiple independent matrices.
- Copying a matrix block copies the data; deleting the block deletes that matrix.
- No plugin-specific global task file is required.
- Every operation updates only the selected matrix block and preserves surrounding prose, frontmatter, callouts, code, and sibling matrices.
- The plugin makes no network requests and collects no telemetry.

## Core workflow

| Workflow | Behavior |
|---|---|
| Add | Add a task directly to Important and urgent, Important, not urgent, Urgent, not important, or Neither important nor urgent. |
| Edit | Click a task title to edit it without opening another view. |
| Move | Use the task menu on every device or drag between quadrants on desktop. |
| Complete | Check a task to move it into the unified completed list with an exact completion timestamp. |
| Restore | Uncheck a completed task to return it to its source quadrant. |
| Filter | Filter completed tasks by source quadrant and by today, 7 days, 30 days, or a custom date range. |
| Rename | Give every embedded matrix its own title; `Matrix` is the default. |

## Markdown-backed by design

![The rendered matrix beside its readable Markdown source](docs/assets/markdown-source.png)

The note contains the complete board state in an `eisenhower-matrix-blocks` code block:

````markdown
```eisenhower-matrix-blocks
<!-- quadrant-board {"id":"board-example","version":2,"title":"Launch Week"} -->

## 立即做
- [ ] Fix checkout regression #quadrant/do
  <!-- quadrant-task {"id":"task-example","quadrant":"do","createdAt":"2026-07-20T08:00:00.000Z","completedAt":null,"order":0} -->

## 安排

## 委派

## 舍弃

## 已完成
```
````

The visible headings inside the source are stable storage markers. The rendered interface follows the Chinese or English language selected in plugin settings.

Task metadata is stored in hidden Markdown comments so the plugin can preserve stable IDs, source quadrants, ordering, creation times, and exact completion times. Use the insertion command instead of manually creating metadata.

## Storage and sync

There is no global task database. A matrix's source text is its complete data store.

- Obsidian Sync, Remotely Save, and Git can sync matrices as ordinary note content.
- Multiple offline edits still follow the conflict behavior of the selected sync provider.
- The plugin re-reads the latest note and uses Obsidian's atomic Vault API for every local mutation.
- Duplicate board IDs in one note are treated as ambiguous and blocked from writing; the same ID may exist safely in different notes.
- Deleting a matrix code block deletes that matrix, so note history and backups remain important.

The interface language is stored in the plugin's local `data.json`; it is separate from matrix data and changing it does not rewrite notes.

## Mobile and languages

The matrix uses a responsive layout on Obsidian Mobile. Task menus provide the movement workflow where desktop drag and drop is unavailable.

Open **Settings → Eisenhower Matrix Blocks → Interface language** and choose **中文** or **English**. The change applies immediately to headings, menus, filters, controls, dates, commands, and notices without rewriting matrix blocks.

## Compatibility and upgrades

- Existing `quadrant-tasks` code blocks remain readable and editable after the plugin rename.
- Version 1.1 global Markdown storage is migrated in place to an independent matrix after a private backup is created.
- Version 1.0 JSON storage is inserted into the legacy task note after a private backup is created.
- Private backups stay under the active plugin directory and are never included in release assets.
- The old global view and global task-file setting are no longer part of the plugin.

## Frequently asked questions

### Can I put more than one matrix in a note?

Yes. Run the insertion command for every new matrix so each one receives a unique board ID.

### Will my tasks sync between devices?

Matrix data lives in the note, so it follows the note through your sync provider. Plugin settings such as interface language are separate and depend on whether that provider syncs Obsidian configuration files.

### Does the plugin scan tasks from my entire vault?

No. It operates only on explicit matrix blocks and does not build a global task index.

### Can I edit the Markdown manually?

The format is readable, but the insertion command and visual controls are recommended because they maintain IDs and timestamps. The plugin refuses unsafe writes when managed content is malformed or ambiguous.

### Does it work without an internet connection?

Yes. The plugin runs locally and makes no network requests.

## Contributing

Bug reports and feature requests are welcome. Please use fictional or sanitized examples and never upload a complete personal vault.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development setup, compatibility requirements, privacy rules, and verification checklist.

```bash
npm ci
npm run verify
```

## License

[MIT](LICENSE)
