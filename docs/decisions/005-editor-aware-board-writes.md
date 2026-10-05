# ADR-005: Editor-aware board writes and bounded scroll protection

Date: 2026-10-06
Status: Accepted

## Context

After 2.8.3's incremental rendering and pane-local handoff, the user still reports jumping to the matrix top on iPhone Live Preview after completion or dragging, including with the keyboard closed. The file-level save path can resynchronize an open editor, and a one-shot restoration cannot cover later editor measurement. These are verified implementation risks, not a reproduction of the unique iOS root cause.

## Decision

For a file open in source mode, read its current public Editor buffer inside the existing per-file queue and synchronously apply one minimal contiguous `Editor.transaction` change. Capture the initiating pane before queueing, then revalidate its editor/file/mode at execution (a renderer root can be replaced while waiting). Require the view's file path to match the board source, especially embeds. Divergent buffers for the same file reject the write. Initially identical independent editors receive the same minimal change, initiating pane first; shared editors or buffers already synchronized by the host are not written twice. Run the task updater only once. No full `setValue`, forced focus, explicit selection or private CodeMirror access. Obsidian maps selections and owns undo and autosave; applying a transaction is not a durable-disk acknowledgement.

Public Editor API has no atomic multi-pane transaction. If a later pane fails after another changed, cancel guards and show an explicit partial-application warning: inspect/reconcile the note before retrying, especially task additions. Do not roll back potentially newer content or retry against disk. This favors visible, recoverable conflicts over silent overwrites.

With no editing view, continue to use atomic `Vault.process`. This supersedes ADR-004's all-writes-through-Vault assumption, not its view handoff. Never fall back to disk after an editor exception. Refreshes prefer the live editor buffer, including editor-change notifications and a second check after asynchronous disk reads, so stale disk content cannot roll the UI back while autosave is pending.

For a visible editing pane, capture its public scroll position before a transaction. A short, event-driven guard covers later scroll events, with a 750 ms deadline and at most four corrections. It does not focus an input or manipulate inner task lists. A new touch/pointer/wheel/keyboard/input/composition, visual viewport resize, navigation, document change, hidden window, or newer guard yields immediately. All listeners and timers are disposed. Normal user scrolling always takes precedence.

## Tradeoffs and validation

A single range can span much of a board during reorder; host selection mapping inside that changed region is authoritative. A conflict between independent same-file buffers is rejected instead of merged. Source mode also includes plain-source editing; public API does not distinguish it from Live Preview. No task serialization, CSS, persistent preferences or dependencies change.

Tests cover unsaved surrounding notes, sibling boards, Unicode/CRLF, sequential writes, conflicting buffers, stale disk refresh, failures, delayed scroll and cancellation/cleanup. Browser renderer regressions remain supplemental: neither fake Editor tests nor desktop mobile-size emulation verify real iOS WebView behavior. Physical iPhone acceptance is pending after release.

References: [Obsidian Editor API](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts), [official active-file guidance](https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Plugins/Releasing/Plugin%20guidelines.md#prefer-the-editor-api-instead-of-vaultmodify-to-the-active-file), [CodeMirror measurement model](https://codemirror.net/docs/guide/).
