# Contributing to Eisenhower Matrix Blocks

Thanks for helping improve Eisenhower Matrix Blocks. Changes should preserve note-local ownership, readable Markdown storage, and compatibility with existing boards.

## Development setup

Requirements:

- Node.js 22 or a compatible current LTS release
- npm
- An isolated Obsidian test vault

Install dependencies and verify the repository:

```bash
npm ci
npm run verify
```

`npm run verify` checks JavaScript syntax, rebuilds `main.js`, and runs the complete test suite.

## Repository structure

- `src/` contains the source modules.
- `tests/` contains data, Markdown, migration, localization, and bundle smoke tests.
- `main.js` is the committed production bundle loaded by Obsidian.
- `manifest.json` and `styles.css` are release assets.
- `docs/demo/` contains fictional, publishable README demo data.
- `docs/assets/` contains public README media.

Do not edit the generated `main.js` by hand. Change `src/`, run `npm run build`, and commit the resulting bundle with the source change.

## Change requirements

### Markdown and storage changes

- Preserve all content outside the selected matrix block byte for byte.
- Keep existing `quadrant-tasks` blocks readable unless an explicit, tested migration is provided.
- Add regression tests for parsing, serialization, migration, line endings, duplicate IDs, and malformed content as applicable.
- Keep board mutations on Obsidian's atomic Vault processing path.

### Interface changes

- Follow the existing Obsidian-native interaction patterns.
- Verify both Chinese and English interfaces.
- Verify desktop and mobile layouts.
- Keep quadrant identity labels separate from action prompts.
- Preserve accessible names for icon buttons, filters, task controls, and form fields.

### Privacy

Never commit:

- A real Obsidian vault or personal note
- `.obsidian/plugins/eisenhower-matrix-blocks/data.json`
- `data-backup-*.json` or `global-note-backup-*.md`
- Screenshots containing real tasks, paths, account names, or notifications
- API keys, tokens, credentials, or telemetry identifiers

Use `docs/demo/Matrix Demo.md` for public screenshots and recordings.

## Before opening a pull request

1. Run `npm run verify`.
2. Run `npm audit --omit=dev`.
3. Run `git diff --check`.
4. Review the complete diff, including the generated bundle.
5. Confirm no private plugin data or vault content is present.
6. Describe any Markdown-format or compatibility impact explicitly.
7. State which desktop, mobile, light, dark, Chinese, and English checks were performed.

Keep changes focused. Documentation-only work does not require a plugin version bump or release unless it accompanies a shipped behavior change.
