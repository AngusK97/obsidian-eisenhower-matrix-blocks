"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
	addTask,
	completeTask,
	createEmptyData,
	restoreTask,
} = require("../src/core");
const {
	BOARD_LANGUAGE,
	LEGACY_BOARD_LANGUAGE,
	appendBoardCodeBlock,
	findBoardCodeBlocks,
	mutateBoardDocument,
	parseBoardSource,
	readBoardFromDocument,
	renameBoardDocument,
	renderBoardCodeBlock,
	renderBoardSource,
	replaceLegacyManagedBlock,
} = require("../src/board-store");
const { updateMarkdownDocument } = require("../src/markdown-store");

function boardData(id, title, quadrant = "do") {
	const data = createEmptyData();
	addTask(data, title, quadrant, {
		idFactory: () => id,
		now: new Date("2026-07-22T08:00:00.000Z"),
	});
	return data;
}

test("board source serializes deterministically and round trips", () => {
	const data = boardData("task-a", "本地任务");
	const source = renderBoardSource("board-alpha", data);
	assert.equal(renderBoardSource("board-alpha", data), source);
	const parsed = parseBoardSource(source);
	assert.deepEqual(parsed.issues, []);
	assert.equal(parsed.boardId, "board-alpha");
	assert.equal(parsed.title, "Matrix");
	assert.deepEqual(parsed.data, data);
});

test("new blocks use the renamed language while legacy blocks remain editable", () => {
	const current = renderBoardCodeBlock("board-compatible", createEmptyData());
	assert.ok(current.startsWith(`\`\`\`${BOARD_LANGUAGE}\n`));

	const legacy = current.replace(
		`\`\`\`${BOARD_LANGUAGE}`,
		`\`\`\`${LEGACY_BOARD_LANGUAGE}`,
	);
	const parsed = findBoardCodeBlocks(legacy);
	assert.equal(parsed.length, 1);
	assert.equal(parsed[0].language, LEGACY_BOARD_LANGUAGE);

	const updated = mutateBoardDocument(legacy, "board-compatible", (data) =>
		addTask(data, "Compatible", "do", { idFactory: () => "legacy-compatible" }),
	).content;
	assert.ok(updated.startsWith(`\`\`\`${LEGACY_BOARD_LANGUAGE}\n`));
	assert.equal(readBoardFromDocument(updated, "board-compatible").data.tasks[0].id, "legacy-compatible");
});

test("custom board titles round trip and survive task mutations", () => {
	const source = renderBoardCodeBlock("board-titled", boardData("task-a", "Task"), "\n", "本周工作");
	const parsed = findBoardCodeBlocks(source)[0];
	assert.equal(parsed.title, "本周工作");
	assert.match(parsed.source, /"title":"本周工作"/);

	const updated = mutateBoardDocument(source, "board-titled", (data) =>
		addTask(data, "Another", "schedule", { idFactory: () => "task-b" }),
	).content;
	assert.equal(readBoardFromDocument(updated, "board-titled").title, "本周工作");
});

test("renaming one board preserves its tasks and every sibling byte", () => {
	const first = renderBoardCodeBlock("board-first", boardData("task-a", "First"));
	const second = renderBoardCodeBlock("board-second", boardData("task-b", "Second"));
	const document = `${first}\n\nKeep this text.\n\n${second}`;
	const renamed = renameBoardDocument(document, "board-first", "项目 Alpha");

	assert.equal(renamed.title, "项目 Alpha");
	assert.equal(readBoardFromDocument(renamed.content, "board-first").data.tasks[0].id, "task-a");
	assert.equal(readBoardFromDocument(renamed.content, "board-first").title, "项目 Alpha");
	assert.ok(renamed.content.endsWith(`Keep this text.\n\n${second}`));
	assert.throws(() => renameBoardDocument(document, "board-first", "   "), /标题不能为空/);
});

test("mutating one board leaves sibling boards and surrounding bytes unchanged", () => {
	const boardA = renderBoardCodeBlock("board-alpha", boardData("a", "A task"));
	const boardB = renderBoardCodeBlock("board-beta", boardData("b", "B task", "schedule"));
	const document = `---\ntype: dashboard\n---\n\n${boardA}\n\n> [!note] keep me\n\n${boardB}\n\n\`\`\`js\nconsole.log("tail");\n\`\`\``;
	const before = findBoardCodeBlocks(document);
	const updated = mutateBoardDocument(document, "board-beta", (data) =>
		addTask(data, "Local addition", "delegate", { idFactory: () => "local" }),
	).content;
	const after = findBoardCodeBlocks(updated);

	assert.equal(after[0].source, before[0].source);
	assert.ok(updated.startsWith(`---\ntype: dashboard\n---\n\n${boardA}\n\n> [!note] keep me\n\n`));
	assert.ok(updated.endsWith('\n\n```js\nconsole.log("tail");\n```'));
	assert.deepEqual(
		readBoardFromDocument(updated, "board-beta").data.tasks.map((task) => task.id).sort(),
		["b", "local"],
	);
});

