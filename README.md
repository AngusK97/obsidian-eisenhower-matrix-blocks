# Quadrant Tasks for Obsidian

[![CI](https://github.com/AngusK97/obsidian-quadrant-tasks/actions/workflows/ci.yml/badge.svg)](https://github.com/AngusK97/obsidian-quadrant-tasks/actions/workflows/ci.yml)
[![GitHub release](https://img.shields.io/github/v/release/AngusK97/obsidian-quadrant-tasks?sort=semver)](https://github.com/AngusK97/obsidian-quadrant-tasks/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A focused Eisenhower Matrix task board for Obsidian. Add tasks directly to four quadrants, check them off into one completion history, and filter that history by source quadrant and completion date.

## Features

- Four clear quadrants: Do, Schedule, Delegate, and Eliminate.
- Persistent quick-add input in every quadrant.
- Complete tasks with a checkbox and restore them from the completion history.
- Filter completed tasks by quadrant, today, the last 7 days, the last 30 days, or a custom date range.
- Edit, delete, and move tasks from an action menu; drag tasks between quadrants on desktop.
- Undo completion, restoration, and deletion.
- Store every task in a normal Markdown note that works with Obsidian Sync, Remotely Save, and Git.
- Re-read the latest Markdown before each write and reload after external file changes.
- Preserve content outside the plugin-managed block, including frontmatter, callouts, and notes.
- Responsive 2x2 desktop layout and single-column mobile layout.
- No network requests or telemetry.

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

Open the board from the grid icon in the left ribbon, or run **Quadrant Tasks: 打开四象限任务** from the command palette. Run **Quadrant Tasks: 打开任务 Markdown 文件** to inspect the underlying note.

## Markdown storage and sync

Tasks are stored in `Quadrant Tasks.md` at the Vault root by default. You can move it from **Settings -> Quadrant Tasks -> Task Markdown file**, or move it in Obsidian's file explorer; the plugin follows the rename.

The note contains a block delimited by these comments:

```markdown
<!-- quadrant-tasks:start -->
...
<!-- quadrant-tasks:end -->
```

The four active sections and the completed list remain readable as standard Markdown tasks. Hidden comments preserve stable IDs, the source quadrant, exact completion time, and ordering. Content outside the managed block is preserved byte for byte. If the managed block is malformed, the plugin refuses to write instead of replacing uncertain content.

Because this is a normal Vault note, it is included by Obsidian Sync, Remotely Save, and Git whenever those tools include its path. The plugin uses the latest local file content for every task operation. Simultaneous offline changes can still produce the sync provider's normal last-write-wins behavior or a Git conflict; the plugin does not attempt distributed conflict resolution.

`data.json` now stores only the Markdown path and migration metadata. When upgrading from 1.0.0, the plugin first creates `.obsidian/plugins/quadrant-tasks/data-backup-1.0.0.json`, migrates the legacy tasks, and verifies their IDs before switching to Markdown. If migration fails, the plugin keeps using the legacy JSON data for that session.

Task notes and plugin `data.json` are local Vault data. They are not copied into this source repository and are never included in GitHub release assets.

## Development

```bash
npm ci
npm run verify
```

`npm run verify` checks the source, rebuilds `main.js`, runs the data and Markdown storage tests, and loads the bundle against a mocked Obsidian runtime.

## 中文说明

Quadrant Tasks 是一个专注的四象限任务插件：

- 每个象限都可以直接输入并添加任务。
- 勾选后，任务会进入统一的已完成列表，同时保留来源象限和精确完成时间。
- 已完成任务可以按象限、今天、近 7 天、近 30 天或自定义日期范围筛选。
- 支持编辑、删除、跨象限移动、恢复任务和撤销操作。
- 任务默认保存在笔记库根目录的 `Quadrant Tasks.md`，因此能像普通笔记一样通过 Obsidian Sync、Remotely Save 或 Git 同步。
- 插件仍提供完整的四象限图形界面；Markdown 只是可读、可同步的数据源。
- 插件只管理两个注释标记之间的区域，不会改写区域外的笔记内容。

## License

[MIT](LICENSE)
