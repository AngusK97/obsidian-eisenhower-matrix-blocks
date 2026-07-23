# Eisenhower Matrix Blocks 维护手册

这份手册用于在任意一台新机器上恢复完整的开发、测试和发布能力。它不依赖原开发机器的目录结构，也不依赖 Codex 的历史任务记录。

项目的唯一源码基准是：

- GitHub 仓库：<https://github.com/AngusK97/obsidian-eisenhower-matrix-blocks>
- 默认分支：`main`
- 插件 ID：`eisenhower-matrix-blocks`
- Obsidian 社区插件名称：`Eisenhower Matrix Blocks`

Obsidian Vault 中 `.obsidian/plugins/eisenhower-matrix-blocks/` 只是测试或使用中的安装副本，不是源码仓库。不要直接在该目录中继续开发。

## 新机器快速清单

第一次在一台机器上接手时，依次完成以下步骤：

1. 安装 Git、Node.js 22、Obsidian 和 Codex；建议同时安装 GitHub CLI。
2. 确认 GitHub 身份验证可用。
3. 从 GitHub 克隆源码仓库，不要复制旧机器上的 `node_modules`。
4. 在仓库中运行 `npm ci` 和 `npm run verify`。
5. 在 Obsidian 中创建一个不含私人内容的独立测试 Vault。
6. 把构建出的 `main.js`、`manifest.json` 和 `styles.css` 复制到测试 Vault 的插件目录。
7. 在 Obsidian 中启用插件并完成一次基本功能检查。
8. 在 Codex 中打开源码仓库，先让它阅读本手册、`CONTRIBUTING.md`、当前 Git 状态和最近提交。

只要第 4 步和第 7 步通过，就已经具备继续维护的基本条件。

## 1. 安装基础工具

所有系统都需要：

