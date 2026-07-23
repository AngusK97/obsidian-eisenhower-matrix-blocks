<p align="right"><a href="README.md">English</a> | <strong>简体中文</strong></p>

# Eisenhower Matrix Blocks for Obsidian

[![CI](https://github.com/AngusK97/obsidian-eisenhower-matrix-blocks/actions/workflows/ci.yml/badge.svg)](https://github.com/AngusK97/obsidian-eisenhower-matrix-blocks/actions/workflows/ci.yml)
[![GitHub release](https://img.shields.io/github/v/release/AngusK97/obsidian-eisenhower-matrix-blocks?sort=semver)](https://github.com/AngusK97/obsidian-eisenhower-matrix-blocks/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**直接生活在 Obsidian 笔记中的四象限任务矩阵。**

在任意 Markdown 笔记中插入独立的 Eisenhower Matrix，就地管理任务，并保留可筛选的完成记录，无需全局任务数据库。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/matrix-desktop-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="docs/assets/matrix-desktop-light.png">
  <img src="docs/assets/matrix-desktop-light.png" alt="嵌入 Obsidian 笔记中的 Eisenhower Matrix Blocks">
</picture>

- **属于每篇笔记：** 每个矩阵独立拥有自己的任务和完成记录，同一篇笔记可以插入多个矩阵。
- **由 Markdown 保存：** 任务、象限、顺序和完成时间随着笔记通过 Obsidian Sync、Remotely Save 或 Git 同步。
- **完整任务流程：** 无需离开矩阵即可添加、编辑、移动、完成、恢复、删除和筛选任务。

矩阵会插入当前编辑器光标所在的位置，始终属于这篇笔记，而不是变成独立的全局任务面板。

## 快速开始

1. [安装插件](#安装方式)，然后在 Obsidian 中启用 **Eisenhower Matrix Blocks**。
2. 打开一篇可编辑的 Markdown 笔记，把光标放到需要插入矩阵的位置。
3. 点击左侧边栏的网格图标，或在命令面板运行 **Eisenhower Matrix Blocks：在当前光标处插入四象限**。
4. 在实时预览或阅读视图中使用渲染后的矩阵。

每次插入都会生成一个新的独立矩阵 ID。如果要在同一篇笔记中再放一个矩阵，请再次运行插入命令。

## 安装方式

Eisenhower Matrix Blocks 尚未被 Obsidian Community Plugins 正式收录。在通过审核前，可以使用 BRAT 或 GitHub Release 安装。

### 使用 BRAT

1. 安装社区插件 [BRAT](https://github.com/TfTHacker/obsidian42-brat)。
2. 选择 **Add beta plugin**。
3. 输入 `AngusK97/obsidian-eisenhower-matrix-blocks`。
4. 在 Obsidian 的第三方插件设置中启用 **Eisenhower Matrix Blocks**。

### 手动安装

1. 从[最新 Release](https://github.com/AngusK97/obsidian-eisenhower-matrix-blocks/releases/latest)下载 `main.js`、`manifest.json` 和 `styles.css`。
2. 创建 `<Vault>/.obsidian/plugins/eisenhower-matrix-blocks/` 目录。
3. 把三个文件复制到该目录。
4. 重新加载 Obsidian，然后启用 **Eisenhower Matrix Blocks**。

## 与其他任务方式有什么不同

许多任务工具会把任务集中到全局数据库或独立页面中。Eisenhower Matrix Blocks 把数据归属边界保留在笔记内部：

- 项目笔记可以拥有自己的矩阵和完成记录。
- 同一篇笔记可以包含多个互不影响的矩阵。
- 复制矩阵代码块就会复制数据，删除代码块就会删除该矩阵。
- 不需要插件专用的全局任务文件。
- 每次操作只修改当前矩阵，并保留周围正文、frontmatter、callout、代码和同文件中的其他矩阵。
- 插件不发送网络请求，也不收集遥测数据。

## 核心工作流

| 工作流 | 行为 |
|---|---|
| 添加 | 直接向重要且紧急、重要不紧急、紧急不重要或不重要不紧急象限添加任务。 |
| 编辑 | 点击任务标题即可编辑，不需要打开其他页面。 |
| 移动 | 所有设备都可以使用任务菜单；桌面端还可以在象限之间拖动。 |
| 完成 | 勾选任务后，它会进入统一的已完成列表并记录准确完成时间。 |
| 恢复 | 取消勾选已完成任务，它会回到原来的象限。 |
| 筛选 | 按来源象限，以及今天、近 7 天、近 30 天或自定义时间段筛选完成记录。 |
| 改名 | 每个嵌入式矩阵都可以拥有自己的标题，默认标题为 `Matrix`。 |

## 由 Markdown 保存

![矩阵界面与可读 Markdown 源码的对照](docs/assets/markdown-source.png)

笔记中的 `eisenhower-matrix-blocks` 代码块保存了矩阵的全部状态：

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

源码中的可见标题是稳定的存储标记。实际渲染界面会根据插件设置显示中文或英文。

隐藏的 Markdown 注释保存稳定任务 ID、来源象限、顺序、创建时间和准确完成时间。建议使用插入命令创建矩阵，不要手动编写元数据。

## 数据与多端同步

插件没有全局任务数据库，矩阵源码就是完整数据。

- Obsidian Sync、Remotely Save 和 Git 可以把矩阵当作普通笔记内容同步。
- 多台设备同时离线编辑时，仍然遵循所选同步工具自身的冲突处理方式。
- 每次本地操作都会重新读取最新笔记，并通过 Obsidian 的原子 Vault API 修改当前矩阵。
- 同一篇笔记中出现重复矩阵 ID 时，插件会停止写入以避免歧义；不同笔记可以安全地使用相同 ID。
- 删除矩阵代码块等于删除该矩阵，因此仍然建议保留笔记历史或备份。

界面语言保存在插件本地的 `data.json` 中，与矩阵数据分离。切换语言不会重写笔记。

## 手机与界面语言

矩阵会在 Obsidian Mobile 的窄屏中使用响应式布局。移动端无法使用桌面拖放时，可以通过任务菜单移动任务。

打开 **设置 → Eisenhower Matrix Blocks → 界面语言**，选择 **中文** 或 **English**。标题、菜单、筛选器、控件、日期、命令和提示会立即切换，矩阵代码块不会被重写。

## 兼容与升级

- 改名前创建的 `quadrant-tasks` 代码块仍然可以正常读取和编辑。
- 1.1 版本的全局 Markdown 数据会在创建私人备份后原地迁移为独立矩阵。
- 1.0 版本的 JSON 数据会在创建私人备份后插入旧任务笔记。
- 私人备份只保存在当前插件目录，不会进入 Release 附件。
- 旧的全局页面和全局任务文件设置已不再提供。

## 常见问题

### 同一篇笔记可以放多个矩阵吗？

可以。每创建一个新矩阵都应运行一次插入命令，以获得独立的矩阵 ID。

### 任务会在多台设备间同步吗？

矩阵数据保存在笔记中，因此会跟随笔记同步。界面语言等插件设置单独保存，是否同步取决于同步工具是否包含 Obsidian 配置文件。

### 插件会扫描整个 Vault 的任务吗？

不会。插件只处理明确插入的矩阵代码块，不会建立全局任务索引。

### 可以手动修改 Markdown 吗？

格式是可读的，但推荐使用插入命令和可视化控件，因为它们会维护 ID 和时间戳。遇到损坏或有歧义的内容时，插件会拒绝危险写入。

### 离线可以使用吗？

可以。插件完全在本地运行，不发送网络请求。

## 参与贡献

欢迎提交 Bug 和功能建议。请使用虚构或经过清理的示例，不要上传完整的私人 Vault。

开发环境、兼容要求、隐私规则和验证清单请参阅 [CONTRIBUTING.md](CONTRIBUTING.md)。

```bash
npm ci
npm run verify
```

## 开源许可

[MIT](LICENSE)
