"use strict";

const { createEmptyData, isQuadrant, normalizeData } = require("./core");

const START_MARKER = "<!-- quadrant-tasks:start -->";
const END_MARKER = "<!-- quadrant-tasks:end -->";
const META_PREFIX = "<!-- quadrant-task ";
const META_SUFFIX = " -->";

const SECTION_TO_QUADRANT = {
	"## 立即做": "do",
	"## 安排": "schedule",
	"## 委派": "delegate",
	"## 舍弃": "eliminate",
};

const QUADRANT_SECTIONS = [
	["do", "立即做"],
	["schedule", "安排"],
	["delegate", "委派"],
	["eliminate", "舍弃"],
];

function defaultIdFactory() {
	if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
		return globalThis.crypto.randomUUID();
	}
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

function detectNewline(content) {
	return content.includes("\r\n") ? "\r\n" : "\n";
}

function findManagedRange(content) {
	const start = content.indexOf(START_MARKER);
	if (start < 0) return null;
	const endMarkerStart = content.indexOf(END_MARKER, start + START_MARKER.length);
	if (endMarkerStart < 0) return null;
	return { start, end: endMarkerStart + END_MARKER.length };
}

function countOccurrences(content, value) {
	let count = 0;
	let offset = 0;
	while ((offset = content.indexOf(value, offset)) >= 0) {
		count += 1;
		offset += value.length;
	}
	return count;
}

function safeMetadata(line) {
	const trimmed = line.trim();
	if (!trimmed.startsWith(META_PREFIX) || !trimmed.endsWith(META_SUFFIX)) return null;
	try {
		const raw = trimmed.slice(META_PREFIX.length, -META_SUFFIX.length);
		const parsed = JSON.parse(raw);
		return parsed && typeof parsed === "object" ? parsed : null;
	} catch {
		return null;
	}
}

function validIso(value) {
	return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function completedDateToIso(dateText) {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText || "")) return null;
	const [year, month, day] = dateText.split("-").map(Number);
	const value = new Date(year, month - 1, day, 12, 0, 0, 0);
	if (value.getFullYear() !== year || value.getMonth() !== month - 1 || value.getDate() !== day) return null;
	return value.toISOString();
}

function parseTaskLine(line, currentQuadrant, metadata, options) {
	const match = line.match(/^\s*-\s+\[([ xX])\]\s+(.+?)\s*$/);
	if (!match) return null;

	const checked = match[1].toLowerCase() === "x";
	let title = match[2].trim();
	let visibleCompletedDate = null;
	const dateMatch = title.match(/\s+✅\s+(\d{4}-\d{2}-\d{2})\s*$/);
	if (dateMatch) {
		visibleCompletedDate = dateMatch[1];
		title = title.slice(0, dateMatch.index).trim();
	}

	let tagQuadrant = null;
	const tagMatch = title.match(/\s+#quadrant\/(do|schedule|delegate|eliminate)\s*$/);
	if (tagMatch) {
		tagQuadrant = tagMatch[1];
		title = title.slice(0, tagMatch.index).trim();
	}

	const metadataQuadrant = isQuadrant(metadata?.quadrant) ? metadata.quadrant : null;
	const quadrant = tagQuadrant || currentQuadrant || metadataQuadrant;
	if (!title || !isQuadrant(quadrant)) return null;

	const now = options.now instanceof Date ? options.now : new Date();
	const idFactory = options.idFactory || defaultIdFactory;
	const completedAt = checked
		? validIso(metadata?.completedAt)
			? new Date(metadata.completedAt).toISOString()
			: completedDateToIso(visibleCompletedDate) || now.toISOString()
		: null;

	return {
		id: typeof metadata?.id === "string" && metadata.id.trim() ? metadata.id.trim() : idFactory(),
		title,
		quadrant,
		createdAt: validIso(metadata?.createdAt) ? new Date(metadata.createdAt).toISOString() : now.toISOString(),
		completedAt,
		order: Number.isFinite(metadata?.order) ? metadata.order : options.fallbackOrder,
	};
}

function parseTaskMarkdown(content, options = {}) {
	const startCount = countOccurrences(content, START_MARKER);
	const endCount = countOccurrences(content, END_MARKER);
	if (startCount !== endCount || startCount > 1) {
		return {
			data: createEmptyData(),
			issues: ["任务管理区标记缺失或重复"],
			hasManagedBlock: false,
		};
	}
	const range = findManagedRange(content);
	if (!range) {
		return { data: createEmptyData(), issues: [], hasManagedBlock: false };
	}

	const managed = content.slice(range.start + START_MARKER.length, range.end - END_MARKER.length);
	const lines = managed.split(/\r?\n/);
	const tasks = [];
	const issues = [];
	const ids = new Set();
	const fallbackOrders = { do: 0, schedule: 0, delegate: 0, eliminate: 0 };
	let currentQuadrant = null;
	let completedSection = false;

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index];
		const trimmed = line.trim();
		if (!trimmed) continue;
		if (SECTION_TO_QUADRANT[trimmed]) {
			currentQuadrant = SECTION_TO_QUADRANT[trimmed];
			completedSection = false;
			continue;
		}
		if (trimmed === "## 已完成") {
			currentQuadrant = null;
			completedSection = true;
			continue;
		}
		if (trimmed.startsWith("<!--") && trimmed.endsWith("-->")) {
			issues.push(`第 ${index + 1} 行存在未关联或无法解析的元数据`);
			continue;
		}
		if (!/^\s*-\s+\[/.test(line)) {
			issues.push(`第 ${index + 1} 行不是受支持的任务格式`);
			continue;
		}

		const nextLine = lines[index + 1] || "";
		const metadata = safeMetadata(nextLine);
		const task = parseTaskLine(
			line,
			completedSection ? null : currentQuadrant,
			metadata,
			{
				...options,
				fallbackOrder: currentQuadrant ? fallbackOrders[currentQuadrant] : tasks.length,
			},
		);
		if (nextLine.trim().startsWith(META_PREFIX)) {
			index += 1;
			if (!metadata) issues.push(`第 ${index + 1} 行的任务元数据不是有效 JSON`);
		}
		if (!task) {
			issues.push(`第 ${index + 1} 行的任务缺少标题或有效象限`);
			continue;
		}
		if (ids.has(task.id)) {
			issues.push(`任务 ID 重复：${task.id}`);
			continue;
		}
		ids.add(task.id);
		if (!task.completedAt) fallbackOrders[task.quadrant] += 1;
		tasks.push(task);
	}

	return {
		data: normalizeData({ version: 1, tasks }),
		issues,
		hasManagedBlock: true,
	};
}

