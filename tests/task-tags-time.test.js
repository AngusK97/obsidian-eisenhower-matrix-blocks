"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../src/core");
const details = require("../src/task-details");
const { parseTaskMarkdown, renderManagedBlock, mergeTaskData } = require("../src/markdown-store");
const { renderBoardCodeBlock, readBoardFromDocument, mutateBoardDocument } = require("../src/board-store");

function fixture() {
	const data = core.createEmptyData();
	const task = core.addTask(data, "Detailed", "do", { idFactory: () => "task", dueDate: "2026-09-20", dueTime: "23:59", tags: ["#项目", "Café", "工作"], notes: "Keep notes" });
	return { data, task };
}

test("optional deadline time accepts precise 24-hour HH:mm only", () => {
	assert.equal(typeof details.normalizeDueTime, "function");
	for (const value of ["00:00", "09:05", "12:00", "23:59"]) assert.equal(details.normalizeDueTime(value), value);
	for (const value of [null, undefined, "", "24:00", "23:60", "9:05", "12:00:00", " 09:00", 1200]) assert.equal(details.normalizeDueTime(value), null);
});

test("tags normalize NFC, remove leading hashes, trim and deduplicate without count limits", () => {
	const { normalizeTags, getTagColorIndex } = require("../src/task-tags");
	assert.deepEqual(normalizeTags([" #项目 ", "项目", "##工作", "", "#", "Cafe\u0301", "Café", "Tag", "tag"]), ["项目", "工作", "Café", "Tag", "tag"]);
	const many = Array.from({ length: 1000 }, (_, index) => `tag-${index}`);
	assert.deepEqual(normalizeTags(many), many);
	assert.deepEqual(normalizeTags({}), []);
	assert.equal(getTagColorIndex("#Cafe\u0301"), getTagColorIndex("Café"));
	assert.equal(getTagColorIndex("hello"), 3);
	for (const tag of many) assert.ok(Number.isInteger(getTagColorIndex(tag)) && getTagColorIndex(tag) >= 0 && getTagColorIndex(tag) < 8);
});

test("legacy tasks get empty tags and no time while new tasks store details", () => {
	const simple = core.addTask(core.createEmptyData(), "Legacy", "do");
	assert.deepEqual(simple.tags, []);
	assert.equal(simple.dueTime, null);
	const { data, task } = fixture();
	assert.equal(task.dueTime, "23:59");
	assert.deepEqual(task.tags, ["项目", "Café", "工作"]);
	delete task.tags;
	delete task.dueTime;
	assert.deepEqual(core.normalizeData(data).tasks[0], { ...task, dueTime: null, tags: [] });
});

test("editing preserves omitted fields and supports independent time and tag clearing", () => {
	const { data, task } = fixture();
	core.editTask(data, task.id, "Renamed", { dueDate: "2026-09-21" });
	assert.equal(task.dueTime, "23:59");
	assert.deepEqual(task.tags, ["项目", "Café", "工作"]);
	core.editTask(data, task.id, "Renamed", { dueTime: "00:00", tags: ["#旅行"] });
	assert.equal(task.dueTime, "00:00");
	assert.deepEqual(task.tags, ["旅行"]);
	core.editTask(data, task.id, "Renamed", { dueTime: "", tags: [] });
	assert.equal(task.dueTime, null);
	assert.deepEqual(task.tags, []);
	core.editTask(data, task.id, "Renamed", { dueTime: "10:30" });
	core.editTask(data, task.id, "Renamed", { dueDate: null });
	assert.equal(task.dueTime, null);
	assert.equal(task.dueDate, null);
});

