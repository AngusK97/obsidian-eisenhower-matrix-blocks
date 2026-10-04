# ADR-004: Preserve view continuity during task writes

Date: 2026-10-04. Status: accepted for 2.8.3.

## Evidence

The 2.8.2 renderer rebuilt its root after every task update and again after quick-add settled. Duplicate data notifications also rebuilt it. Browser regressions reproduced lost list/grid scroll and focus. The reported outer-note jump was not reproduced in actual Obsidian; the browser fixture is not CodeMirror or Vault.process.

## Decision

- Deduplicate normalized data; reconcile task rows by ID and content, excluding order-only changes. Keep forms, list containers, unchanged rows and handlers alive.
- Capture list task anchors and offsets, horizontal position, ancestor scrollers and a visible section anchor. Restore synchronously around necessary updates; never run an interval that fights user scrolling.
- Clear submitted fields in place, preserve newer drafts, and notify live renderers sharing an in-flight draft. Defer full rebuilds during native partial input or IME composition until input becomes safe to reconstruct.
- Around serialized Vault.process writes, arm short-lived view handoff keyed by actual containing View plus note/board identity and owner document. New renderers always parse current Markdown; only view state and draft references transfer. Reject duplicate embeds, wrong panes, navigation, expired tickets and still-connected old roots. Dispose listeners promptly.
- Handoff is best-effort: unidentified panes, ambiguous embeds, overlapping connected roots and host layout timing beyond the synchronous restore are not guaranteed. It is not persistent scroll memory.
- Host-forced removal cannot reconstruct an OS-native invalid date/time segment or an unfinished IME candidate from its public string value. Semantic drafts transfer, but those transient editing states are outside this fix. We deliberately do not block every write in the file indefinitely because another form has incomplete input. Same-renderer rebuilds do defer safely.

## Verification and limits

Node tests exercise incremental updates, in-flight input and handoff isolation/cancellation. Optional browser tests use the actual renderer in a simulated host:

```sh
node scripts/ui-preview.cjs
node tests/browser/scroll.cjs
node tests/browser/handoff.cjs
node tests/browser/run.cjs
node tests/browser/layout.cjs
```

Supply Playwright and a browser via PLAYWRIGHT_MODULE / QA_BROWSER. Drag continuity tests call the real drag commit path, not a physical gesture. Physical mobile, Obsidian Reading view, Live Preview and host focus/scroll anchoring still need device acceptance. No private note content, new dependency, task storage change or persistent scrolling setting is introduced.
