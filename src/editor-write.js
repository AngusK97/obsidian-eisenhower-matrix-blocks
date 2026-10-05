"use strict";

// Never use the active leaf: an embedded board can belong to a different file.
function readEditorBuffer(plugin, sourcePath, preferredView) {
	const views = [];
	plugin.app.workspace.iterateAllLeaves?.(({ view }) => {
		if (view?.file?.path === sourcePath && view.getMode?.() === "source" && view.editor) views.push(view);
	});
	if (!views.length) return null;
	const view = views.includes(preferredView) ? preferredView : views[0];
	const content = view.editor.getValue();
	if (views.some(candidate => candidate.editor.getValue() !== content)) {
		throw new Error("Open editors have conflicting unsaved buffers; reconcile them before changing this board.");
	}
	return { view, views, content };
}

function splitsPair(text, offset) {
	const before = text.charCodeAt(offset - 1);
	const after = text.charCodeAt(offset);
	return (before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff)
		|| (before === 13 && after === 10);
}

function changedRange(before, after) {
	let start = 0;
	while (start < before.length && start < after.length && before[start] === after[start]) start += 1;
	if (splitsPair(before, start) || splitsPair(after, start)) start -= 1;
	let end = before.length;
	let nextEnd = after.length;
	while (end > start && nextEnd > start && before[end - 1] === after[nextEnd - 1]) { end -= 1; nextEnd -= 1; }
	if (splitsPair(before, end) || splitsPair(after, nextEnd)) { end += 1; nextEnd += 1; }
	return { start, end, text: after.slice(start, nextEnd) };
}

function tryEditorWrite(plugin, sourcePath, boardId, updater, preferredView) {
	const buffer = readEditorBuffer(plugin, sourcePath, preferredView);
	if (!buffer) return null;
	const { view, views, content: before } = buffer;
	const outcome = updater(before, boardId);
	const after = outcome.content;
	if (after !== before) {
		const change = changedRange(before, after);
		const orderedViews = [view, ...views.filter(candidate => candidate !== view)];
		const editors = [...new Set(orderedViews.map(candidate => candidate.editor))];
		const cancelGuards = [];
		try {
			// A host transaction can synchronize sibling panes immediately: capture
			// every pane's position before writing to any of their editors.
			for (const candidate of orderedViews) cancelGuards.push(plugin.editorScrollGuards?.arm(candidate, after));
			for (const editor of editors) {
				const current = editor.getValue();
				if (current === after) continue;
				if (current !== before) throw new Error("Open editor changed during this operation; resolve the buffer conflict before continuing.");
				// No await between buffer read and transaction. Host maps selections and
				// owns autosave/undo; never replace the entire note or refocus its cursor.
				editor.transaction({ changes: [{
					from: editor.offsetToPos(change.start),
					to: editor.offsetToPos(change.end),
					text: change.text,
				}] }, "eisenhower-matrix");
			}
		} catch (error) {
			for (const cancel of cancelGuards) cancel?.();
			const partiallyWritten = editors.some(editor => {
				try { return editor.getValue() !== before; } catch { return true; }
			});
			if (partiallyWritten) {
				const partialError = new Error(error?.message || "An editor write failed after a buffer changed.");
				partialError.code = "EDITOR_PARTIAL_WRITE";
				partialError.cause = error;
				throw partialError;
			}
			throw error; // A failed editor write must not be retried against stale disk.
		}
	}
	return { outcome, view, before, after };
}

module.exports = { readEditorBuffer, tryEditorWrite };
