# ADR-003: Device-local matrix layout preferences

Status: Accepted — 2026-09-24, plugin 2.8.2.

## Decision

Persist layout separately from task Markdown and plugin `data.json`, keyed by note
path and board ID inside the current vault's device-local storage. Desktop and
mobile can therefore keep different layouts, while panes of the same matrix in
one plugin instance agree. Write synchronously before changing pane attributes;
a failed write leaves the old selection intact and displays a localized notice.
Do not re-render the board when changing layout: unfinished native date/time
input and unconfirmed tags must survive.

`src/layout-preferences.js` uses the public `App.loadLocalStorage` /
`App.saveLocalStorage` methods, introduced in Obsidian 1.8.7. To retain the existing
1.5.0 minimum, older hosts use browser localStorage scoped by the adapter's root
resource URI (not the vault display name, which can collide). API signatures and
availability are defined by the [official Obsidian API](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts).

Stored values are validated `[notePath, boardId, layout]` entries. Only explicit
grid/vertical overrides are stored. When the new API has no entry, old-host
storage remains readable; the first subsequent write stores the complete result
through the new API. An empty array is an explicit Auto reset marker, so old
preferences cannot reappear after a host upgrade. No startup migration or task
schema change is required.

## Consequences and alternatives

- Note/folder rename events migrate matching paths, including closed notes;
  path-prefix checks do not match similarly named sibling folders.
- An external rename while Obsidian is closed, moving the vault on older hosts,
  clearing application storage, or changing a board ID may reset the preference.
- Copying a board into a different note does not copy its layout preference.
- Deleted boards may leave harmless local preference entries. No note contents
  or task data are stored in these entries, and no data is sent over the network.
- Storing layout in Markdown was rejected because it would synchronize a desktop
  layout onto mobile and trigger note re-rendering during draft entry.
- A global layout default was rejected because matrices can need different layouts.

Regression coverage includes new plugin/renderer instances, full browser page
reload, isolated boards/devices/vaults, Auto reset, live drafts, multi-pane updates,
rename events, malformed values, write failures, and upgrading the host storage API.
Browser tests emulate the host API; actual Obsidian/mobile restart acceptance is
still a device-level check.
