"use strict";

const { QUADRANTS, normalizeData } = require("./core");
const {
	END_MARKER,
	START_MARKER,
	detectNewline,
	findManagedRange,
	parseTaskMarkdown,
	renderManagedBlock,
} = require("./markdown-store");

const BOARD_LANGUAGE = "eisenhower-matrix-blocks";
const LEGACY_BOARD_LANGUAGE = "quadrant-tasks";
const BOARD_LANGUAGES = Object.freeze([BOARD_LANGUAGE, LEGACY_BOARD_LANGUAGE]);
const DEFAULT_BOARD_TITLE = "Matrix";
const BOARD_META_PREFIX = "<!-- quadrant-board ";
const BOARD_META_SUFFIX = " -->";
const BOARD_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{2,127}$/;
const MAX_BOARD_TITLE_LENGTH = 120;
const MAX_QUADRANT_TITLE_LENGTH = 120;
const MAX_QUADRANT_SUBTITLE_LENGTH = 160;

function createBoardId() {
	if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
		return `board-${globalThis.crypto.randomUUID()}`;
	}
	return `board-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

function cloneData(data) {
	return normalizeData(JSON.parse(JSON.stringify(data)));
}

function normalizeBoardTitle(value, fallback = DEFAULT_BOARD_TITLE) {
	if (value === undefined) return fallback;
	if (typeof value !== "string") return null;
	const title = value.trim();
	if (!title || title.length > MAX_BOARD_TITLE_LENGTH) return null;
	return title;
}

function normalizeQuadrantLabels(value) {
	if (value === undefined) return {};
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	if (Object.keys(value).some((quadrant) => !QUADRANTS.includes(quadrant))) return null;
	const normalized = {};
	for (const quadrant of QUADRANTS) {
		if (!Object.prototype.hasOwnProperty.call(value, quadrant)) continue;
		const labels = value[quadrant];
		if (!labels || typeof labels !== "object" || Array.isArray(labels)) return null;
		if (typeof labels.title !== "string" || typeof labels.subtitle !== "string") return null;
		const title = labels.title.trim();
		const subtitle = labels.subtitle.trim();
		if (!title || !subtitle) return null;
		if (title.length > MAX_QUADRANT_TITLE_LENGTH || subtitle.length > MAX_QUADRANT_SUBTITLE_LENGTH) return null;
		normalized[quadrant] = { title, subtitle };
	}
	return normalized;
}

function parseBoardSource(source, options = {}) {
	const newline = detectNewline(source);
	const lines = source.split(/\r?\n/);
	const firstContentIndex = lines.findIndex((line) => line.trim());
	const issues = [];
	let boardId = null;
	let title = DEFAULT_BOARD_TITLE;
	let quadrantLabels = {};
	let bodyStart = 0;

	if (firstContentIndex < 0) {
		issues.push("代码块缺少四象限元数据");
	} else {
		const metadataLine = lines[firstContentIndex].trim();
		if (metadataLine.startsWith(BOARD_META_PREFIX) && metadataLine.endsWith(BOARD_META_SUFFIX)) {
			try {
				const metadata = JSON.parse(metadataLine.slice(BOARD_META_PREFIX.length, -BOARD_META_SUFFIX.length));
				if (metadata?.version === 2 && BOARD_ID_PATTERN.test(metadata.id || "")) {
					boardId = metadata.id;
					const parsedTitle = normalizeBoardTitle(metadata.title);
					if (parsedTitle) title = parsedTitle;
					else issues.push("四象限标题格式无效");
					const parsedQuadrantLabels = normalizeQuadrantLabels(metadata.quadrants);
					if (parsedQuadrantLabels) quadrantLabels = parsedQuadrantLabels;
					else issues.push("象限标题或副标题格式无效");
				}
			} catch {
				// Report the common validation error below.
			}
		}
		if (!boardId) {
			issues.push("四象限元数据缺失或格式无效");
		} else {
			bodyStart = firstContentIndex + 1;
		}
	}

	const body = lines.slice(bodyStart).join(newline).replace(/^(?:\r?\n)+/, "");
	const wrapped = `${START_MARKER}${newline}${body}${newline}${END_MARKER}`;
	const parsed = parseTaskMarkdown(wrapped, options);
	issues.push(...parsed.issues);

	return {
		boardId,
		title,
		quadrantLabels,
		data: parsed.data,
		issues,
		newline,
	};
}

function renderBoardSource(boardId, data, newline = "\n", title = DEFAULT_BOARD_TITLE, quadrantLabels = {}) {
	if (!BOARD_ID_PATTERN.test(boardId || "")) throw new Error("board-id 格式无效");
	const normalizedTitle = normalizeBoardTitle(title, null);
	if (!normalizedTitle) throw new Error(`四象限标题不能为空且不能超过 ${MAX_BOARD_TITLE_LENGTH} 个字符`);
	const normalizedQuadrantLabels = normalizeQuadrantLabels(quadrantLabels);
	if (!normalizedQuadrantLabels) throw new Error("象限标题或副标题格式无效");
	const managed = renderManagedBlock(data, newline);
	const body = managed.slice(START_MARKER.length, managed.length - END_MARKER.length).replace(/(?:\r?\n)+$/, "");
	const metadata = { id: boardId, version: 2 };
	if (normalizedTitle !== DEFAULT_BOARD_TITLE) metadata.title = normalizedTitle;
	if (Object.keys(normalizedQuadrantLabels).length) metadata.quadrants = normalizedQuadrantLabels;
	return `${BOARD_META_PREFIX}${JSON.stringify(metadata)}${BOARD_META_SUFFIX}${body}`;
}

function renderBoardCodeBlock(boardId, data, newline = "\n", title = DEFAULT_BOARD_TITLE, quadrantLabels = {}) {
	return `\`\`\`${BOARD_LANGUAGE}${newline}${renderBoardSource(boardId, data, newline, title, quadrantLabels)}${newline}\`\`\``;
}

