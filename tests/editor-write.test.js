"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
	addTask,
	completeTask,
	createEmptyData,
	editTask,
	getActiveTasks,
	reorderTask,
} = require("../src/core");
const {
	findBoardCodeBlocks,
	mutateBoardDocument,
	readBoardFromDocument,
	renderBoardCodeBlock,
} = require("../src/board-store");
const { readEditorBuffer, tryEditorWrite } = require("../src/editor-write");

function offsetToPos(source, offset) {
	const prefix = source.slice(0, offset);
	const lastNewline = prefix.lastIndexOf("\n");
	return {
		line: (prefix.match(/\n/g) || []).length,
		ch: offset - lastNewline - 1,
	};
}

function posToOffset(source, position) {
	let line = 0;
	let start = 0;
	while (line < position.line) {
		const newline = source.indexOf("\n", start);
		if (newline < 0) return source.length;
		start = newline + 1;
		line += 1;
	}
	return Math.min(start + position.ch, source.length);
}

function clone(value) {
	return JSON.parse(JSON.stringify(value));
}

function fakeEditor(initialValue, selections = []) {
	let value = initialValue;
	let currentSelections = clone(selections);
	const transactions = [];
	let focusCalls = 0;
	let setValueCalls = 0;
	return {
		getValue: () => value,
		listSelections: () => clone(currentSelections),
		offsetToPos: offset => offsetToPos(value, offset),
		posToOffset: position => posToOffset(value, position),
		transaction(spec) {
			transactions.push(clone(spec));
			const before = value;
			const changes = [...spec.changes].map(change => ({
				...change,
				fromOffset: posToOffset(before, change.from),
				toOffset: posToOffset(before, change.to),
			}));
			const mapOffset = offset => {
				let delta = 0;
				for (const change of [...changes].sort((left, right) => left.fromOffset - right.fromOffset)) {
					if (offset <= change.fromOffset) break;
					if (offset < change.toOffset) return change.fromOffset + delta + change.text.length;
					delta += change.text.length - (change.toOffset - change.fromOffset);
				}
				return offset + delta;
			};
			const mappedOffsets = currentSelections.map(selection => ({
				anchor: mapOffset(posToOffset(before, selection.anchor)),
				head: mapOffset(posToOffset(before, selection.head)),
			}));
			for (const change of [...changes].sort((left, right) => right.fromOffset - left.fromOffset)) {
				value = `${value.slice(0, change.fromOffset)}${change.text}${value.slice(change.toOffset)}`;
			}
			currentSelections = mappedOffsets.map(selection => ({
				anchor: offsetToPos(value, selection.anchor),
				head: offsetToPos(value, selection.head),
			}));
		},
		focus() { focusCalls += 1; },
		setValue(next) { setValueCalls += 1; value = next; },
		get transactions() { return transactions; },
		get focusCalls() { return focusCalls; },
		get setValueCalls() { return setValueCalls; },
	};
}

function sourceView(path, editor, mode = "source") {
	return { file: { path }, editor, getMode: () => mode };
}

function fakePlugin(views) {
	let processCalls = 0;
	return {
		app: {
			workspace: {
				iterateAllLeaves(callback) {
					for (const view of views) callback({ view });
				},
			},
			vault: {
				process() { processCalls += 1; throw new Error("editor writes must not reach Vault.process"); },
			},
		},
		get processCalls() { return processCalls; },
	};
}

function dataWithTasks(tasks) {
	const data = createEmptyData();
	for (const [id, title, quadrant = "do"] of tasks) {
		addTask(data, title, quadrant, {
			idFactory: () => id,
			now: new Date(`2026-10-0${data.tasks.length + 1}T08:00:00.000Z`),
		});
	}
	return data;
}

function collapsed(offset, source) {
	const position = offsetToPos(source, offset);
	return { anchor: position, head: position };
}

function selection(anchor, head, source) {
	return { anchor: offsetToPos(source, anchor), head: offsetToPos(source, head) };
}

test("returns null when no editable source view owns the requested file", () => {
	const target = "Projects/Matrix.md";
	const plugin = fakePlugin([
		sourceView("Projects/Other.md", fakeEditor("other")),
		sourceView(target, fakeEditor("preview buffer"), "preview"),
		{ file: { path: target }, getMode: () => "source" },
	]);
	let updaterCalls = 0;
	const result = tryEditorWrite(plugin, target, "board-target", () => { updaterCalls += 1; });

	assert.equal(result, null);
	assert.equal(updaterCalls, 0);
	assert.equal(plugin.processCalls, 0);
});

