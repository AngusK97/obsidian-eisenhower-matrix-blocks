"use strict";

const { normalizeDueDate } = require("./task-details");

const DATA_VERSION = 1;
const QUADRANTS = ["do", "schedule", "delegate", "eliminate"];

function createEmptyData() {
	return { version: DATA_VERSION, tasks: [] };
}

function isQuadrant(value) {
	return QUADRANTS.includes(value);
}

function isValidDate(value) {
	return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function normalizeData(raw) {
	if (!raw || !Array.isArray(raw.tasks)) return createEmptyData();

	const ids = new Set();
	const tasks = [];
	for (const candidate of raw.tasks) {
		if (!candidate || typeof candidate !== "object") continue;
		const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
		const title = typeof candidate.title === "string" ? candidate.title.trim() : "";
		if (!id || !title || ids.has(id) || !isQuadrant(candidate.quadrant)) continue;

		ids.add(id);
		tasks.push({
			id,
			title,
			quadrant: candidate.quadrant,
			createdAt: isValidDate(candidate.createdAt)
				? new Date(candidate.createdAt).toISOString()
				: new Date(0).toISOString(),
			completedAt: isValidDate(candidate.completedAt)
				? new Date(candidate.completedAt).toISOString()
				: null,
			order: Number.isFinite(candidate.order) ? candidate.order : tasks.length,
			dueDate: normalizeDueDate(candidate.dueDate),
			notes: typeof candidate.notes === "string" ? candidate.notes : "",
		});
	}

	return { version: DATA_VERSION, tasks };
}

function defaultIdFactory() {
	if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
		return globalThis.crypto.randomUUID();
	}
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

function setTaskOrder(tasks) {
	for (let index = 0; index < tasks.length; index += 1) tasks[index].order = index;
}

function addTask(data, title, quadrant, options = {}) {
	const normalizedTitle = typeof title === "string" ? title.trim() : "";
	if (!normalizedTitle) throw new Error("Task title is required");
	if (!isQuadrant(quadrant)) throw new Error("Invalid quadrant");
	if (options.dueDate != null && options.dueDate !== "" && !normalizeDueDate(options.dueDate)) {
		throw new Error("Invalid due date");
	}
	if (options.notes != null && typeof options.notes !== "string") throw new Error("Invalid notes");

	const now = options.now instanceof Date ? options.now : new Date();
	const idFactory = options.idFactory || defaultIdFactory;
	const existingTasks = getActiveTasks(data, quadrant);
	const task = {
		id: idFactory(),
		title: normalizedTitle,
		quadrant,
		createdAt: now.toISOString(),
		completedAt: null,
		order: 0,
		dueDate: normalizeDueDate(options.dueDate),
		notes: options.notes ?? "",
	};
	data.tasks.push(task);
	setTaskOrder([task, ...existingTasks]);
	return task;
}

function editTask(data, taskId, title, details = {}) {
	const normalizedTitle = typeof title === "string" ? title.trim() : "";
	if (!normalizedTitle) return null;
	if (details.dueDate != null && details.dueDate !== "" && !normalizeDueDate(details.dueDate)) return null;
	if (details.notes != null && typeof details.notes !== "string") return null;
	const task = data.tasks.find((item) => item.id === taskId);
	if (!task) return null;
	task.title = normalizedTitle;
	if (Object.prototype.hasOwnProperty.call(details, "dueDate")) task.dueDate = normalizeDueDate(details.dueDate);
	if (Object.prototype.hasOwnProperty.call(details, "notes")) task.notes = details.notes ?? "";
	return task;
}

function moveTask(data, taskId, quadrant) {
	if (!isQuadrant(quadrant)) return null;
	const task = data.tasks.find((item) => item.id === taskId && !item.completedAt);
	if (!task) return null;
	if (task.quadrant !== quadrant) {
		const sourceQuadrant = task.quadrant;
		const destinationTasks = getActiveTasks(data, quadrant);
		task.quadrant = quadrant;
		setTaskOrder(getActiveTasks(data, sourceQuadrant));
		setTaskOrder([...destinationTasks, task]);
	}
	return task;
}

function reorderTask(data, taskId, quadrant, targetTaskId = null, placement = "before") {
	if (!isQuadrant(quadrant) || !["before", "after"].includes(placement)) return null;
	const task = data.tasks.find((item) => item.id === taskId && !item.completedAt);
	if (!task) return null;
	if (targetTaskId === taskId) return task;

	const sourceQuadrant = task.quadrant;
	const destinationTasks = getActiveTasks(data, quadrant).filter((item) => item.id !== taskId);
	let insertAt = destinationTasks.length;
	if (targetTaskId) {
		const targetIndex = destinationTasks.findIndex((item) => item.id === targetTaskId);
		if (targetIndex < 0) return null;
		insertAt = targetIndex + (placement === "after" ? 1 : 0);
	}

	task.quadrant = quadrant;
	destinationTasks.splice(insertAt, 0, task);
	if (sourceQuadrant !== quadrant) setTaskOrder(getActiveTasks(data, sourceQuadrant));
	setTaskOrder(destinationTasks);
	return task;
}

function completeTask(data, taskId, now = new Date()) {
	const task = data.tasks.find((item) => item.id === taskId && !item.completedAt);
	if (!task) return null;
	task.completedAt = now.toISOString();
	return task;
}

function restoreTask(data, taskId) {
	const task = data.tasks.find((item) => item.id === taskId && item.completedAt);
	if (!task) return null;
	const destinationTasks = getActiveTasks(data, task.quadrant);
	task.completedAt = null;
	setTaskOrder([...destinationTasks, task]);
	return task;
}

function deleteTask(data, taskId) {
	const index = data.tasks.findIndex((item) => item.id === taskId);
	if (index < 0) return null;
	const [task] = data.tasks.splice(index, 1);
	return { task, index };
}

function restoreDeletedTask(data, deleted) {
	if (!deleted || !deleted.task || data.tasks.some((task) => task.id === deleted.task.id)) return null;
	const index = Math.min(Math.max(deleted.index, 0), data.tasks.length);
	data.tasks.splice(index, 0, deleted.task);
	return deleted.task;
}

function getActiveTasks(data, quadrant) {
	return data.tasks
		.filter((task) => !task.completedAt && (!quadrant || task.quadrant === quadrant))
		.sort((left, right) => left.order - right.order || left.createdAt.localeCompare(right.createdAt));
}

function startOfLocalDay(date) {
	const value = new Date(date);
	value.setHours(0, 0, 0, 0);
	return value;
}

function endOfLocalDay(date) {
	const value = new Date(date);
	value.setHours(23, 59, 59, 999);
	return value;
}

function parseLocalDate(value, endOfDay) {
	if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
	const [year, month, day] = value.split("-").map(Number);
	const parsed = new Date(year, month - 1, day);
	if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
	return endOfDay ? endOfLocalDay(parsed) : startOfLocalDay(parsed);
}

function completionBounds(filters = {}, now = new Date()) {
	const today = startOfLocalDay(now);
	if (filters.period === "today") return { start: today, end: endOfLocalDay(today), valid: true };
	if (filters.period === "7d" || filters.period === "30d") {
		const days = filters.period === "7d" ? 7 : 30;
		const start = new Date(today);
		start.setDate(start.getDate() - (days - 1));
		return { start, end: endOfLocalDay(today), valid: true };
	}
	if (filters.period === "custom") {
		const start = filters.startDate ? parseLocalDate(filters.startDate, false) : null;
		const end = filters.endDate ? parseLocalDate(filters.endDate, true) : null;
		return { start, end, valid: !(start && end && start > end) };
	}
	return { start: null, end: null, valid: true };
}

function getCompletedTasks(data, filters = {}, now = new Date()) {
	const bounds = completionBounds(filters, now);
	if (!bounds.valid) return [];
	return data.tasks
		.filter((task) => {
			if (!task.completedAt) return false;
			if (filters.quadrant && filters.quadrant !== "all" && task.quadrant !== filters.quadrant) return false;
			const completed = new Date(task.completedAt);
			if (bounds.start && completed < bounds.start) return false;
			if (bounds.end && completed > bounds.end) return false;
			return true;
		})
		.sort((left, right) => Date.parse(right.completedAt) - Date.parse(left.completedAt));
}

module.exports = {
	DATA_VERSION,
	QUADRANTS,
	addTask,
	completeTask,
	completionBounds,
	createEmptyData,
	deleteTask,
	editTask,
	getActiveTasks,
	getCompletedTasks,
	isQuadrant,
	moveTask,
	normalizeData,
	reorderTask,
	restoreDeletedTask,
	restoreTask,
};
