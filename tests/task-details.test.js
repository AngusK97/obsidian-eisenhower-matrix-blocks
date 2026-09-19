"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const {
	addTask, completeTask, createEmptyData, deleteTask, editTask, moveTask,
	normalizeData, reorderTask, restoreDeletedTask, restoreTask,
} = require("../src/core");
const { getDueDateInfo, normalizeDueDate } = require("../src/task-details");
const { mergeTaskData, parseTaskMarkdown, renderManagedBlock } = require("../src/markdown-store");
const { mutateBoardDocument, readBoardFromDocument, renderBoardCodeBlock } = require("../src/board-store");

function detailedTask(data = createEmptyData()) {
	const task = addTask(data, "Ship update", "do", {
		idFactory: () => "detail-1", now: new Date("2026-09-20T10:00:00Z"),
		dueDate: "2026-09-22", notes: "First line\n第二行",
	});
	return { data, task };
}

test("deadline validation accepts only actual four-digit calendar dates", () => {
	for (const valid of ["2024-02-29", "2026-09-20", "0001-01-01", "0099-12-31", "9999-12-31"]) {
		assert.equal(normalizeDueDate(valid), valid);
	}
	for (const invalid of [undefined, null, "", "2026-02-29", "2026-04-31", "2026-13-01", "0000-01-01", "2026-9-20", "2026-09-20T00:00:00Z", 123]) {
		assert.equal(normalizeDueDate(invalid), null);
	}
});

test("legacy task data normalizes to empty optional fields without losing existing state", () => {
	const { data, task } = detailedTask();
	delete task.dueDate;
	delete task.notes;
	const normalized = normalizeData(data);
	assert.deepEqual(normalized.tasks[0], { ...task, dueDate: null, notes: "" });
	assert.deepEqual(parseTaskMarkdown(renderManagedBlock(data)).data, normalized);
	assert.doesNotMatch(renderManagedBlock(data), /"dueDate"|"notes"/);
});

test("creation accepts title only and stores optional details when present", () => {
	const simple = addTask(createEmptyData(), "Simple", "do");
	assert.equal(simple.dueDate, null);
	assert.equal(simple.notes, "");
	const { task } = detailedTask();
	assert.equal(task.dueDate, "2026-09-22");
	assert.equal(task.notes, "First line\n第二行");
});

test("editing updates details, preserves omitted fields, and explicitly clears values", () => {
	const { data, task } = detailedTask();
	editTask(data, task.id, "Renamed");
	assert.equal(task.dueDate, "2026-09-22");
	assert.equal(task.notes, "First line\n第二行");
	editTask(data, task.id, "Renamed again", { dueDate: "2026-12-31" });
	assert.equal(task.notes, "First line\n第二行");
	editTask(data, task.id, "Final", { dueDate: "", notes: "" });
	assert.equal(task.dueDate, null);
	assert.equal(task.notes, "");
	editTask(data, task.id, "Final", { notes: "Preserve  spaces \n" });
	assert.equal(task.notes, "Preserve  spaces \n");
});

test("invalid task details cannot partially mutate an existing task or create a task", () => {
	const { data, task } = detailedTask();
	const before = JSON.stringify(data);
	assert.throws(() => addTask(data, "Bad", "do", { dueDate: "2026-02-30" }), /date/i);
	assert.throws(() => addTask(data, "Bad", "do", { notes: {} }), /notes/i);
	assert.equal(editTask(data, task.id, "Changed", { dueDate: "2026-02-30" }), null);
	assert.equal(editTask(data, task.id, "Changed", { notes: {} }), null);
	assert.equal(JSON.stringify(data), before);
});

test("moving, reordering, completing, editing completed, restoring and undoing deletion preserve details", () => {
	const { data, task } = detailedTask();
	moveTask(data, task.id, "schedule");
	reorderTask(data, task.id, "delegate");
	completeTask(data, task.id, new Date("2026-09-21T10:00:00Z"));
	editTask(data, task.id, "Done", { notes: "Completion notes" });
	restoreTask(data, task.id);
	restoreDeletedTask(data, deleteTask(data, task.id));
	assert.equal(data.tasks[0].dueDate, "2026-09-22");
	assert.equal(data.tasks[0].notes, "Completion notes");
	assert.deepEqual(normalizeData(JSON.parse(JSON.stringify(data))), data);
	assert.deepEqual(mergeTaskData(createEmptyData(), data), data);
});