function lineRecords(content) {
	const records = [];
	const pattern = /.*?(?:\r\n|\n|$)/g;
	let match;
	let offset = 0;
	while ((match = pattern.exec(content)) && match[0]) {
		const full = match[0];
		const newlineMatch = full.match(/\r\n|\n$/);
		const newline = newlineMatch ? newlineMatch[0] : "";
		const text = newline ? full.slice(0, -newline.length) : full;
		records.push({ text, newline, start: offset, end: offset + full.length });
		offset += full.length;
	}
	return records;
}

function findBoardCodeBlocks(content) {
	const lines = lineRecords(content);
	const blocks = [];
	for (let index = 0; index < lines.length; index += 1) {
		const opener = lines[index].text.match(/^ {0,3}((`{3,})|(~{3,}))(.*)$/);
		if (!opener || !lines[index].newline) continue;
		const fenceChar = opener[1][0];
		const fenceLength = opener[1].length;
		const language = opener[4].trim();
		const closingPattern = new RegExp(`^ {0,3}${fenceChar === "`" ? "`" : "~"}{${fenceLength},}[ \\t]*$`);
		let foundClosingFence = false;
		for (let closeIndex = index + 1; closeIndex < lines.length; closeIndex += 1) {
			if (!closingPattern.test(lines[closeIndex].text)) continue;
			foundClosingFence = true;
			if (!BOARD_LANGUAGES.includes(language)) {
				index = closeIndex;
				break;
			}
			const sourceStart = lines[index].end;
			const sourceEnd = lines[closeIndex].start;
			let source = content.slice(sourceStart, sourceEnd);
			if (source.endsWith("\r\n")) source = source.slice(0, -2);
			else if (source.endsWith("\n")) source = source.slice(0, -1);
			const parsed = parseBoardSource(source);
			blocks.push({
				language,
				boardId: parsed.boardId,
				title: parsed.title,
				quadrantLabels: parsed.quadrantLabels,
				data: parsed.data,
				issues: parsed.issues,
				newline: lines[index].newline || detectNewline(content),
				source,
				sourceStart,
				sourceEnd,
				start: lines[index].start,
				end: lines[closeIndex].start + lines[closeIndex].text.length,
			});
			index = closeIndex;
			break;
		}
		if (!foundClosingFence) break;
	}
	return blocks;
}

function findUniqueBoard(content, boardId) {
	const matches = findBoardCodeBlocks(content).filter((block) => block.boardId === boardId);
	if (matches.length === 0) throw new Error(`找不到四象限表：${boardId}`);
	if (matches.length > 1) throw new Error(`同一文件中存在重复的 board-id：${boardId}`);
	const board = matches[0];
	if (board.issues.length) throw new Error(`四象限代码块内容异常：${board.issues.join("；")}`);
	return board;
}

function readBoardFromDocument(content, boardId) {
	const board = findUniqueBoard(content, boardId);
	return { boardId, title: board.title, quadrantLabels: board.quadrantLabels, data: board.data };
}

function mutateBoardDocument(content, boardId, mutator) {
	const board = findUniqueBoard(content, boardId);
	const draft = cloneData(board.data);
	const result = mutator(draft);
	if (!result) return { content, data: board.data, title: board.title, quadrantLabels: board.quadrantLabels, result };
	const source = renderBoardSource(boardId, draft, board.newline, board.title, board.quadrantLabels);
	return {
		content: `${content.slice(0, board.sourceStart)}${source}${board.newline}${content.slice(board.sourceEnd)}`,
		data: draft,
		title: board.title,
		quadrantLabels: board.quadrantLabels,
		result,
	};
}

function renameBoardDocument(content, boardId, title) {
	const board = findUniqueBoard(content, boardId);
	const normalizedTitle = normalizeBoardTitle(title, null);
	if (!normalizedTitle) throw new Error(`四象限标题不能为空且不能超过 ${MAX_BOARD_TITLE_LENGTH} 个字符`);
	if (normalizedTitle === board.title) {
		return { content, data: board.data, title: board.title, quadrantLabels: board.quadrantLabels, result: board.title };
	}
	const source = renderBoardSource(boardId, board.data, board.newline, normalizedTitle, board.quadrantLabels);
	return {
		content: `${content.slice(0, board.sourceStart)}${source}${board.newline}${content.slice(board.sourceEnd)}`,
		data: board.data,
		title: normalizedTitle,
		quadrantLabels: board.quadrantLabels,
		result: normalizedTitle,
	};
}

function updateQuadrantLabelsDocument(content, boardId, quadrant, labels) {
	if (!QUADRANTS.includes(quadrant)) throw new Error(`象限无效：${quadrant}`);
	const board = findUniqueBoard(content, boardId);
	const quadrantLabels = { ...board.quadrantLabels };
	let result = null;
	if (labels === null) {
		delete quadrantLabels[quadrant];
	} else {
		if (!labels || typeof labels.title !== "string" || typeof labels.subtitle !== "string") {
			throw new Error("象限标题和副标题不能为空");
		}
		const title = labels.title.trim();
		const subtitle = labels.subtitle.trim();
		if (!title || !subtitle) throw new Error("象限标题和副标题不能为空");
		if (title.length > MAX_QUADRANT_TITLE_LENGTH) {
			throw new Error(`象限标题不能超过 ${MAX_QUADRANT_TITLE_LENGTH} 个字符`);
		}
		if (subtitle.length > MAX_QUADRANT_SUBTITLE_LENGTH) {
			throw new Error(`象限副标题不能超过 ${MAX_QUADRANT_SUBTITLE_LENGTH} 个字符`);
		}
		result = { title, subtitle };
		quadrantLabels[quadrant] = result;
	}
	if (JSON.stringify(quadrantLabels) === JSON.stringify(board.quadrantLabels)) {
		return { content, data: board.data, title: board.title, quadrantLabels: board.quadrantLabels, result };
	}
	const source = renderBoardSource(boardId, board.data, board.newline, board.title, quadrantLabels);
	return {
		content: `${content.slice(0, board.sourceStart)}${source}${board.newline}${content.slice(board.sourceEnd)}`,
		data: board.data,
		title: board.title,
		quadrantLabels,
		result,
	};
}

function replaceLegacyManagedBlock(content, boardId, additionalData = null) {
	if (findBoardCodeBlocks(content).some((board) => board.boardId === boardId)) {
		throw new Error(`迁移目标 board-id 已存在：${boardId}`);
	}
	const parsed = parseTaskMarkdown(content);
	if (parsed.issues.length) throw new Error(`旧任务管理区内容异常：${parsed.issues.join("；")}`);
	if (!parsed.hasManagedBlock) throw new Error("找不到旧任务管理区");
	const data = additionalData ? mergeWithoutConflicts(parsed.data, additionalData) : parsed.data;
	const range = findManagedRange(content);
	const newline = detectNewline(content);
	const block = renderBoardCodeBlock(boardId, data, newline);
	return {
		content: `${content.slice(0, range.start)}${block}${content.slice(range.end)}`,
		data,
	};
}

function appendBoardCodeBlock(content, boardId, data) {
	const newline = detectNewline(content);
	const block = renderBoardCodeBlock(boardId, data, newline);
	if (!content) return `${block}${newline}`;
	const separator = content.endsWith(newline) ? newline : `${newline}${newline}`;
	return `${content}${separator}${block}${newline}`;
}

function mergeWithoutConflicts(primary, additional) {
	const merged = cloneData(primary);
	const byId = new Map(merged.tasks.map((task) => [task.id, task]));
	for (const task of normalizeData(additional).tasks) {
		const existing = byId.get(task.id);
		if (existing && JSON.stringify(existing) !== JSON.stringify(task)) {
			throw new Error(`任务 ${task.id} 在两份数据中的内容不同`);
		}
		if (!existing) {
			const copy = { ...task };
			merged.tasks.push(copy);
			byId.set(copy.id, copy);
		}
	}
	return merged;
}

module.exports = {
	BOARD_LANGUAGE,
	BOARD_LANGUAGES,
	DEFAULT_BOARD_TITLE,
	LEGACY_BOARD_LANGUAGE,
	appendBoardCodeBlock,
	createBoardId,
	findBoardCodeBlocks,
	mergeWithoutConflicts,
	mutateBoardDocument,
	parseBoardSource,
	readBoardFromDocument,
	renameBoardDocument,
	renderBoardCodeBlock,
	renderBoardSource,
	replaceLegacyManagedBlock,
	updateQuadrantLabelsDocument,
};
