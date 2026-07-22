# Changelog

## 2.0.0 - 2026-07-22

- Replace the single global board with independent `quadrant-tasks` code blocks embedded in Markdown notes.
- Add a command and ribbon action that insert a complete board at the current editor cursor.
- Keep each board's active tasks, completed history, filters, IDs, and timestamps inside its own code block.
- Support multiple isolated boards in one note and across different notes.
- Remove the dedicated global view and global task-file settings.
- Atomically update only the selected code block while preserving sibling boards and surrounding note content.
- Automatically migrate 1.1 global Markdown storage and 1.0 JSON storage into a local board with private backups.

## 1.1.0 - 2026-07-22

- Store tasks in a normal Markdown file while keeping the visual four-quadrant board.
- Migrate legacy JSON tasks after creating a private backup and verifying the Markdown result.
- Rebase every task mutation on the latest file content with Obsidian's atomic Vault API.
- Reload the board after external create, edit, rename, and delete events from sync tools or other editors.
- Add a setting and command for opening or safely moving the task Markdown file.
- Refuse to overwrite malformed managed content and keep legacy storage available if migration fails.

## 1.0.0 - 2026-07-22

- Add a responsive four-quadrant task board.
- Add a unified completion history with quadrant and date-range filters.
- Add task editing, moving, restoration, deletion, and undo actions.
- Add local JSON persistence with save-failure rollback.
- Add automated data-layer and bundle-loading tests.
