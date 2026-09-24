# Actual-renderer browser preview

From the source repository, run `node scripts/ui-preview.cjs`, then open
`http://127.0.0.1:4173/`. Use `?theme=dark&lang=zh` or `?theme=light&lang=en`.
Set `PORT` to choose another port. No extra dependencies beyond the existing
development dependency `esbuild` are required. Source is rebuilt in memory on
each page load, with no generated files or Vault writes.

The harness loads the **actual production `MatrixBoardRenderChild`**, production
CSS, task operations, localization and Markdown parsing/serialization. It exposes
the renderer at bundle time without changing production exports. Editing,
quick-add, completion, undo, filters, title edits and drag operations use the real
renderer event handlers. Saves round-trip through the real board document store.

Only the Obsidian shell is emulated: DOM convenience methods, Modal/Menu/Notice,
theme variables and approximate icons. This is not an Obsidian integration test:
native window focus traps, mobile software keyboards, platform date pickers,
workspace/Vault events and real Obsidian theme inheritance require app/device
verification. Icon drawings here are illustrative, not official Obsidian icons.

Recommended viewports: desktop 1440×1000, mobile 390×844, compact 320×740, with
light/dark themes, plus a narrow desktop note pane. Fixtures use the current local
date: overdue, today, exactly +3/+7/+8 days, optional 24-hour time, colorful tags,
empty details, long text, 12 completed today and one yesterday. QA also applies
hostile host-theme button styling, verifies full metadata units and checks tag
contrast. Single native date fields, localized Due/Completed on captions, icon
geometry and mobile clear-time targets are tested; the OS calendar popup and
real mobile keyboards still need device acceptance.

Time-control checks cover hidden clear buttons without reserved space, a shared
surface with the native input, live visibility, date preservation, focus return,
and the 44px mobile target in quick-add and editor flows.

Task-card QA also injects Minimal-style compact list spacing and ordinary Markdown
list margins after plugin CSS. It verifies full-row padding, real inter-card gaps,
focus/drop feedback, and dispatches a drop into a visible gap to check insertion
between adjacent cards instead of appending to the quadrant.

For browser automation, `window.matrixPreview` provides `renderer`, `getData()`,
`getMarkdown()`, `reload()` (recreate the renderer from its saved Markdown), and
`failNextSave()` (intentional rejected write, to test draft recovery). Browser
refresh resets task fixture data but preserves layout preferences in this test
browser's local storage. The server listens only on loopback.

Optional automated QA: with the server running, use `node tests/browser/run.cjs`.
Supply an installed Playwright module using `PLAYWRIGHT_MODULE` if it is not on
Node's module path, `QA_BROWSER` for the browser executable, and `QA_OUTPUT` for
screenshots (defaults to the OS temporary `matrix-qa` directory). No personal
machine paths or browser dependencies are committed to the production package.

Run `node tests/browser/layout.cjs` with the same environment to verify Auto / Grid /
Vertical layouts at desktop, 560px note, 390px and 320px widths. It checks live-draft
preservation, metadata bounds, contained keyboard scrolling, and bidirectional
cross-column drops after horizontal edge auto-scroll. Grid and Vertical survive
renderer recreation and full page reload; Auto resets the saved override. Task
Markdown remains unchanged by layout selection. The harness emulates the app's
vault-local storage with browser localStorage; real app restart still needs device acceptance.
