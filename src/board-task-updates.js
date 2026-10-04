"use strict";

const { QUADRANTS, getActiveTasks, getCompletedTasks, completionBounds } = require("./core");

function cardContent(task) {
	if (!task) return "";
	const { order, ...content } = task;
	return JSON.stringify(content);
}

function reconcileRows(list, tasks, oldTasks, renderRow, emptyText) {
	const existing = new Map([...list.children].map(row => [row.getAttribute("data-task-id"), row]));
	const retained = new Set();
	for (let index = 0; index < tasks.length; index += 1) {
		const task = tasks[index];
		let row = existing.get(task.id);
		// Handlers use task details, never the order number: sorting need not rebuild every card.
		if (!row || cardContent(oldTasks.get(task.id)) !== cardContent(task)) row = renderRow(list, task);
		if (list.children[index] !== row) list.insertBefore(row, list.children[index] || null);
		retained.add(row);
	}
	for (const row of [...list.children]) if (!retained.has(row)) row.remove();
	if (!tasks.length) list.createEl("li", { cls: "qt-empty", text: emptyText });
}

function updateBoardTasks(renderer, previousData) {
	const root = renderer.containerEl;
	const oldTasks = new Map(previousData.tasks.map(task => [task.id, task]));
	const stats = root.querySelector(".qt-stats");
	stats.children[0].textContent = renderer.plugin.t("stats.active", { count: getActiveTasks(renderer.data).length });
	stats.children[1].textContent = renderer.plugin.t("stats.completed", { count: getCompletedTasks(renderer.data).length });
	for (const quadrant of QUADRANTS) {
		const section = root.querySelector(`[data-quadrant="${quadrant}"]`);
		const tasks = getActiveTasks(renderer.data, quadrant);
		section.querySelector(".qt-count").textContent = String(tasks.length);
		reconcileRows(section.querySelector(".qt-task-list"), tasks, oldTasks,
			(list, task) => renderer.renderActiveTask(list, task), renderer.plugin.t("task.empty"));
	}
	const completed = getCompletedTasks(renderer.data, renderer.filters);
	root.querySelector(".qt-completed-count").textContent = `${completed.length} / ${getCompletedTasks(renderer.data).length}`;
	const valid = completionBounds(renderer.filters).valid;
	const message = !valid ? "completed.invalidRange" : getCompletedTasks(renderer.data).length ? "completed.noMatches" : "completed.none";
	const list = root.querySelector(".qt-completed-list");
	const tasks = valid ? completed : [];
	reconcileRows(list, tasks, oldTasks, (parent, task) => renderer.renderCompletedTask(parent, task), renderer.plugin.t(message));
	if (!valid) list.children[0].addClass("qt-filter-error");
}

module.exports = { updateBoardTasks };