test("due date presentation marks only incomplete tasks within three calendar days", () => {
	const now = new Date(2026, 8, 20, 23, 59);
	for (const [date, days, urgent] of [["2026-09-19", -1, true], ["2026-09-20", 0, true], ["2026-09-21", 1, true], ["2026-09-22", 2, true], ["2026-09-23", 3, true], ["2026-09-24", 4, false]]) {
		assert.deepEqual(getDueDateInfo(date, null, now), { date, days, urgent });
		assert.equal(getDueDateInfo(date, "2026-09-19T10:00:00Z", now).urgent, false);
	}
	assert.equal(getDueDateInfo(null, null, now), null);
	assert.equal(getDueDateInfo("invalid", null, now), null);
});

test("deadline differences follow local calendar days across DST and UTC boundaries", () => {
	const modulePath = JSON.stringify(require.resolve("../src/task-details"));
	const cases = [
		["America/New_York", "2026-03-08T23:30:00-04:00", "2026-03-09", 1],
		["America/New_York", "2026-10-31T23:30:00-04:00", "2026-11-02", 2],
		["Asia/Shanghai", "2026-09-20T00:30:00+08:00", "2026-09-20", 0],
		["Pacific/Honolulu", "2026-09-20T23:30:00-10:00", "2026-09-21", 1],
	];
	for (const [timezone, now, dueDate, days] of cases) {
		const script = `process.stdout.write(JSON.stringify(require(${modulePath}).getDueDateInfo(${JSON.stringify(dueDate)}, null, new Date(${JSON.stringify(now)}))))`;
		const result = execFileSync(process.execPath, ["-e", script], { env: { ...process.env, TZ: timezone }, encoding: "utf8" });
		assert.equal(JSON.parse(result).days, days, timezone);
	}
});

test("multiline notes containing comment markers and code fences round trip safely", () => {
	const { data, task } = detailedTask();
	task.notes = '第一行\r\n<!-- quadrant-tasks:end -->\n--> <script> & "quoted" \\ slash\n```eisenhower-matrix\n```\n<!-- quadrant-task {} -->';
	for (const newline of ["\n", "\r\n"]) {
		const markdown = renderManagedBlock(data, newline);
		assert.equal(markdown.split("<!-- quadrant-tasks:end -->").length, 2);
		assert.ok(markdown.includes("\\u003c"));
		assert.ok(markdown.includes("\\u003e"));
		const parsed = parseTaskMarkdown(markdown);
		assert.deepEqual(parsed.issues, []);
		assert.deepEqual(parsed.data, data);
	}
});

test("board mutations preserve details and leave sibling boards and surrounding notes byte-identical", () => {
	const { data } = detailedTask();
	const sibling = renderBoardCodeBlock("other-board", createEmptyData(), "\r\n");
	const before = "# Surrounding\r\n\r\n";
	const after = `\r\n\r\n${sibling}\r\nFooter untouched\r\n`;
	const document = `${before}${renderBoardCodeBlock("detail-board", data, "\r\n")}${after}`;
	const result = mutateBoardDocument(document, "detail-board", (draft) => editTask(draft, "detail-1", "Updated", { notes: "New\nNotes" }));
	assert.ok(result.content.startsWith(before));
	assert.ok(result.content.endsWith(after));
	assert.equal(/(^|[^\r])\n/.test(result.content), false);
	const task = readBoardFromDocument(result.content, "detail-board").data.tasks[0];
	assert.equal(task.dueDate, "2026-09-22");
	assert.equal(task.notes, "New\nNotes");
});

test("malformed persisted details block mutations rather than silently dropping user data", () => {
	const { data } = detailedTask();
	const source = renderBoardCodeBlock("detail-board", data);
	for (const malformed of [source.replace('"2026-09-22"', '"2026-02-30"'), source.replace('"notes":"First line\\n第二行"', '"notes":{"text":"Keep me"}')]) {
		assert.throws(() => readBoardFromDocument(malformed, "detail-board"));
		assert.throws(() => mutateBoardDocument(malformed, "detail-board", (draft) => editTask(draft, "detail-1", "Changed")));
	}
});
