"use strict";

const { normalizeData } = require("./core");
const {
	END_MARKER,
	START_MARKER,
	detectNewline,
	findManagedRange,
	parseTaskMarkdown,
	renderManagedBlock,
} = require("./markdown-store");

const BOARD_LANGUAGE = "quadrant-tasks";
const BOARD_META_PREFIX = "<!-- quadrant-board ";
const BOARD_META_SUFFIX = " -->";
const BOARD_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{2,127}$/;

function createBoardId() {
	if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
		return `board-${globalThis.crypto.randomUUID()}`;
	}
	return `board-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

function cloneData(data) {
	return normalizeData(JSON.parse(JSON.stringify(data)));
}

function parseBoardSource(source, options = {}) {
	const newline = detectNewline(source);
	const lines = source.split(/\r?\n/);
	const firstContentIndex = lines.findIndex((line) => line.trim());
	const issues = [];
	let boardId = null;
	let bodyStart = 0;

	if (firstContentIndex < 0) {
		issues.push("代码块缺少四象限元数据");
	} else {
		const metadataLine = lines[firstContentIndex].trim();
		if (metadataLine.startsWith(BOARD_META_PREFIX) && metadataLine.endsWith(BOARD_META_SUFFIX)) {
			try {
				const metadata = JSON.parse(metadataLine.slice(BOARD_META_PREFIX.length, -BOARD_META_SUFFIX.length));
				if (metadata?.version === 2 && BOARD_ID_PATTERN.test(metadata.id || "")) boardId = metadata.id;
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
		data: parsed.data,
		issues,
		newline,
	};
}

function renderBoardSource(boardId, data, newline = "\n") {
	if (!BOARD_ID_PATTERN.test(boardId || "")) throw new Error("board-id 格式无效");
	const managed = renderManagedBlock(data, newline);
	const body = managed.slice(START_MARKER.length, managed.length - END_MARKER.length).replace(/(?:\r?\n)+$/, "");
	return `${BOARD_META_PREFIX}${JSON.stringify({ id: boardId, version: 2 })}${BOARD_META_SUFFIX}${body}`;
}

function renderBoardCodeBlock(boardId, data, newline = "\n") {
	return `\`\`\`${BOARD_LANGUAGE}${newline}${renderBoardSource(boardId, data, newline)}${newline}\`\`\``;
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
			if (language !== BOARD_LANGUAGE) {
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
				boardId: parsed.boardId,
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
	return { boardId, data: board.data };
}

function mutateBoardDocument(content, boardId, mutator) {
	const board = findUniqueBoard(content, boardId);
	const draft = cloneData(board.data);
	const result = mutator(draft);
	if (!result) return { content, data: board.data, result };
	const source = renderBoardSource(boardId, draft, board.newline);
	return {
		content: `${content.slice(0, board.sourceStart)}${source}${board.newline}${content.slice(board.sourceEnd)}`,
		data: draft,
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
	appendBoardCodeBlock,
	createBoardId,
	findBoardCodeBlocks,
	mergeWithoutConflicts,
	mutateBoardDocument,
	parseBoardSource,
	readBoardFromDocument,
	renderBoardCodeBlock,
	renderBoardSource,
	replaceLegacyManagedBlock,
};
