<p align="right"><strong>English</strong> | <a href="https://github.com/AngusK97/obsidian-eisenhower-matrix-blocks/blob/main/README.zh-CN.md">简体中文</a></p>

# Eisenhower Matrix Blocks for Obsidian

[![CI](https://github.com/AngusK97/obsidian-eisenhower-matrix-blocks/actions/workflows/ci.yml/badge.svg)](https://github.com/AngusK97/obsidian-eisenhower-matrix-blocks/actions/workflows/ci.yml)
[![GitHub release](https://img.shields.io/github/v/release/AngusK97/obsidian-eisenhower-matrix-blocks?sort=semver)](https://github.com/AngusK97/obsidian-eisenhower-matrix-blocks/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/AngusK97/obsidian-eisenhower-matrix-blocks/blob/main/LICENSE)

**Eisenhower matrices that live inside your Obsidian notes.**

Insert an independent four-quadrant task board anywhere in Markdown, complete tasks in place, and keep a filterable history.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/AngusK97/obsidian-eisenhower-matrix-blocks/main/docs/assets/matrix-desktop-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/AngusK97/obsidian-eisenhower-matrix-blocks/main/docs/assets/matrix-desktop-light.png">
  <img src="https://raw.githubusercontent.com/AngusK97/obsidian-eisenhower-matrix-blocks/main/docs/assets/matrix-desktop-light.png" alt="Eisenhower Matrix Blocks embedded in an Obsidian note">
</picture>

- **Local to every note:** each matrix owns its tasks and completed history, and a note can contain more than one matrix.
- **Markdown-backed:** tasks, quadrants, ordering, and completion times travel with the note through Obsidian Sync, Remotely Save, or Git.
- **A complete workflow:** add, edit, move, complete, restore, delete, and filter tasks without leaving the matrix.

The matrix is inserted at the editor cursor and remains part of the note.

## Quick start

1. [Install the plugin](#installation) and enable **Eisenhower Matrix Blocks** in Obsidian.
2. Open an editable Markdown note and place the cursor where the matrix should appear.
3. Click the grid icon in the left ribbon, or run **Eisenhower Matrix Blocks: Insert matrix at cursor** from the command palette.
4. Use Live Preview or Reading view to work with the rendered matrix.

Each insertion creates a separate matrix. Run the command again when you want another matrix in the same note.

## Installation

### Community Plugins

1. Open **Settings → Community plugins** in Obsidian.
2. Select **Browse** and search for **Eisenhower Matrix Blocks**.
3. Select **Install**, then **Enable**.

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/AngusK97/obsidian-eisenhower-matrix-blocks/releases/latest).
2. Create `<Vault>/.obsidian/plugins/eisenhower-matrix-blocks/`.
3. Copy the three files into that folder.
4. Reload Obsidian and enable **Eisenhower Matrix Blocks**.

## Boards belong to notes

Each matrix belongs to the note that contains it:

- A project note can own its own matrix and completion history.
- The same note can contain multiple independent matrices.
- Copying a matrix block copies the data; deleting the block deletes that matrix.
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

![The rendered matrix beside its readable Markdown source](https://raw.githubusercontent.com/AngusK97/obsidian-eisenhower-matrix-blocks/main/docs/assets/markdown-source.png)

The note contains the complete board state in an `eisenhower-matrix-blocks` code block:

````markdown
```eisenhower-matrix-blocks
<!-- quadrant-board {"id":"board-example","version":2,"title":"Launch Week"} -->

## Important and urgent
- [ ] Fix checkout regression #quadrant/do
  <!-- quadrant-task {"id":"task-example","quadrant":"do","createdAt":"2026-07-20T08:00:00.000Z","completedAt":null,"order":0} -->

## Important, not urgent

## Urgent, not important

## Neither important nor urgent

## Completed
```
````

The English headings inside the source are stable storage markers. The rendered interface follows the Chinese or English language selected in plugin settings.

Hidden Markdown comments preserve source quadrants, ordering, creation times, and completion times. Use the insertion command and matrix controls to keep this data valid.

## Storage and sync

All data for a matrix is stored in its Markdown block.

- Obsidian Sync, Remotely Save, and Git can sync matrices as ordinary note content.
- Multiple offline edits still follow the conflict behavior of the selected sync provider.
- Deleting a matrix code block deletes that matrix, so note history and backups remain important.

Interface language is stored separately from matrix data. Changing it does not rewrite notes and may need to be configured on each device, depending on your sync settings.

## Mobile and languages

The matrix uses a responsive layout on Obsidian Mobile. Task menus provide the movement workflow where desktop drag and drop is unavailable.

Open **Settings → Eisenhower Matrix Blocks → Interface language** and choose **Follow Obsidian** (the default), **中文**, or **English**. The change applies immediately to headings, menus, filters, controls, dates, commands, and notices without rewriting matrix blocks.

## Frequently asked questions

### Can I put more than one matrix in a note?

Yes. Run the insertion command again whenever you need another matrix.

### Will my tasks sync between devices?

Matrix data lives in the note, so it follows the note through your sync provider. Plugin settings such as interface language are separate and depend on whether that provider syncs Obsidian configuration files.

### Can I edit the Markdown manually?

The format is readable, but the insertion command and matrix controls are recommended because they maintain task metadata. If a matrix block is incomplete or malformed, fix its source before continuing.

### Does it work without an internet connection?

Yes. The plugin runs locally and makes no network requests.

## Contributing

Bug reports and feature requests are welcome. Please use fictional or sanitized examples and never upload a complete personal vault.

See [CONTRIBUTING.md](https://github.com/AngusK97/obsidian-eisenhower-matrix-blocks/blob/main/CONTRIBUTING.md) for the development setup, compatibility requirements, privacy rules, and verification checklist.

Project maintainers can use the [cross-machine maintainer handbook](https://github.com/AngusK97/obsidian-eisenhower-matrix-blocks/blob/main/MAINTAINING.md) to rebuild the complete development and release environment on a new computer.

```bash
npm ci
npm run verify
```

## License

[MIT](https://github.com/AngusK97/obsidian-eisenhower-matrix-blocks/blob/main/LICENSE)