test("prefers the supplied matching view and writes from its latest unsaved buffer only", () => {
	const path = "Projects/Matrix.md";
	const firstBlock = renderBoardCodeBlock("board-first", dataWithTasks([["first-task", "Keep first"]]));
	const secondBlock = renderBoardCodeBlock("board-second", dataWithTasks([["second-task", "Existing second", "schedule"]]));
	const before = `# Unsaved heading\n\nDraft outside the vault 😀\n\n${firstBlock}\n\nKeep these exact bytes.\n\n${secondBlock}\n\nUnsaved tail.`;
	const beforeBlocks = findBoardCodeBlocks(before);
	const beforeTailStart = before.indexOf("Unsaved tail");
	const selections = [
		selection(2, 8, before),
		selection(beforeTailStart + 11, beforeTailStart + 2, before),
	];
	const otherEditor = fakeEditor(before, selections);
	const preferredEditor = fakeEditor(before, selections);
	const otherView = sourceView(path, otherEditor);
	const preferredView = sourceView(path, preferredEditor);
	const plugin = fakePlugin([otherView, preferredView]);

	const result = tryEditorWrite(plugin, path, "board-second", (content, boardId) =>
		mutateBoardDocument(content, boardId, draft => addTask(draft, "Unsaved-buffer addition", "delegate", {
			idFactory: () => "new-unsaved-task",
			now: new Date("2026-10-06T08:00:00.000Z"),
		})), preferredView);

	assert.equal(result.view, preferredView);
	assert.equal(result.before, before);
	assert.equal(result.after, result.outcome.content);
	assert.equal(preferredEditor.getValue(), result.after);
	assert.equal(otherEditor.getValue(), result.after);
	assert.equal(preferredEditor.transactions.length, 1);
	assert.equal(otherEditor.transactions.length, 1);
	assert.equal(preferredEditor.transactions[0].changes.length, 1, "one contiguous editor change avoids replacing the whole buffer");
	assert.equal(Object.hasOwn(preferredEditor.transactions[0], "selection"), false, "the host maps its public transaction selection");
	assert.equal(Object.hasOwn(preferredEditor.transactions[0], "selections"), false, "the write must not replace the editor's multi-selection state");
	assert.equal(findBoardCodeBlocks(result.after)[0].source, beforeBlocks[0].source, "the sibling board is byte-identical");
	assert.match(result.after, /^# Unsaved heading\n\nDraft outside the vault 😀/);
	assert.match(result.after, /Keep these exact bytes\./);
	assert.match(result.after, /Unsaved tail\.$/);
	assert.deepEqual(readBoardFromDocument(result.after, "board-second").data.tasks.map(task => task.id).sort(), ["new-unsaved-task", "second-task"]);

	const delta = result.after.length - before.length;
	const mapped = preferredEditor.listSelections().map(selection => ({
		anchor: posToOffset(result.after, selection.anchor),
		head: posToOffset(result.after, selection.head),
	}));
	assert.deepEqual(mapped, [
		{ anchor: 2, head: 8 },
		{ anchor: beforeTailStart + 11 + delta, head: beforeTailStart + 2 + delta },
	], "host mapping preserves external forward and reverse selections instead of jumping to the start");
	assert.equal(preferredEditor.focusCalls, 0);
	assert.equal(preferredEditor.setValueCalls, 0);
	assert.equal(plugin.processCalls, 0);
});

test("rejects divergent source buffers for the same file before running the updater", () => {
	const path = "Projects/Conflict.md";
	const diskLike = renderBoardCodeBlock("board-conflict", createEmptyData());
	const left = fakeEditor(`${diskLike}\nleft unsaved change`);
	const right = fakeEditor(`${diskLike}\nright unsaved change`);
	const plugin = fakePlugin([sourceView(path, left), sourceView(path, right)]);
	let updaterCalls = 0;

	assert.throws(() => tryEditorWrite(plugin, path, "board-conflict", () => { updaterCalls += 1; }));
	assert.equal(updaterCalls, 0);
	assert.equal(left.transactions.length, 0);
	assert.equal(right.transactions.length, 0);
	assert.equal(plugin.processCalls, 0, "an ambiguous editor must never fall back to stale disk content");
});

test("identical independent panes support consecutive writes with all guards armed before the preferred transaction", () => {
	const path = "Shared.md";
	const left = sourceView(path, fakeEditor("before"));
	const right = sourceView(path, fakeEditor("before"));
	const plugin = fakePlugin([left, right]);
	const events = [];
	plugin.editorScrollGuards = { arm(view, after) { events.push(["arm", view, after]); return () => {}; } };
	for (const view of [left, right]) {
		const transaction = view.editor.transaction;
		view.editor.transaction = spec => { events.push(["write", view]); transaction(spec); };
	}
	assert.deepEqual(readEditorBuffer(plugin, path, right), { view: right, views: [left, right], content: "before" });
	let updates = 0;
	for (const suffix of [" one", " two"]) {
		events.length = 0;
		tryEditorWrite(plugin, path, "board", content => { updates++; return { content: content + suffix }; }, right);
		assert.equal(events[0][0], "arm"); assert.equal(events[1][0], "arm");
		assert.deepEqual(events.slice(2), [["write", right], ["write", left]]);
		assert.equal(left.editor.getValue(), right.editor.getValue());
	}
	assert.equal(left.editor.getValue(), "before one two"); assert.equal(updates, 2);
	assert.equal(plugin.processCalls, 0);
});

test("host-synchronized buffers skip duplicate transactions and shared editor identities write once", () => {
	const path = "Shared.md";
	const primary = fakeEditor("before"), peer = fakeEditor("before");
	const views = [sourceView(path, primary), sourceView(path, peer), sourceView(path, primary)];
	const plugin = fakePlugin(views);
	const armed = [];
	plugin.editorScrollGuards = { arm(view) { armed.push(view); return () => {}; } };
	const transaction = primary.transaction;
	primary.transaction = spec => { assert.equal(armed.length, 3); transaction(spec); peer.setValue(primary.getValue()); };
	tryEditorWrite(plugin, path, "board", () => ({ content: "after" }), views[0]);
	assert.equal(primary.transactions.length, 1); assert.equal(peer.transactions.length, 0);
	assert.equal(peer.getValue(), "after");
});

test("partial pane failures cancel every guard and report partial writes without retry or rollback", () => {
	const path = "Partial.md";
	const left = sourceView(path, fakeEditor("before")), right = sourceView(path, fakeEditor("before"));
	const plugin = fakePlugin([left, right]);
	const cancelled = [];
	plugin.editorScrollGuards = { arm(view) { return () => cancelled.push(view); } };
	let failedWrites = 0, updates = 0;
	right.editor.transaction = () => { failedWrites++; throw new Error("pane write failed"); };
	assert.throws(() => tryEditorWrite(plugin, path, "board", () => { updates++; return { content: "after" }; }),
		error => error.code === "EDITOR_PARTIAL_WRITE" && /pane write failed/.test(error.message));
	assert.equal(left.editor.getValue(), "after"); assert.equal(right.editor.getValue(), "before");
	assert.deepEqual(cancelled, [left, right]); assert.equal(failedWrites, 1); assert.equal(updates, 1);
	assert.equal(plugin.processCalls, 0);
});

test("a transaction that changes its buffer before throwing is also a partial write", () => {
	const editor = fakeEditor("before"), path = "Partial.md";
	const plugin = fakePlugin([sourceView(path, editor)]);
	const transaction = editor.transaction;
	editor.transaction = spec => { transaction(spec); throw new Error("post-write failure"); };
	assert.throws(() => tryEditorWrite(plugin, path, "board", () => ({ content: "after" })),
		error => error.code === "EDITOR_PARTIAL_WRITE");
	assert.equal(editor.getValue(), "after"); assert.equal(editor.transactions.length, 1);
});

test("reentrant changes are not overwritten and failures before any change are not partial writes", () => {
	const path = "Conflict.md", left = fakeEditor("before"), right = fakeEditor("before");
	const plugin = fakePlugin([sourceView(path, left), sourceView(path, right)]);
	const transaction = left.transaction;
	left.transaction = spec => { transaction(spec); right.setValue("new user content"); };
	assert.throws(() => tryEditorWrite(plugin, path, "board", () => ({ content: "after" })),
		error => error.code === "EDITOR_PARTIAL_WRITE" && /conflict/i.test(error.message));
	assert.equal(right.getValue(), "new user content"); assert.equal(right.transactions.length, 0);
	const failure = new Error("first write rejected"), unchanged = fakeEditor("before");
	unchanged.transaction = () => { throw failure; };
	assert.throws(() => tryEditorWrite(fakePlugin([sourceView(path, unchanged)]), path, "board", () => ({ content: "after" })),
		error => error === failure && error.code !== "EDITOR_PARTIAL_WRITE");
});

test("propagates board validation errors without an editor or vault write", () => {
	const path = "Projects/Missing.md";
	const editor = fakeEditor(`# Unsaved\n\n${renderBoardCodeBlock("board-present", createEmptyData())}`);
	const plugin = fakePlugin([sourceView(path, editor)]);

	assert.throws(
		() => tryEditorWrite(plugin, path, "board-missing", (content, boardId) =>
			mutateBoardDocument(content, boardId, draft => addTask(draft, "Must not write", "do"))),
		/找不到四象限表/,
	);
	assert.equal(editor.transactions.length, 0);
	assert.equal(editor.setValueCalls, 0);
	assert.equal(plugin.processCalls, 0);
});

test("applies consecutive add, reorder and complete operations to the current editor buffer", () => {
	const path = "Projects/Sequence.md";
	const boardId = "board-sequence";
	const editor = fakeEditor(renderBoardCodeBlock(boardId, dataWithTasks([
		["task-a", "First"],
		["task-b", "Second"],
	])));
	const view = sourceView(path, editor);
	const plugin = fakePlugin([view]);
	const write = mutator => tryEditorWrite(plugin, path, boardId, (content, targetBoardId) =>
		mutateBoardDocument(content, targetBoardId, mutator));

	write(draft => addTask(draft, "Newest", "do", {
		idFactory: () => "task-c",
		now: new Date("2026-10-06T09:00:00.000Z"),
	}));
	assert.deepEqual(getActiveTasks(readBoardFromDocument(editor.getValue(), boardId).data, "do").map(task => task.id), ["task-c", "task-b", "task-a"]);

	write(draft => reorderTask(draft, "task-a", "do", "task-c", "before"));
	assert.deepEqual(getActiveTasks(readBoardFromDocument(editor.getValue(), boardId).data, "do").map(task => task.id), ["task-a", "task-c", "task-b"]);

	write(draft => completeTask(draft, "task-c", new Date("2026-10-06T10:00:00.000Z")));
	const final = readBoardFromDocument(editor.getValue(), boardId).data;
	assert.equal(final.tasks.find(task => task.id === "task-c").completedAt, "2026-10-06T10:00:00.000Z");
	assert.equal(editor.transactions.length, 3);
	assert.ok(editor.transactions.every(transaction => transaction.changes.length === 1));
	assert.equal(editor.focusCalls, 0);
	assert.equal(editor.setValueCalls, 0);
	assert.equal(plugin.processCalls, 0);
});

test("uses one Unicode-safe minimal change for CRLF content and preserves all selections", () => {
	const path = "Projects/Unicode.md";
	const boardId = "board-unicode";
	const before = `# CRLF note\r\n\r\n${renderBoardCodeBlock(boardId, dataWithTasks([["emoji-task", "😀Alpha"]]), "\r\n")}\r\n\r\nTail`;
	const selections = [collapsed(2, before), collapsed(before.indexOf("Tail") + 2, before)];
	const editor = fakeEditor(before, selections);
	const plugin = fakePlugin([sourceView(path, editor)]);

	const result = tryEditorWrite(plugin, path, boardId, (content, targetBoardId) =>
		mutateBoardDocument(content, targetBoardId, draft => editTask(draft, "emoji-task", "😁Alpha")));
	const transaction = editor.transactions[0];
	const change = transaction.changes[0];
	const from = posToOffset(before, change.from);
	const to = posToOffset(before, change.to);

	assert.equal(editor.getValue(), result.after);
	assert.equal(transaction.changes.length, 1);
	assert.equal(`${before.slice(0, from)}${change.text}${before.slice(to)}`, result.after);
	assert.equal(from, before.indexOf("😀Alpha"), "the common high surrogate must not be split from the changed emoji");
	assert.equal(to, from + "😀".length);
	assert.equal(change.text, "😁");
	assert.equal(/(^|[^\r])\n/.test(result.after), false, "CRLF line endings stay intact");
	assert.deepEqual(editor.listSelections(), selections, "equal-length Unicode edits preserve every selection");
	assert.equal(editor.focusCalls, 0);
	assert.equal(editor.setValueCalls, 0);
	assert.equal(plugin.processCalls, 0);
});