function formatLocalDate(isoValue) {
	const date = new Date(isoValue);
	const year = String(date.getFullYear());
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function taskMetadata(task) {
	return `${META_PREFIX}${JSON.stringify({
		id: task.id,
		quadrant: task.quadrant,
		createdAt: task.createdAt,
		completedAt: task.completedAt || null,
		order: task.order,
	})}${META_SUFFIX}`;
}

function renderManagedBlock(data, newline = "\n") {
	const normalized = normalizeData(data);
	const lines = [START_MARKER, ""];
	for (const [quadrant, heading] of QUADRANT_SECTIONS) {
		lines.push(`## ${heading}`);
		const tasks = normalized.tasks
			.filter((task) => !task.completedAt && task.quadrant === quadrant)
			.sort((left, right) => left.order - right.order || left.createdAt.localeCompare(right.createdAt));
		for (const task of tasks) {
			lines.push(`- [ ] ${task.title} #quadrant/${task.quadrant}`);
			lines.push(`  ${taskMetadata(task)}`);
		}
		lines.push("");
	}

	lines.push("## 已完成");
	const completed = normalized.tasks
		.filter((task) => task.completedAt)
		.sort((left, right) => Date.parse(right.completedAt) - Date.parse(left.completedAt));
	for (const task of completed) {
		lines.push(`- [x] ${task.title} #quadrant/${task.quadrant} ✅ ${formatLocalDate(task.completedAt)}`);
		lines.push(`  ${taskMetadata(task)}`);
	}
	lines.push("", END_MARKER);
	return lines.join(newline);
}

function updateMarkdownDocument(content, data) {
	const newline = detectNewline(content);
	const block = renderManagedBlock(data, newline);
	const range = findManagedRange(content);
	if (range) return `${content.slice(0, range.start)}${block}${content.slice(range.end)}`;

	if (!content.trim()) return `# Quadrant Tasks${newline}${newline}${block}${newline}`;
	const separator = content.endsWith(newline) ? newline : `${newline}${newline}`;
	return `${content}${separator}${block}${newline}`;
}

function mergeTaskData(primary, additional) {
	const merged = normalizeData(primary);
	const ids = new Set(merged.tasks.map((task) => task.id));
	for (const task of normalizeData(additional).tasks) {
		if (ids.has(task.id)) continue;
		merged.tasks.push({ ...task });
		ids.add(task.id);
	}
	return merged;
}

module.exports = {
	END_MARKER,
	START_MARKER,
	detectNewline,
	findManagedRange,
	mergeTaskData,
	parseTaskMarkdown,
	renderManagedBlock,
	updateMarkdownDocument,
};
