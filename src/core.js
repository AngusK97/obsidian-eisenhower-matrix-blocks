"use strict";

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

function nextOrder(data, quadrant) {
	return data.tasks.reduce(
		(max, task) => task.quadrant === quadrant && !task.completedAt ? Math.max(max, task.order) : max,
		-1,
	) + 1;
}

function addTask(data, title, quadrant, options = {}) {
	const normalizedTitle = typeof title === "string" ? title.trim() : "";
	if (!normalizedTitle) throw new Error("Task title is required");
	if (!isQuadrant(quadrant)) throw new Error("Invalid quadrant");

	const now = options.now instanceof Date ? options.now : new Date();
	const idFactory = options.idFactory || defaultIdFactory;
	const task = {
		id: idFactory(),
		title: normalizedTitle,
		quadrant,
		createdAt: now.toISOString(),
		completedAt: null,
		order: nextOrder(data, quadrant),
	};
	data.tasks.push(task);
	return task;
}

function editTask(data, taskId, title) {
	const normalizedTitle = typeof title === "string" ? title.trim() : "";
	if (!normalizedTitle) return null;
	const task = data.tasks.find((item) => item.id === taskId);
	if (!task) return null;
	task.title = normalizedTitle;
	return task;
}

function moveTask(data, taskId, quadrant) {
	if (!isQuadrant(quadrant)) return null;
	const task = data.tasks.find((item) => item.id === taskId && !item.completedAt);
	if (!task) return null;
	if (task.quadrant !== quadrant) {
		task.quadrant = quadrant;
		task.order = nextOrder(data, quadrant);
	}
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
	task.completedAt = null;
	task.order = nextOrder(data, task.quadrant);
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
	restoreDeletedTask,
	restoreTask,
};