- [Git](https://git-scm.com/downloads)
- [Node.js](https://nodejs.org/en/download) 22.x，和 CI 使用的版本保持一致
- npm，随 Node.js 一起安装
- [Obsidian](https://obsidian.md/download)
- Codex Desktop 或 [Codex CLI](https://developers.openai.com/codex/cli)
- 可选但推荐：[GitHub CLI](https://cli.github.com/)，用于检查 CI、Release 和构建证明

Windows 可以使用官方安装程序或 `winget`，macOS 可以使用官方安装程序或 Homebrew，Linux 可以使用 NodeSource、`nvm` 或发行版适用的软件源。无论采用哪种安装方式，最终都应让以下命令在新终端中成功：

```bash
git --version
node --version
npm --version
```

`node --version` 应显示 `v22.x.x`。如果机器上需要同时维护多个 Node.js 项目，建议使用 Node 版本管理器；不要为了本项目覆盖其他项目明确要求的 Node 版本。

## 2. 配置 GitHub 身份验证

先设置仅用于提交记录的 Git 身份：

```bash
git config --global user.name "你的 GitHub 显示名称"
git config --global user.email "你的 GitHub 提交邮箱"
```

使用 GitHub CLI 时，运行：

```bash
gh auth login
gh auth status
```

选择 `GitHub.com` 和 HTTPS 即可。没有 GitHub CLI 时，也可以在第一次 `git push` 时通过 Git Credential Manager 或 SSH 完成认证。

克隆后可用以下只读命令检查远端访问：

```bash
git remote -v
git ls-remote origin HEAD
```

远端应指向 `AngusK97/obsidian-eisenhower-matrix-blocks`。不要把访问令牌、SSH 私钥或凭据文件放进仓库。

## 3. 克隆并初始化仓库

### Windows PowerShell

```powershell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\source\repos"
Set-Location "$env:USERPROFILE\source\repos"
git clone https://github.com/AngusK97/obsidian-eisenhower-matrix-blocks.git
Set-Location .\obsidian-eisenhower-matrix-blocks
npm ci
npm run verify
```

### macOS 或 Linux

```bash
mkdir -p ~/source/repos
cd ~/source/repos
git clone https://github.com/AngusK97/obsidian-eisenhower-matrix-blocks.git
cd obsidian-eisenhower-matrix-blocks
npm ci
npm run verify
```

`npm ci` 会严格按照 `package-lock.json` 重建依赖。不要从旧机器复制 `node_modules`，也不要用 `npm install` 随意改写锁文件。

`npm run verify` 会检查源码语法、重新生成 `main.js`，并运行完整测试。它成功后再检查：

```bash
git status --short
```

全新克隆后的验证不应产生未提交差异。如果 `main.js` 被改动，说明当前构建环境生成的 bundle 与仓库不一致，应先排查 Node/npm 版本和依赖安装方式。

## 4. 在 Codex 中恢复工作上下文

在 Codex 中打开克隆后的源码仓库目录，而不是整个私人 Vault，也不是 Vault 中的插件安装目录。

新任务可以直接使用以下开场说明：

```text
这是 Eisenhower Matrix Blocks 的源码仓库。请先完整阅读 MAINTAINING.md、
CONTRIBUTING.md 和 README.md；如有 AGENTS.md 也请遵守。然后检查 git status、
最近提交、当前版本和可用 npm scripts，再开始本次任务。不要读取或提交私人 Vault 内容。
```

让 Codex 通过下列事实恢复当前状态，而不是依赖旧机器上的聊天记录：

```bash
git status --short --branch
git log -10 --oneline --decorate
git remote -v
node --version
npm run verify
```

重要决策应写入提交信息、Issue、Pull Request 或仓库文档。Codex 的任务记录可以提供线索，但不是项目状态的唯一来源。

## 5. 仓库结构

| 路径 | 用途 |
|---|---|
| `src/main.js` | Obsidian 插件入口、命令、设置和界面连接 |
| `src/core.js` | 任务与矩阵的核心数据逻辑 |
| `src/markdown-store.js` | Markdown 矩阵块的解析和序列化 |
| `src/board-store.js` | 通过 Obsidian Vault API 读取并原子更新矩阵块 |
| `src/i18n.js` | 中文、英文和跟随 Obsidian 的界面文案 |
| `tests/` | 核心逻辑、存储、迁移、本地化和 bundle 冒烟测试 |
| `main.js` | 由构建生成且需要提交的生产 bundle；不要手改 |
| `styles.css` | 桌面端和移动端样式 |
| `manifest.json` | Obsidian 插件元数据和当前插件版本 |
| `versions.json` | 插件版本与最低 Obsidian 版本的对应关系 |
| `package.json` / `package-lock.json` | Node.js 脚本、版本和锁定依赖 |
| `docs/demo/` | 可公开使用的虚构 Demo Vault 内容 |
| `docs/assets/` | README 和仓库展示素材 |
| `.github/workflows/ci.yml` | `main` 和 Pull Request 的自动验证 |
| `.github/workflows/release.yml` | 根据语义化版本标签自动发布 Release |
| `CHANGELOG.md` | 面向用户的版本变更记录 |

矩阵数据存放在用户笔记的 `eisenhower-matrix-blocks` Markdown 代码块中。界面语言等插件设置存放在 Vault 的插件 `data.json` 中，两者不要混淆。

## 6. 创建独立 Demo Vault

不要使用日常私人 Vault 做开发截图、迁移实验或破坏性测试。

1. 打开 Obsidian 的 Vault 管理器。
2. 选择 **Create new vault / 创建新库**。
3. 命名为 `Eisenhower Matrix Blocks Dev Vault`。
4. 将它放在源码仓库之外；最好也不要加入个人同步或 Git 仓库。
5. 打开 **Settings -> Community plugins**，允许并启用第三方插件。
6. 把 `docs/demo/Matrix Demo.md` 复制到这个 Vault，作为截图和回归检查用的虚构数据。

Vault 根目录中会出现 `.obsidian`。开发安装目录固定为：

```text
<Vault 根目录>/.obsidian/plugins/eisenhower-matrix-blocks/
```

如果看不到 `.obsidian`，请让文件管理器显示隐藏文件。不要猜测 Vault 路径；在 Obsidian 的 Vault 管理器或系统文件管理器中确认实际根目录。

## 7. 构建并安装到测试 Vault

先在源码仓库运行：

```bash
npm run verify
```

插件运行只需要以下三个文件：

```text
main.js
manifest.json
styles.css
```

### Windows PowerShell

把示例路径换成自己的测试 Vault：

```powershell
$PluginDir = "D:\Obsidian\Eisenhower Matrix Blocks Dev Vault\.obsidian\plugins\eisenhower-matrix-blocks"
New-Item -ItemType Directory -Force -Path $PluginDir
Copy-Item -Path @("main.js", "manifest.json", "styles.css") -Destination $PluginDir -Force
```

### macOS 或 Linux

把示例路径换成自己的测试 Vault：

```bash
PLUGIN_DIR="/path/to/Eisenhower Matrix Blocks Dev Vault/.obsidian/plugins/eisenhower-matrix-blocks"
mkdir -p "$PLUGIN_DIR"
cp main.js manifest.json styles.css "$PLUGIN_DIR/"
```

只复制这三个产物。不要把 `src/`、`tests/`、`node_modules/` 或整个 Git 仓库放进 Vault 的插件目录。

## 8. 在 Obsidian 中重载和测试

复制新产物后，执行以下任一操作：

- 在 **Settings -> Community plugins** 中关闭再开启插件。
- 完全退出并重新打开 Obsidian。
- 桌面端可在命令面板执行 Obsidian 提供的重载应用命令。

如果界面仍是旧版本，先确认复制目标确实属于当前打开的 Vault，再检查该目录中 `main.js` 的修改时间。仅修改 `src/` 不会更新已安装插件，必须构建并复制新的 `main.js`。

每次功能改动至少检查：

1. 能通过功能区图标和命令面板在光标处插入矩阵。
2. 实时预览和阅读视图都能渲染矩阵。
3. 四个象限都能添加、编辑、移动和删除任务。
4. 勾选任务会进入完成列表，取消勾选会回到原象限。
5. 象限筛选和完成时间筛选正确。
6. 同一笔记的多张矩阵互不影响，矩阵外正文保持不变。
7. 重新加载 Obsidian 后任务、顺序、标题和完成时间仍然存在。
8. `Follow Obsidian`、中文和 English 三种语言设置正确。
9. 相关改动在浅色与深色主题、桌面端与移动端布局下可用。

桌面端出现异常时可打开开发者工具查看 Console。提交问题时只保留必要错误信息，并删除私人路径、笔记内容和账号信息。

## 9. 每天开始工作的 Git 流程

换到另一台机器后，先确认工作区并读取远端状态：

```bash
git status --short --branch
git fetch origin
git branch --all
```

如果上一台机器的工作已经合并，或准备从 `main` 开始新任务：

```bash
git switch main
git pull --ff-only origin main
npm ci
npm run verify
```

如果上一台机器把未完成工作推送到了 `codex/<主题>` 分支，新克隆中还没有对应本地分支时运行：

```bash
git switch --track origin/codex/<主题>
git pull --ff-only
npm ci
npm run verify
```

已经存在本地分支时，使用 `git switch codex/<主题>` 后再执行 `git pull --ff-only`。可用 `gh pr list --author @me` 查找自己尚未合并的 Pull Request。

`npm ci` 在 `package-lock.json` 未变化时通常很快，可以避免两台机器的依赖状态不一致。若 `git pull --ff-only` 拒绝执行，不要强制覆盖；参照后面的冲突处理章节。

开始修改前还应阅读远端最近记录：

```bash
git log -5 --oneline --decorate
```

## 10. 离开当前机器前

跨机器工作能否连续，取决于改动是否已经进入 GitHub。离开前运行：

```bash
npm run verify
npm audit --omit=dev
git diff --check
git status --short
git diff --stat
```

确认无私人文件后，提交并推送：

```bash
git add <明确列出的文件>
git diff --cached
git commit
git push origin HEAD
```

不要使用 `git add .` 掩盖自己没有检查过的文件。尚未完成但必须换机器时，也应在独立分支创建清楚标记的临时提交并推送；未提交或未推送的内容无法从 GitHub 恢复。

推送到 `main` 后检查 CI：

```bash
gh run list --workflow CI --limit 5
gh run watch "$(gh run list --workflow CI --limit 1 --json databaseId --jq '.[0].databaseId')" --exit-status
```

也可以直接打开仓库的 [Actions 页面](https://github.com/AngusK97/obsidian-eisenhower-matrix-blocks/actions)。

## 11. 较大改动使用分支

小型文档或低风险修复可以直接在 `main` 上完成。跨多个模块、涉及存储格式或需要多轮试验的改动，建议使用分支：

```bash
git switch main
git pull --ff-only origin main
git switch -c codex/short-topic-name
```

完成后：

```bash
npm run verify
npm audit --omit=dev
git diff --check
git push -u origin codex/short-topic-name
gh pr create --base main --fill
```

合并前重点检查 Markdown 向后兼容、用户数据安全、桌面/移动布局，以及中文/英文界面。分支也必须在离开机器前推送，否则另一台机器看不到。

## 12. 提交前检查

最低自动检查：

```bash
npm run verify
npm audit --omit=dev
git diff --check
git status --short
git diff
```

审阅时确认：

- 改动集中在本次任务范围内。
- `src/` 改动对应的 `main.js` 已重新生成并一同提交。
- 没有手工编辑 `main.js`。
- 没有无意改写换行符、图片或锁文件。
- 存储格式变化有解析、序列化、迁移和异常输入测试。
- 矩阵更新不会改动矩阵外正文、frontmatter、callout 或同笔记其他矩阵。
- 用户可见行为已在 Obsidian 中实际验证，而不只是通过单元测试。
- 文档专用改动不需要修改插件版本，也不需要创建 Release。

## 13. 隐私和禁止提交的内容

永远不要提交：

- 真实的 Obsidian Vault 或私人笔记。
- `.obsidian/plugins/eisenhower-matrix-blocks/data.json`。
- `data-backup-*.json`、`global-note-backup-*.md` 或其他迁移备份。
- 含真实任务、姓名、公司信息、文件路径、账号、通知或设备信息的截图和录屏。
- API key、GitHub token、SSH 私钥、Cookie、遥测标识或 Codex 凭据。
- `node_modules/`、日志文件或编辑器临时文件。

公开素材只使用 `docs/demo/Matrix Demo.md` 中的虚构任务。截图加入 `docs/assets/` 前，放大检查整个画面，包括 Obsidian 标题栏、状态栏、侧边栏和系统通知区域。

提交前可快速列出将要进入提交的文件：

```bash
git diff --cached --name-only
git diff --cached
```

## 14. 修改版本号

只有发布新的插件行为时才升级版本。按语义化版本选择 patch、minor 或 major，然后保持以下文件一致：

1. `manifest.json` 中的 `version`。
2. `package.json` 中的 `version`。
3. `package-lock.json` 中根包的版本。
4. `versions.json` 新增 `"新版本": "最低 Obsidian 版本"`。
5. `CHANGELOG.md` 顶部新增日期和面向用户的变更说明。

可以先让 npm 同步 package 文件，但不要让它自动创建标签：

```bash
npm version <新版本> --no-git-tag-version
```

然后手工更新 `manifest.json`、`versions.json` 和 `CHANGELOG.md`，再运行：

```bash
npm run verify
git diff --check
git diff
```

用命令检查当前版本，不要依赖本手册中可能过期的示例：

```bash
node -p "require('./manifest.json').version"
node -p "require('./package.json').version"
```

## 15. 正式发布

发布工作流由 `.github/workflows/release.yml` 管理。它会检查标签与 `manifest.json` 版本一致，运行全部验证，为三个发布文件生成 GitHub attestation，并自动创建 GitHub Release。

严格按以下顺序操作：

1. 提交版本文件、源码、测试和生成的 `main.js`。
2. 推送 `main`。
3. 等待 `main` 上的 CI 成功。
4. 在同一个提交上创建与 `manifest.json` 完全相同的标签。
5. 只推送标签，让 GitHub Actions 自动创建 Release。

Windows PowerShell：

```powershell
$Version = node -p "require('./manifest.json').version"
git status --short
git log -1 --oneline
git tag -a $Version -m "Release $Version"
git push origin $Version
```

macOS 或 Linux：

```bash
VERSION="$(node -p "require('./manifest.json').version")"
git status --short
git log -1 --oneline
git tag -a "$VERSION" -m "Release $VERSION"
git push origin "$VERSION"
```

**不要手工运行 `gh release create`。** 自动工作流会执行这一步，手工创建同名 Release 会导致流程失败。也不要在标签推送后移动或复用已经公开的版本标签；发现问题时发布新的修复版本。

## 16. 验证 CI、Release 和 attestation

查看工作流：

```bash
gh run list --limit 10
gh run view --log-failed
```

查看当前版本的 Release：

```bash
VERSION="$(node -p "require('./manifest.json').version")"
gh release view "$VERSION"
```

PowerShell 中把第一行改为：

```powershell
$Version = node -p "require('./manifest.json').version"
gh release view $Version
```

Release 必须包含：

- `main.js`
- `manifest.json`
- `styles.css`

下载后可以验证 GitHub 构建证明。Windows PowerShell：

```powershell
$AssetDir = Join-Path $env:TEMP ("emb-release-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $AssetDir
gh release download $Version --dir $AssetDir
gh attestation verify (Join-Path $AssetDir "main.js") --repo AngusK97/obsidian-eisenhower-matrix-blocks
gh attestation verify (Join-Path $AssetDir "manifest.json") --repo AngusK97/obsidian-eisenhower-matrix-blocks
gh attestation verify (Join-Path $AssetDir "styles.css") --repo AngusK97/obsidian-eisenhower-matrix-blocks
```

macOS 或 Linux：

```bash
ASSET_DIR="$(mktemp -d)"
gh release download "$VERSION" --dir "$ASSET_DIR"
gh attestation verify "$ASSET_DIR/main.js" --repo AngusK97/obsidian-eisenhower-matrix-blocks
gh attestation verify "$ASSET_DIR/manifest.json" --repo AngusK97/obsidian-eisenhower-matrix-blocks
gh attestation verify "$ASSET_DIR/styles.css" --repo AngusK97/obsidian-eisenhower-matrix-blocks
```

这些目录只是本地核验用的临时目录，不应提交。

## 17. Obsidian Community Plugins 的更新方式

插件进入 Obsidian Community Plugins 后，日常版本发布不需要再次向 `obsidian-releases` 提交 PR。Obsidian 会根据已登记的 GitHub 仓库读取新的版本和 Release。

要让社区插件更新正常出现，必须同时满足：

- Git 标签、`manifest.json` 和 GitHub Release 使用相同的纯语义版本，例如 `2.3.0`，不要加 `v`。
- Release 中存在 `main.js`、`manifest.json` 和 `styles.css`。
- `versions.json` 包含该版本及最低 Obsidian 版本。
- GitHub Release 已公开，自动 Release 工作流成功。

GitHub README 通常读取默认分支，社区插件详情页和版本索引可能存在缓存延迟。先验证 GitHub Release 正确，再等待社区索引刷新；不要因为短暂延迟重复发布同一版本。

## 18. 常见故障

### 找不到 Node.js 或 npm

关闭并重新打开终端，再运行 `node --version`。仍找不到时重新安装 Node.js 22，并确认安装程序已把 Node 加入 `PATH`。

### `npm ci` 失败

确认正在源码仓库根目录，Node 是 22.x，且 `package-lock.json` 存在。不要先删除或改写锁文件。网络或 npm registry 问题解决后重新运行 `npm ci`。

### 验证后 `main.js` 意外变脏

先检查 `node --version` 和 `git diff -- main.js`。确认使用 Node 22 和 `npm ci` 安装依赖。若源码没有变化但 bundle 仍不同，不要直接提交，先找出依赖或构建环境差异。

### Obsidian 仍显示旧界面

确认执行过 `npm run verify`，三个产物复制到了当前 Vault 的正确插件目录，然后关闭再开启插件或重启 Obsidian。检查安装副本中 `main.js` 的修改时间。

### 插件没有出现在第三方插件列表

目录名必须是 `.obsidian/plugins/eisenhower-matrix-blocks`，且 `manifest.json` 必须直接位于该目录中，不能多嵌套一层。确认当前 Vault 已允许第三方插件，然后重启 Obsidian。

### Git 提示本地修改阻止拉取

先运行 `git status` 和 `git diff`。把有效工作提交到独立恢复分支并推送，再处理远端更新。不要使用 `git reset --hard` 或覆盖文件来消除提示。

### 分支已经 diverged 或出现冲突

运行以下只读命令收集事实：

```bash
git fetch origin
git status
git log --graph --oneline --decorate --all -20
```

保留双方提交，再通过 merge、rebase 或 cherry-pick 处理。若 `main.js` 冲突，先解决 `src/` 和依赖文件，再运行 `npm run verify` 重新生成 bundle。对不熟悉的历史重写操作，应让 Codex 基于当前提交图给出针对性步骤，不要套用通用的强制推送命令。

### Release 因标签或同名 Release 失败

先运行：

```bash
gh release view <版本>
git ls-remote --tags origin <版本>
gh run view --log-failed
```

如果 Release 已由自动流程正确创建，无需重复发布。如果有人提前手工创建了同名 Release，先核对其中资产和标签，再决定是否在 GitHub 中清理错误 Release 并重新运行失败任务。删除公开 Release 或移动公开标签会影响用户，不能作为默认修复。版本或资产已经公开且有误时，发布新的 patch 版本。

## 19. 从任意机器紧急恢复

旧机器无法使用时，GitHub 上最后一次推送的提交就是可恢复边界：

1. 安装 Git 和 Node.js 22。
2. 重新克隆 GitHub 仓库到一个全新目录。
3. 运行 `npm ci` 和 `npm run verify`。
4. 创建新的独立 Demo Vault。
5. 复制三个插件产物并在 Obsidian 中验证。
6. 用 `git log`、GitHub Issues、Pull Requests、Actions 和 Releases 恢复决策背景。

可用以下命令检查远端所有分支和标签：

```bash
git fetch --all --tags
git branch --all
git tag --sort=-version:refname
git log --graph --oneline --decorate --all -30
```

已经发布的可执行插件还可以从 [GitHub Releases](https://github.com/AngusK97/obsidian-eisenhower-matrix-blocks/releases) 重新下载。未提交、未推送的源码以及只存在于旧机器的私人 Vault 数据无法通过本仓库恢复，因此每次换机器前都要完成提交、推送和远端验证。

## 20. 维护原则

- GitHub 仓库保存源码和公开文档；Vault 保存用户笔记；插件目录保存可替换的构建产物。
- 先拉取、再修改；先验证、再提交；先推送 `main`、再推送发布标签。
- 保持 Markdown 存储向后兼容，未经测试不要重写用户笔记格式。
- 任何自动化工具，包括 Codex，都必须在提交前接受 diff、测试和隐私检查。
- 遇到不确定状态时先运行只读命令收集事实，不要用破坏性 Git 命令掩盖问题。

更具体的代码修改规则和 Pull Request 清单见 [CONTRIBUTING.md](CONTRIBUTING.md)。
