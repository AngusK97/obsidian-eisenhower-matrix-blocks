# Quadrant Tasks for Obsidian

[![CI](https://github.com/AngusK97/obsidian-quadrant-tasks/actions/workflows/ci.yml/badge.svg)](https://github.com/AngusK97/obsidian-quadrant-tasks/actions/workflows/ci.yml)
[![GitHub release](https://img.shields.io/github/v/release/AngusK97/obsidian-quadrant-tasks?sort=semver)](https://github.com/AngusK97/obsidian-quadrant-tasks/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Insert independent Eisenhower Matrix task boards directly into Markdown notes. Every board owns its tasks and completed history; there is no global task database or dedicated plugin view.

## Features

- Insert a complete four-quadrant board at the current editor cursor.
- Keep every board's data inside its own readable `quadrant-tasks` code block.
- Add multiple independent boards to one note or different notes.
- Rename each board from the pencil button beside its title; the custom title syncs inside the Markdown block.
- Switch the complete plugin interface between Chinese and English from Obsidian's plugin settings.
- Add, edit, delete, complete, restore, and move tasks without leaving the note.
- Drag active tasks between quadrants on desktop.
- Filter each board's completed history independently by quadrant and completion date.
- Preserve stable task IDs, exact completion timestamps, and ordering in hidden Markdown comments.
- Re-read the latest note and atomically replace only the selected board on every operation.
- Preserve sibling boards, frontmatter, callouts, prose, code, and all content outside the selected block.
- Work with Obsidian Sync, Remotely Save, and Git as ordinary Markdown content.
- Make no network requests and collect no telemetry.

## Installation

### BRAT

1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) community plugin.
2. Choose **Add beta plugin**.
3. Enter `AngusK97/obsidian-quadrant-tasks`.
4. Enable **Quadrant Tasks** in Obsidian's community plugin settings.

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/AngusK97/obsidian-quadrant-tasks/releases/latest).
2. Create `<Vault>/.obsidian/plugins/quadrant-tasks/`.
3. Copy the three files into that folder.
4. Reload Obsidian and enable **Quadrant Tasks**.

## Usage

1. Open a Markdown note in editing mode.
2. Place the cursor where the board should appear.
3. Click the grid icon in the left ribbon, or run **Quadrant Tasks: 在当前光标处插入四象限** from the command palette.
4. Use Live Preview or Reading view to interact with the rendered board.

To change the interface language, open **Settings → Quadrant Tasks → Interface language** and choose **中文** or **English**. The change applies immediately and does not rewrite any Markdown board data.

The inserted source remains part of the note:

````markdown
```quadrant-tasks
<!-- quadrant-board {"id":"board-example","version":2} -->

## 立即做
- [ ] 示例任务 #quadrant/do

## 安排

## 委派

## 舍弃

## 已完成
```
````

Use the insertion command instead of manually creating metadata. Each command invocation generates a new board ID. Duplicate board IDs inside the same note are treated as an ambiguity and blocked from writing; IDs may repeat safely in different notes because each note is an independent storage boundary.

## Storage and sync

There is no global task file in 2.0. A board's source text is its complete data store. Deleting the code block deletes that board; copying it to another note copies the board. Use the insertion command when creating another independent board in the same note so it receives a unique ID.

Every local operation uses Obsidian's atomic Vault API against the latest note content. Simultaneous offline edits can still produce the sync provider's normal last-write-wins behavior or a Git conflict; the plugin does not attempt distributed conflict resolution.

## Upgrading

- From 1.1: the managed block in the configured `Quadrant Tasks.md` is replaced in place by one independent `quadrant-tasks` code block. Other note content is preserved.
- From 1.0: legacy JSON tasks are inserted into `Quadrant Tasks.md` as one independent code block.
- Private backups remain under `.obsidian/plugins/quadrant-tasks/` and are never included in release assets.
- The old dedicated global view and global task-file setting are removed.

## Development

```bash
npm ci
npm run verify
```

`npm run verify` checks the source, rebuilds `main.js`, runs the task, legacy Markdown, local-board, migration, and bundle smoke tests.

## 中文说明

Quadrant Tasks 现在是可插入 Markdown 的局部四象限组件：

- 每次插入都会创建一张完全独立的四象限表。
- 表内任务和已完成列表直接保存在所在 Markdown 的代码块中。
- 同一笔记可以插入多张表，不同笔记中的表也互不影响。
- 勾选、恢复、编辑、删除、拖动和完成时间筛选都只影响当前表。
- 不再提供全局任务数据库、独立全局页签或全局任务文件设置。
- 通过命令面板运行“在当前光标处插入四象限”，或点击左侧网格图标即可插入。
- 代码块会随普通笔记一起被 Obsidian Sync、Remotely Save 或 Git 同步。

## License

[MIT](LICENSE)
