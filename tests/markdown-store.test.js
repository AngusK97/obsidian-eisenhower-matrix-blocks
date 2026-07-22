"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { addTask, completeTask, createEmptyData, restoreTask } = require("../src/core");
const {
	START_MARKER,
	mergeTaskData,
	parseTaskMarkdown,
	renderManagedBlock,
	updateMarkdownDocument,
} = require("../src/markdown-store");

function taskData() {
	const data = createEmptyData();
	addTask(data, "处理紧急问题", "do", {
		idFactory: () => "do-1",
		now: new Date("2026-07-20T08:00:00.000Z"),
	});
	addTask(data, "制定季度计划", "schedule", {
		idFactory: () => "schedule-1",
		now: new Date("2026-07-20T09:00:00.000Z"),
	});
	completeTask(data, "do-1", new Date("2026-07-22T09:30:00.000Z"));
	return data;
}

function sortedTasks(data) {
	return [...data.tasks].sort((left, right) => left.id.localeCompare(right.id));
}

test("serializes deterministically and round trips Chinese tasks", () => {
	const data = taskData();
	const first = renderManagedBlock(data);
	const second = renderManagedBlock(data);
	assert.equal(first, second);

	const parsed = parseTaskMarkdown(first);
	assert.deepEqual(parsed.issues, []);
	assert.deepEqual(sortedTasks(parsed.data), sortedTasks(data));
});

test("preserves content outside the managed block byte for byte", () => {
	const before = [
		"---",
		"type: dashboard",
		"---",
		"# 我的任务",
		"> [!note] 不应被修改",
		"",
		START_MARKER,
		"old content",
		"<!-- quadrant-tasks:end -->",
		"",
		"```js",
		"console.log('tail');",
		"```",
	].join("\n");
	const updated = updateMarkdownDocument(before, taskData());

	assert.ok(updated.startsWith("---\ntype: dashboard\n---\n# 我的任务\n> [!note] 不应被修改\n\n"));
	assert.ok(updated.endsWith("\n\n```js\nconsole.log('tail');\n```"));
});

test("preserves CRLF line endings when rewriting", () => {
	const original = `# Tasks\r\n\r\n${renderManagedBlock(createEmptyData(), "\r\n")}\r\n`;
	const updated = updateMarkdownDocument(original, taskData());
	assert.equal(/(^|[^\r])\n/.test(updated), false);
	assert.ok(updated.includes("处理紧急问题"));
});

test("manual task lines receive stable metadata on the next write", () => {
	const markdown = [
		START_MARKER,
		"",
		"## 立即做",
		"- [ ] 手动添加的任务 #quadrant/do",
		"",
		"## 安排",
		"",
		"## 委派",
		"",
		"## 舍弃",
		"",
		"## 已完成",
		"<!-- quadrant-tasks:end -->",
	].join("\n");
	const parsed = parseTaskMarkdown(markdown, {
		idFactory: () => "manual-1",
		now: new Date("2026-07-22T10:00:00.000Z"),
	});
	assert.equal(parsed.data.tasks[0].id, "manual-1");
	const rewritten = updateMarkdownDocument(markdown, parsed.data);
	assert.match(rewritten, /"id":"manual-1"/);
});

test("checked tasks preserve their source quadrant and exact completion time", () => {
	const data = taskData();
	const parsed = parseTaskMarkdown(renderManagedBlock(data));
	const completed = parsed.data.tasks.find((task) => task.id === "do-1");
	assert.equal(completed.quadrant, "do");
	assert.equal(completed.completedAt, "2026-07-22T09:30:00.000Z");

	restoreTask(parsed.data, "do-1");
	const restoredMarkdown = renderManagedBlock(parsed.data);
	assert.match(restoredMarkdown, /- \[ \] 处理紧急问题 #quadrant\/do/);
	assert.doesNotMatch(restoredMarkdown, /处理紧急问题[^\n]*✅/);
});

test("malformed managed content reports issues so callers can refuse writes", () => {
	const markdown = [
		START_MARKER,
		"",
		"## 立即做",
		"ordinary prose inside managed content",
		"- [ ] valid task #quadrant/do",
		"  <!-- quadrant-task not-json -->",
		"<!-- quadrant-tasks:end -->",
	].join("\n");
	const parsed = parseTaskMarkdown(markdown, { idFactory: () => "valid" });
	assert.equal(parsed.data.tasks.length, 1);
	assert.equal(parsed.issues.length, 2);
});

test("missing or duplicate managed markers block writes", () => {
	const missingEnd = `${START_MARKER}\n## 立即做\n- [ ] task #quadrant/do`;
	const duplicateStart = `${START_MARKER}\n${START_MARKER}\n<!-- quadrant-tasks:end -->`;
	assert.equal(parseTaskMarkdown(missingEnd).issues.length, 1);
	assert.equal(parseTaskMarkdown(duplicateStart).issues.length, 1);
});

test("duplicate ids keep the first task and report the conflict", () => {
	const data = taskData();
	const markdown = renderManagedBlock(data);
	const duplicate = markdown.replace('"id":"schedule-1"', '"id":"do-1"');
	const parsed = parseTaskMarkdown(duplicate);
	assert.equal(parsed.data.tasks.length, 1);
	assert.match(parsed.issues.join("\n"), /ID 重复/);
});

test("legacy merge is idempotent", () => {
	const markdownData = taskData();
	const legacy = taskData();
	addTask(legacy, "旧任务", "delegate", {
		idFactory: () => "legacy-only",
		now: new Date("2026-07-19T08:00:00.000Z"),
	});
	const once = mergeTaskData(markdownData, legacy);
	const twice = mergeTaskData(once, legacy);
	assert.equal(once.tasks.length, 3);
	assert.deepEqual(twice, once);
});