test("invalid tags and times never partially mutate tasks", () => {
	const { data, task } = fixture();
	const before = JSON.stringify(data);
	for (const invalid of [{ dueTime: "24:00" }, { dueTime: {} }, { tags: "work" }, { tags: ["ok", 7] }, { tags: null }]) {
		assert.throws(() => core.addTask(data, "Invalid", "do", { dueDate: "2026-09-20", ...invalid }));
		assert.equal(core.editTask(data, task.id, "Changed", invalid), null);
		assert.equal(JSON.stringify(data), before);
	}
	assert.throws(() => core.addTask(data, "Orphan time", "do", { dueTime: "10:00" }));
	const simple = core.addTask(data, "Date missing", "do");
	assert.equal(core.editTask(data, simple.id, "Changed", { dueTime: "10:00" }), null);
});

test("deadline color thresholds include three and seven days and ignore time of day", () => {
	assert.equal(typeof details.getDueDateTone, "function");
	for (const [days, color] of [[-1, "red"], [0, "red"], [3, "red"], [4, "yellow"], [7, "yellow"], [8, "green"], [30, "green"]]) {
		assert.equal(details.getDueDateTone(days, null), color);
		assert.equal(details.getDueDateTone(days, "2026-09-19T00:00:00Z"), "muted");
	}
	assert.equal(details.getDueDateInfo("2026-09-23", null, new Date(2026, 8, 20, 0, 0)).urgent, true);
	assert.equal(details.getDueDateInfo("2026-09-23", null, new Date(2026, 8, 20, 23, 59)).urgent, true);
});

test("tags and time survive every task lifecycle operation and safe Markdown round trips", () => {
	const { data, task } = fixture();
	task.tags.push('<!-- quadrant-tasks:end -->', '"quoted"\\tag', '```\nline');
	const expectedTags = [...task.tags];
	core.moveTask(data, task.id, "schedule");
	core.reorderTask(data, task.id, "delegate");
	core.completeTask(data, task.id);
	core.editTask(data, task.id, "Done");
	core.restoreTask(data, task.id);
	core.restoreDeletedTask(data, core.deleteTask(data, task.id));
	assert.deepEqual(task.tags, expectedTags);
	assert.equal(task.dueTime, "23:59");
	assert.deepEqual(mergeTaskData(core.createEmptyData(), data), data);
	for (const newline of ["\n", "\r\n"]) {
		const markdown = renderManagedBlock(data, newline);
		assert.equal(markdown.split("<!-- quadrant-tasks:end -->").length, 2);
		assert.deepEqual(parseTaskMarkdown(markdown).issues, []);
		assert.deepEqual(parseTaskMarkdown(markdown).data, data);
	}
});

test("invalid persisted tag/time data blocks rewriting instead of erasing user data", () => {
	const { data } = fixture();
	const block = renderBoardCodeBlock("details", data);
	for (const invalid of [
		block.replace('"dueTime":"23:59"', '"dueTime":"24:00"'),
		block.replace('"dueDate":"2026-09-20",', ""),
		block.replace('"tags":["项目","Café","工作"]', '"tags":{"important":true}'),
		block.replace('"tags":["项目","Café","工作"]', '"tags":["keep",42]'),
		block.replace('"tags":["项目","Café","工作"]', '"tags":null'),
	]) {
		assert.notEqual(invalid, block);
		assert.throws(() => readBoardFromDocument(invalid, "details"));
		assert.throws(() => mutateBoardDocument(invalid, "details", (draft) => core.editTask(draft, "task", "New")));
	}
});

test("board edits retain date/time/tags and do not change sibling board bytes", () => {
	const { data } = fixture();
	const prefix = "# Unchanged\r\n";
	const suffix = `\r\n${renderBoardCodeBlock("sibling", data, "\r\n")}\r\nFooter`;
	const document = `${prefix}${renderBoardCodeBlock("details", data, "\r\n")}${suffix}`;
	const result = mutateBoardDocument(document, "details", (draft) => core.editTask(draft, "task", "New", { notes: "More" }));
	assert.ok(result.content.startsWith(prefix));
	assert.ok(result.content.endsWith(suffix));
	const task = readBoardFromDocument(result.content, "details").data.tasks[0];
	assert.equal(task.dueTime, "23:59");
	assert.deepEqual(task.tags, ["项目", "Café", "工作"]);
});
