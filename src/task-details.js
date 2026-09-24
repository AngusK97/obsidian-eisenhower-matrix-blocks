"use strict";

const DAY_MS = 24 * 60 * 60 * 1000;

// UTC is used only to number calendar days, never to interpret the user's deadline.
function calendarDay(year, month, day) {
	const value = new Date(0);
	value.setUTCFullYear(year, month - 1, day);
	return value;
}

function normalizeDueDate(value) {
	if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
	const [year, month, day] = value.split("-").map(Number);
	if (year < 1) return null;
	const parsed = calendarDay(year, month, day);
	return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
		? value
		: null;
}

function getDueDateInfo(dueDate, completedAt, now = new Date()) {
	const date = normalizeDueDate(dueDate);
	if (!date || !(now instanceof Date) || Number.isNaN(now.getTime())) return null;
	const [year, month, day] = date.split("-").map(Number);
	const today = calendarDay(now.getFullYear(), now.getMonth() + 1, now.getDate());
	const days = Math.round((calendarDay(year, month, day) - today) / DAY_MS);
	return { date, days, urgent: !completedAt && days <= 3 };
}

function normalizeDueTime(value) {
	return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : null;
}

function getDueDateTone(days, completedAt) {
	if (completedAt) return "muted";
	if (days <= 3) return "red";
	return days <= 7 ? "yellow" : "green";
}

module.exports = { getDueDateInfo, getDueDateTone, normalizeDueDate, normalizeDueTime };
