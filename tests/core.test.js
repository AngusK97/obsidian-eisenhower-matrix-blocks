"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
	addTask,
	completeTask,
	completionBounds,
	createEmptyData,
	deleteTask,
	editTask,
	getActiveTasks,
	getCompletedTasks,
	moveTask,
	normalizeData,
	restoreDeletedTask,
	restoreTask,
} = require("../src/core");

function add(data, title, quadrant, id, now = new Date(2026, 6, 1, 9, 0)) {
	return addTask(data, title, quadrant, { idFactory: () => id, now });
}

test("adds tasks to the requested quadrant with stable ordering", () => {
	const data = createEmptyData();
	add(data, "First", "do", "one");
	add(data, "Second", "do", "two");
	add(data, "Elsewhere", "schedule", "three");

	assert.deepEqual(getActiveTasks(data, "do").map((task) => task.id), ["one", "two"]);
	assert.equal(getActiveTasks(data, "schedule")[0].title, "Elsewhere");
});

test("rejects empty titles and invalid quadrants", () => {
	const data = createEmptyData();
	assert.throws(() => addTask(data, " ", "do"), /title/i);
	assert.throws(() => addTask(data, "Task", "unknown"), /quadrant/i);
});

test("edits and moves an active task without duplicating it", () => {
	const data = createEmptyData();
	add(data, "Draft", "do", "one");

	assert.equal(editTask(data, "one", "Final").title, "Final");
	assert.equal(moveTask(data, "one", "delegate").quadrant, "delegate");
	assert.equal(data.tasks.length, 1);
	assert.equal(getActiveTasks(data, "do").length, 0);
	assert.equal(getActiveTasks(data, "delegate").length, 1);
});

test("completion records its time and restoration returns to the source quadrant", () => {
	const data = createEmptyData();
	add(data, "Ship", "schedule", "one");
	const completedAt = new Date(2026, 6, 22, 15, 30);

	completeTask(data, "one", completedAt);
	assert.equal(getActiveTasks(data, "schedule").length, 0);
	assert.equal(getCompletedTasks(data)[0].completedAt, completedAt.toISOString());
	assert.equal(getCompletedTasks(data)[0].quadrant, "schedule");

	restoreTask(data, "one");
	assert.equal(getCompletedTasks(data).length, 0);
	assert.equal(getActiveTasks(data, "schedule")[0].id, "one");
});

test("filters completion history by quadrant and local calendar periods", () => {
	const data = createEmptyData();
	const now = new Date(2026, 6, 22, 12, 0);
	add(data, "Today do", "do", "today-do");
	add(data, "Today schedule", "schedule", "today-schedule");
	add(data, "Six days", "do", "six-days");
	add(data, "Seven days", "do", "seven-days");
	completeTask(data, "today-do", new Date(2026, 6, 22, 9, 0));
	completeTask(data, "today-schedule", new Date(2026, 6, 22, 10, 0));
	completeTask(data, "six-days", new Date(2026, 6, 16, 23, 59));
	completeTask(data, "seven-days", new Date(2026, 6, 15, 23, 59));

	assert.deepEqual(
		getCompletedTasks(data, { quadrant: "do", period: "today" }, now).map((task) => task.id),
		["today-do"],
	);
	assert.deepEqual(
		getCompletedTasks(data, { quadrant: "do", period: "7d" }, now).map((task) => task.id),
		["today-do", "six-days"],
	);
});

test("custom date range includes both boundary days and accepts one-sided ranges", () => {
	const data = createEmptyData();
	add(data, "Start", "do", "start");
	add(data, "End", "do", "end");
	add(data, "Later", "do", "later");
	completeTask(data, "start", new Date(2026, 6, 10, 0, 0));
	completeTask(data, "end", new Date(2026, 6, 12, 23, 59));
	completeTask(data, "later", new Date(2026, 6, 13, 0, 0));

	const filters = { period: "custom", startDate: "2026-07-10", endDate: "2026-07-12" };
	assert.deepEqual(getCompletedTasks(data, filters).map((task) => task.id), ["end", "start"]);
	assert.deepEqual(
		getCompletedTasks(data, { period: "custom", startDate: "2026-07-12" }).map((task) => task.id),
		["later", "end"],
	);
});

test("invalid custom range is explicit and returns no results", () => {
	const filters = { period: "custom", startDate: "2026-07-20", endDate: "2026-07-10" };
	assert.equal(completionBounds(filters).valid, false);
	assert.deepEqual(getCompletedTasks(createEmptyData(), filters), []);
});

test("delete can be undone at the original position", () => {
	const data = createEmptyData();
	add(data, "One", "do", "one");
	add(data, "Two", "schedule", "two");
	const deleted = deleteTask(data, "one");

	assert.deepEqual(data.tasks.map((task) => task.id), ["two"]);
	restoreDeletedTask(data, deleted);
	assert.deepEqual(data.tasks.map((task) => task.id), ["one", "two"]);
});

test("JSON round trip preserves state and discards corrupt records", () => {
	const data = createEmptyData();
	add(data, "Keep", "delegate", "one");
	completeTask(data, "one", new Date(2026, 6, 22, 8, 0));
	const restored = normalizeData(JSON.parse(JSON.stringify(data)));

	assert.deepEqual(restored, data);
	assert.deepEqual(normalizeData({ tasks: [{ id: "bad", title: "", quadrant: "do" }] }), createEmptyData());
	assert.deepEqual(normalizeData(null), createEmptyData());
});

test("missing task operations are safe no-ops", () => {
	const data = createEmptyData();
	assert.equal(editTask(data, "missing", "Title"), null);
	assert.equal(moveTask(data, "missing", "do"), null);
	assert.equal(completeTask(data, "missing"), null);
	assert.equal(restoreTask(data, "missing"), null);
	assert.equal(deleteTask(data, "missing"), null);
});