test("duplicate board ids are rejected as ambiguous", () => {
	const block = renderBoardCodeBlock("board-repeat", createEmptyData());
	const document = `${block}\n\n${block}`;
	assert.throws(
		() => mutateBoardDocument(document, "board-repeat", (data) => addTask(data, "task", "do")),
		/重复的 board-id/,
	);
});

test("quadrant syntax inside a longer example fence is not treated as a board", () => {
	const example = [
		"````markdown",
		"```quadrant-tasks",
		'<!-- quadrant-board {"id":"board-example","version":2} -->',
		"```",
		"````",
	].join("\n");
	const real = renderBoardCodeBlock("board-real", createEmptyData());
	const blocks = findBoardCodeBlocks(`${example}\n\n${real}`);
	assert.deepEqual(blocks.map((block) => block.boardId), ["board-real"]);
});

test("rewriting a board preserves CRLF throughout the document", () => {
	const newline = "\r\n";
	const document = `# Dashboard${newline}${newline}${renderBoardCodeBlock("board-crlf", createEmptyData(), newline)}${newline}`;
	const updated = mutateBoardDocument(document, "board-crlf", (data) =>
		addTask(data, "CRLF task", "do", { idFactory: () => "crlf-task" }),
	).content;
	assert.equal(/(^|[^\r])\n/.test(updated), false);
});

test("completion and restoration stay inside the selected board", () => {
	const first = boardData("task-a", "Complete me", "delegate");
	const second = boardData("task-b", "Leave me", "schedule");
	let document = `${renderBoardCodeBlock("board-alpha", first)}\n\n${renderBoardCodeBlock("board-beta", second)}`;
	document = mutateBoardDocument(document, "board-alpha", (data) =>
		completeTask(data, "task-a", new Date("2026-07-22T10:00:00.000Z")),
	).content;
	assert.equal(readBoardFromDocument(document, "board-alpha").data.tasks[0].completedAt, "2026-07-22T10:00:00.000Z");
	assert.equal(readBoardFromDocument(document, "board-beta").data.tasks[0].completedAt, null);

	document = mutateBoardDocument(document, "board-alpha", (data) => restoreTask(data, "task-a")).content;
	assert.equal(readBoardFromDocument(document, "board-alpha").data.tasks[0].completedAt, null);
	assert.equal(readBoardFromDocument(document, "board-alpha").data.tasks[0].quadrant, "delegate");
});

test("a malformed target board is refused without affecting valid siblings", () => {
	const malformed = "```quadrant-tasks\n<!-- quadrant-board {\"id\":\"board-bad\",\"version\":2} -->\nordinary prose\n```";
	const valid = renderBoardCodeBlock("board-good", createEmptyData());
	const document = `${malformed}\n\n${valid}`;
	assert.throws(
		() => mutateBoardDocument(document, "board-bad", (data) => addTask(data, "task", "do")),
		/内容异常/,
	);
	assert.deepEqual(readBoardFromDocument(document, "board-good").data.tasks, []);
});

test("a 1.1 managed block migrates in place and preserves surrounding content", () => {
	const legacy = boardData("legacy-task", "Legacy task", "eliminate");
	const document = `# Before\n\n${updateMarkdownDocument("", legacy)}\nAfter`;
	const migrated = replaceLegacyManagedBlock(document, "board-migrated");
	assert.ok(migrated.content.startsWith("# Before\n\n# Quadrant Tasks\n\n```eisenhower-matrix-blocks"));
	assert.ok(migrated.content.endsWith("\nAfter"));
	assert.equal(readBoardFromDocument(migrated.content, "board-migrated").data.tasks[0].id, "legacy-task");
});

test("legacy migration refuses an existing migration board before writing", () => {
	const legacy = boardData("legacy-task", "Legacy task");
	const managed = updateMarkdownDocument("", legacy);
	const existing = renderBoardCodeBlock("board-migrated-global", createEmptyData());
	const document = `${managed}\n\n${existing}`;
	assert.throws(
		() => replaceLegacyManagedBlock(document, "board-migrated-global"),
		/迁移目标 board-id 已存在/,
	);
	assert.equal(document.includes("<!-- quadrant-tasks:start -->"), true);
});

test("legacy JSON data can be appended as an independent board", () => {
	const document = "# Existing note\n\nKeep this paragraph.";
	const updated = appendBoardCodeBlock(document, "board-legacy", boardData("legacy", "JSON task"));
	assert.ok(updated.startsWith(`${document}\n\n`));
	assert.equal(readBoardFromDocument(updated, "board-legacy").data.tasks[0].id, "legacy");
});
