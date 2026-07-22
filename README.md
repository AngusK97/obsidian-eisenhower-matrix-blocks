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
- Responsive 2x2 desktop layout and single-column mobile layout.
- Local-only storage with no network requests or telemetry.
- Automatic rollback and a visible warning if Obsidian cannot save task data.

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

Open the board from the grid icon in the left ribbon, or run **Quadrant Tasks: 打开四象限任务** from the command palette.

## Data and privacy

Tasks are stored in `.obsidian/plugins/quadrant-tasks/data.json`. The plugin does not read or modify Markdown notes and does not make network requests.

Obsidian Sync or another sync tool can synchronize the plugin data directory. Concurrent offline edits on multiple devices use the sync provider's last-write-wins behavior; the plugin does not merge conflicting task databases.

`data.json` is ignored by Git and is never part of a release.

## Development

```bash
npm ci
npm run verify
```

`npm run verify` checks the source, rebuilds `main.js`, runs the data-layer tests, and loads the bundle against a mocked Obsidian runtime.

## 中文说明

Quadrant Tasks 是一个专注的四象限任务插件：

- 每个象限都可以直接输入并添加任务。
- 勾选后任务会进入统一的已完成列表，同时保留来源象限和完成时间。
- 已完成任务可以按象限、今天、近 7 天、近 30 天或自定义日期范围筛选。
- 支持编辑、删除、跨象限移动、恢复任务和撤销操作。
- 数据只保存在插件自己的 `data.json` 中，不会改写你的 Markdown 笔记。

## License

[MIT](LICENSE)
