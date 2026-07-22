"use strict";
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// src/core.js
var require_core = __commonJS({
  "src/core.js"(exports2, module2) {
    "use strict";
    var DATA_VERSION = 1;
    var QUADRANTS2 = ["do", "schedule", "delegate", "eliminate"];
    function createEmptyData2() {
      return { version: DATA_VERSION, tasks: [] };
    }
    function isQuadrant(value) {
      return QUADRANTS2.includes(value);
    }
    function isValidDate(value) {
      return typeof value === "string" && !Number.isNaN(Date.parse(value));
    }
    function normalizeData2(raw) {
      if (!raw || !Array.isArray(raw.tasks)) return createEmptyData2();
      const ids = /* @__PURE__ */ new Set();
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
          createdAt: isValidDate(candidate.createdAt) ? new Date(candidate.createdAt).toISOString() : (/* @__PURE__ */ new Date(0)).toISOString(),
          completedAt: isValidDate(candidate.completedAt) ? new Date(candidate.completedAt).toISOString() : null,
          order: Number.isFinite(candidate.order) ? candidate.order : tasks.length
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
        -1
      ) + 1;
    }
    function addTask2(data, title, quadrant, options = {}) {
      const normalizedTitle = typeof title === "string" ? title.trim() : "";
      if (!normalizedTitle) throw new Error("Task title is required");
      if (!isQuadrant(quadrant)) throw new Error("Invalid quadrant");
      const now = options.now instanceof Date ? options.now : /* @__PURE__ */ new Date();
      const idFactory = options.idFactory || defaultIdFactory;
      const task = {
        id: idFactory(),
        title: normalizedTitle,
        quadrant,
        createdAt: now.toISOString(),
        completedAt: null,
        order: nextOrder(data, quadrant)
      };
      data.tasks.push(task);
      return task;
    }
    function editTask2(data, taskId, title) {
      const normalizedTitle = typeof title === "string" ? title.trim() : "";
      if (!normalizedTitle) return null;
      const task = data.tasks.find((item) => item.id === taskId);
      if (!task) return null;
      task.title = normalizedTitle;
      return task;
    }
    function moveTask2(data, taskId, quadrant) {
      if (!isQuadrant(quadrant)) return null;
      const task = data.tasks.find((item) => item.id === taskId && !item.completedAt);
      if (!task) return null;
      if (task.quadrant !== quadrant) {
        task.quadrant = quadrant;
        task.order = nextOrder(data, quadrant);
      }
      return task;
    }
    function completeTask2(data, taskId, now = /* @__PURE__ */ new Date()) {
      const task = data.tasks.find((item) => item.id === taskId && !item.completedAt);
      if (!task) return null;
      task.completedAt = now.toISOString();
      return task;
    }
    function restoreTask2(data, taskId) {
      const task = data.tasks.find((item) => item.id === taskId && item.completedAt);
      if (!task) return null;
      task.completedAt = null;
      task.order = nextOrder(data, task.quadrant);
      return task;
    }
    function deleteTask2(data, taskId) {
      const index = data.tasks.findIndex((item) => item.id === taskId);
      if (index < 0) return null;
      const [task] = data.tasks.splice(index, 1);
      return { task, index };
    }
    function restoreDeletedTask2(data, deleted) {
      if (!deleted || !deleted.task || data.tasks.some((task) => task.id === deleted.task.id)) return null;
      const index = Math.min(Math.max(deleted.index, 0), data.tasks.length);
      data.tasks.splice(index, 0, deleted.task);
      return deleted.task;
    }
    function getActiveTasks2(data, quadrant) {
      return data.tasks.filter((task) => !task.completedAt && (!quadrant || task.quadrant === quadrant)).sort((left, right) => left.order - right.order || left.createdAt.localeCompare(right.createdAt));
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
    function completionBounds2(filters = {}, now = /* @__PURE__ */ new Date()) {
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
    function getCompletedTasks2(data, filters = {}, now = /* @__PURE__ */ new Date()) {
      const bounds = completionBounds2(filters, now);
      if (!bounds.valid) return [];
      return data.tasks.filter((task) => {
        if (!task.completedAt) return false;
        if (filters.quadrant && filters.quadrant !== "all" && task.quadrant !== filters.quadrant) return false;
        const completed = new Date(task.completedAt);
        if (bounds.start && completed < bounds.start) return false;
        if (bounds.end && completed > bounds.end) return false;
        return true;
      }).sort((left, right) => Date.parse(right.completedAt) - Date.parse(left.completedAt));
    }
    module2.exports = {
      DATA_VERSION,
      QUADRANTS: QUADRANTS2,
      addTask: addTask2,
      completeTask: completeTask2,
      completionBounds: completionBounds2,
      createEmptyData: createEmptyData2,
      deleteTask: deleteTask2,
      editTask: editTask2,
      getActiveTasks: getActiveTasks2,
      getCompletedTasks: getCompletedTasks2,
      isQuadrant,
      moveTask: moveTask2,
      normalizeData: normalizeData2,
      restoreDeletedTask: restoreDeletedTask2,
      restoreTask: restoreTask2
    };
  }
});

// src/markdown-store.js
var require_markdown_store = __commonJS({
  "src/markdown-store.js"(exports2, module2) {
    "use strict";
    var { createEmptyData: createEmptyData2, isQuadrant, normalizeData: normalizeData2 } = require_core();
    var START_MARKER = "<!-- quadrant-tasks:start -->";
    var END_MARKER = "<!-- quadrant-tasks:end -->";
    var META_PREFIX = "<!-- quadrant-task ";
    var META_SUFFIX = " -->";
    var SECTION_TO_QUADRANT = {
      "## \u7ACB\u5373\u505A": "do",
      "## \u5B89\u6392": "schedule",
      "## \u59D4\u6D3E": "delegate",
      "## \u820D\u5F03": "eliminate"
    };
    var QUADRANT_SECTIONS = [
      ["do", "\u7ACB\u5373\u505A"],
      ["schedule", "\u5B89\u6392"],
      ["delegate", "\u59D4\u6D3E"],
      ["eliminate", "\u820D\u5F03"]
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
      } catch (e) {
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
      const metadataQuadrant = isQuadrant(metadata == null ? void 0 : metadata.quadrant) ? metadata.quadrant : null;
      const quadrant = tagQuadrant || currentQuadrant || metadataQuadrant;
      if (!title || !isQuadrant(quadrant)) return null;
      const now = options.now instanceof Date ? options.now : /* @__PURE__ */ new Date();
      const idFactory = options.idFactory || defaultIdFactory;
      const completedAt = checked ? validIso(metadata == null ? void 0 : metadata.completedAt) ? new Date(metadata.completedAt).toISOString() : completedDateToIso(visibleCompletedDate) || now.toISOString() : null;
      return {
        id: typeof (metadata == null ? void 0 : metadata.id) === "string" && metadata.id.trim() ? metadata.id.trim() : idFactory(),
        title,
        quadrant,
        createdAt: validIso(metadata == null ? void 0 : metadata.createdAt) ? new Date(metadata.createdAt).toISOString() : now.toISOString(),
        completedAt,
        order: Number.isFinite(metadata == null ? void 0 : metadata.order) ? metadata.order : options.fallbackOrder
      };
    }
    function parseTaskMarkdown2(content, options = {}) {
      const startCount = countOccurrences(content, START_MARKER);
      const endCount = countOccurrences(content, END_MARKER);
      if (startCount !== endCount || startCount > 1) {
        return {
          data: createEmptyData2(),
          issues: ["\u4EFB\u52A1\u7BA1\u7406\u533A\u6807\u8BB0\u7F3A\u5931\u6216\u91CD\u590D"],
          hasManagedBlock: false
        };
      }
      const range = findManagedRange(content);
      if (!range) {
        return { data: createEmptyData2(), issues: [], hasManagedBlock: false };
      }
      const managed = content.slice(range.start + START_MARKER.length, range.end - END_MARKER.length);
      const lines = managed.split(/\r?\n/);
      const tasks = [];
      const issues = [];
      const ids = /* @__PURE__ */ new Set();
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
        if (trimmed === "## \u5DF2\u5B8C\u6210") {
          currentQuadrant = null;
          completedSection = true;
          continue;
        }
        if (trimmed.startsWith("<!--") && trimmed.endsWith("-->")) {
          issues.push(`\u7B2C ${index + 1} \u884C\u5B58\u5728\u672A\u5173\u8054\u6216\u65E0\u6CD5\u89E3\u6790\u7684\u5143\u6570\u636E`);
          continue;
        }
        if (!/^\s*-\s+\[/.test(line)) {
          issues.push(`\u7B2C ${index + 1} \u884C\u4E0D\u662F\u53D7\u652F\u6301\u7684\u4EFB\u52A1\u683C\u5F0F`);
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
            fallbackOrder: currentQuadrant ? fallbackOrders[currentQuadrant] : tasks.length
          }
        );
        if (nextLine.trim().startsWith(META_PREFIX)) {
          index += 1;
          if (!metadata) issues.push(`\u7B2C ${index + 1} \u884C\u7684\u4EFB\u52A1\u5143\u6570\u636E\u4E0D\u662F\u6709\u6548 JSON`);
        }
        if (!task) {
          issues.push(`\u7B2C ${index + 1} \u884C\u7684\u4EFB\u52A1\u7F3A\u5C11\u6807\u9898\u6216\u6709\u6548\u8C61\u9650`);
          continue;
        }
        if (ids.has(task.id)) {
          issues.push(`\u4EFB\u52A1 ID \u91CD\u590D\uFF1A${task.id}`);
          continue;
        }
        ids.add(task.id);
        if (!task.completedAt) fallbackOrders[task.quadrant] += 1;
        tasks.push(task);
      }
      return {
        data: normalizeData2({ version: 1, tasks }),
        issues,
        hasManagedBlock: true
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
        order: task.order
      })}${META_SUFFIX}`;
    }
    function renderManagedBlock(data, newline = "\n") {
      const normalized = normalizeData2(data);
      const lines = [START_MARKER, ""];
      for (const [quadrant, heading] of QUADRANT_SECTIONS) {
        lines.push(`## ${heading}`);
        const tasks = normalized.tasks.filter((task) => !task.completedAt && task.quadrant === quadrant).sort((left, right) => left.order - right.order || left.createdAt.localeCompare(right.createdAt));
        for (const task of tasks) {
          lines.push(`- [ ] ${task.title} #quadrant/${task.quadrant}`);
          lines.push(`  ${taskMetadata(task)}`);
        }
        lines.push("");
      }
      lines.push("## \u5DF2\u5B8C\u6210");
      const completed = normalized.tasks.filter((task) => task.completedAt).sort((left, right) => Date.parse(right.completedAt) - Date.parse(left.completedAt));
      for (const task of completed) {
        lines.push(`- [x] ${task.title} #quadrant/${task.quadrant} \u2705 ${formatLocalDate(task.completedAt)}`);
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
      const merged = normalizeData2(primary);
      const ids = new Set(merged.tasks.map((task) => task.id));
      for (const task of normalizeData2(additional).tasks) {
        if (ids.has(task.id)) continue;
        merged.tasks.push({ ...task });
        ids.add(task.id);
      }
      return merged;
    }
    module2.exports = {
      END_MARKER,
      START_MARKER,
      detectNewline,
      findManagedRange,
      mergeTaskData,
      parseTaskMarkdown: parseTaskMarkdown2,
      renderManagedBlock,
      updateMarkdownDocument
    };
  }
});

// src/board-store.js
var require_board_store = __commonJS({
  "src/board-store.js"(exports2, module2) {
    "use strict";
    var { normalizeData: normalizeData2 } = require_core();
    var {
      END_MARKER,
      START_MARKER,
      detectNewline,
      findManagedRange,
      parseTaskMarkdown: parseTaskMarkdown2,
      renderManagedBlock
    } = require_markdown_store();
    var BOARD_LANGUAGE2 = "quadrant-tasks";
    var BOARD_META_PREFIX = "<!-- quadrant-board ";
    var BOARD_META_SUFFIX = " -->";
    var BOARD_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{2,127}$/;
    function createBoardId2() {
      if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
        return `board-${globalThis.crypto.randomUUID()}`;
      }
      return `board-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
    }
    function cloneData2(data) {
      return normalizeData2(JSON.parse(JSON.stringify(data)));
    }
    function parseBoardSource2(source, options = {}) {
      const newline = detectNewline(source);
      const lines = source.split(/\r?\n/);
      const firstContentIndex = lines.findIndex((line) => line.trim());
      const issues = [];
      let boardId = null;
      let bodyStart = 0;
      if (firstContentIndex < 0) {
        issues.push("\u4EE3\u7801\u5757\u7F3A\u5C11\u56DB\u8C61\u9650\u5143\u6570\u636E");
      } else {
        const metadataLine = lines[firstContentIndex].trim();
        if (metadataLine.startsWith(BOARD_META_PREFIX) && metadataLine.endsWith(BOARD_META_SUFFIX)) {
          try {
            const metadata = JSON.parse(metadataLine.slice(BOARD_META_PREFIX.length, -BOARD_META_SUFFIX.length));
            if ((metadata == null ? void 0 : metadata.version) === 2 && BOARD_ID_PATTERN.test(metadata.id || "")) boardId = metadata.id;
          } catch (e) {
          }
        }
        if (!boardId) {
          issues.push("\u56DB\u8C61\u9650\u5143\u6570\u636E\u7F3A\u5931\u6216\u683C\u5F0F\u65E0\u6548");
        } else {
          bodyStart = firstContentIndex + 1;
        }
      }
      const body = lines.slice(bodyStart).join(newline).replace(/^(?:\r?\n)+/, "");
      const wrapped = `${START_MARKER}${newline}${body}${newline}${END_MARKER}`;
      const parsed = parseTaskMarkdown2(wrapped, options);
      issues.push(...parsed.issues);
      return {
        boardId,
        data: parsed.data,
        issues,
        newline
      };
    }
    function renderBoardSource(boardId, data, newline = "\n") {
      if (!BOARD_ID_PATTERN.test(boardId || "")) throw new Error("board-id \u683C\u5F0F\u65E0\u6548");
      const managed = renderManagedBlock(data, newline);
      const body = managed.slice(START_MARKER.length, managed.length - END_MARKER.length).replace(/(?:\r?\n)+$/, "");
      return `${BOARD_META_PREFIX}${JSON.stringify({ id: boardId, version: 2 })}${BOARD_META_SUFFIX}${body}`;
    }
    function renderBoardCodeBlock2(boardId, data, newline = "\n") {
      return `\`\`\`${BOARD_LANGUAGE2}${newline}${renderBoardSource(boardId, data, newline)}${newline}\`\`\``;
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
    function findBoardCodeBlocks2(content) {
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
          if (language !== BOARD_LANGUAGE2) {
            index = closeIndex;
            break;
          }
          const sourceStart = lines[index].end;
          const sourceEnd = lines[closeIndex].start;
          let source = content.slice(sourceStart, sourceEnd);
          if (source.endsWith("\r\n")) source = source.slice(0, -2);
          else if (source.endsWith("\n")) source = source.slice(0, -1);
          const parsed = parseBoardSource2(source);
          blocks.push({
            boardId: parsed.boardId,
            data: parsed.data,
            issues: parsed.issues,
            newline: lines[index].newline || detectNewline(content),
            source,
            sourceStart,
            sourceEnd,
            start: lines[index].start,
            end: lines[closeIndex].start + lines[closeIndex].text.length
          });
          index = closeIndex;
          break;
        }
        if (!foundClosingFence) break;
      }
      return blocks;
    }
    function findUniqueBoard(content, boardId) {
      const matches = findBoardCodeBlocks2(content).filter((block) => block.boardId === boardId);
      if (matches.length === 0) throw new Error(`\u627E\u4E0D\u5230\u56DB\u8C61\u9650\u8868\uFF1A${boardId}`);
      if (matches.length > 1) throw new Error(`\u540C\u4E00\u6587\u4EF6\u4E2D\u5B58\u5728\u91CD\u590D\u7684 board-id\uFF1A${boardId}`);
      const board = matches[0];
      if (board.issues.length) throw new Error(`\u56DB\u8C61\u9650\u4EE3\u7801\u5757\u5185\u5BB9\u5F02\u5E38\uFF1A${board.issues.join("\uFF1B")}`);
      return board;
    }
    function readBoardFromDocument2(content, boardId) {
      const board = findUniqueBoard(content, boardId);
      return { boardId, data: board.data };
    }
    function mutateBoardDocument2(content, boardId, mutator) {
      const board = findUniqueBoard(content, boardId);
      const draft = cloneData2(board.data);
      const result = mutator(draft);
      if (!result) return { content, data: board.data, result };
      const source = renderBoardSource(boardId, draft, board.newline);
      return {
        content: `${content.slice(0, board.sourceStart)}${source}${board.newline}${content.slice(board.sourceEnd)}`,
        data: draft,
        result
      };
    }
    function replaceLegacyManagedBlock2(content, boardId, additionalData = null) {
      if (findBoardCodeBlocks2(content).some((board) => board.boardId === boardId)) {
        throw new Error(`\u8FC1\u79FB\u76EE\u6807 board-id \u5DF2\u5B58\u5728\uFF1A${boardId}`);
      }
      const parsed = parseTaskMarkdown2(content);
      if (parsed.issues.length) throw new Error(`\u65E7\u4EFB\u52A1\u7BA1\u7406\u533A\u5185\u5BB9\u5F02\u5E38\uFF1A${parsed.issues.join("\uFF1B")}`);
      if (!parsed.hasManagedBlock) throw new Error("\u627E\u4E0D\u5230\u65E7\u4EFB\u52A1\u7BA1\u7406\u533A");
      const data = additionalData ? mergeWithoutConflicts2(parsed.data, additionalData) : parsed.data;
      const range = findManagedRange(content);
      const newline = detectNewline(content);
      const block = renderBoardCodeBlock2(boardId, data, newline);
      return {
        content: `${content.slice(0, range.start)}${block}${content.slice(range.end)}`,
        data
      };
    }
    function appendBoardCodeBlock2(content, boardId, data) {
      const newline = detectNewline(content);
      const block = renderBoardCodeBlock2(boardId, data, newline);
      if (!content) return `${block}${newline}`;
      const separator = content.endsWith(newline) ? newline : `${newline}${newline}`;
      return `${content}${separator}${block}${newline}`;
    }
    function mergeWithoutConflicts2(primary, additional) {
      const merged = cloneData2(primary);
      const byId = new Map(merged.tasks.map((task) => [task.id, task]));
      for (const task of normalizeData2(additional).tasks) {
        const existing = byId.get(task.id);
        if (existing && JSON.stringify(existing) !== JSON.stringify(task)) {
          throw new Error(`\u4EFB\u52A1 ${task.id} \u5728\u4E24\u4EFD\u6570\u636E\u4E2D\u7684\u5185\u5BB9\u4E0D\u540C`);
        }
        if (!existing) {
          const copy = { ...task };
          merged.tasks.push(copy);
          byId.set(copy.id, copy);
        }
      }
      return merged;
    }
    module2.exports = {
      BOARD_LANGUAGE: BOARD_LANGUAGE2,
      appendBoardCodeBlock: appendBoardCodeBlock2,
      createBoardId: createBoardId2,
      findBoardCodeBlocks: findBoardCodeBlocks2,
      mergeWithoutConflicts: mergeWithoutConflicts2,
      mutateBoardDocument: mutateBoardDocument2,
      parseBoardSource: parseBoardSource2,
      readBoardFromDocument: readBoardFromDocument2,
      renderBoardCodeBlock: renderBoardCodeBlock2,
      renderBoardSource,
      replaceLegacyManagedBlock: replaceLegacyManagedBlock2
    };
  }
});

// src/main.js
var {
  MarkdownRenderChild,
  MarkdownView,
  Menu,
  Modal,
  Notice,
  Plugin,
  TFile,
  normalizePath,
  setIcon
} = require("obsidian");
var {
  QUADRANTS,
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
  restoreTask
} = require_core();
var {
  BOARD_LANGUAGE,
  appendBoardCodeBlock,
  createBoardId,
  findBoardCodeBlocks,
  mergeWithoutConflicts,
  mutateBoardDocument,
  parseBoardSource,
  readBoardFromDocument,
  renderBoardCodeBlock,
  replaceLegacyManagedBlock
} = require_board_store();
var { parseTaskMarkdown } = require_markdown_store();
var SETTINGS_VERSION = 2;
var DEFAULT_MIGRATION_PATH = "Quadrant Tasks.md";
var LEGACY_BOARD_ID = "board-migrated-global";
var LEGACY_JSON_BACKUP = "data-backup-1.0.0.json";
var LEGACY_NOTE_BACKUP = "global-note-backup-1.1.0.md";
var LEGACY_VIEW_TYPE = "quadrant-tasks-view";
var QUADRANT_META = {
  do: { action: "\u7ACB\u5373\u505A", description: "\u91CD\u8981\u4E14\u7D27\u6025", icon: "zap" },
  schedule: { action: "\u5B89\u6392", description: "\u91CD\u8981\u4E0D\u7D27\u6025", icon: "calendar-clock" },
  delegate: { action: "\u59D4\u6D3E", description: "\u7D27\u6025\u4E0D\u91CD\u8981", icon: "users" },
  eliminate: { action: "\u820D\u5F03", description: "\u4E0D\u91CD\u8981\u4E0D\u7D27\u6025", icon: "archive" }
};
var PERIODS = [
  { id: "all", label: "\u5168\u90E8" },
  { id: "today", label: "\u4ECA\u5929" },
  { id: "7d", label: "\u8FD1 7 \u5929" },
  { id: "30d", label: "\u8FD1 30 \u5929" },
  { id: "custom", label: "\u81EA\u5B9A\u4E49" }
];
function cloneData(data) {
  return normalizeData(JSON.parse(JSON.stringify(data)));
}
function createIconButton(parent, icon, label, onClick, className = "") {
  const button = parent.createEl("button", {
    cls: `clickable-icon qt-icon-button ${className}`.trim(),
    attr: { "aria-label": label, type: "button" }
  });
  setIcon(button, icon);
  button.addEventListener("click", onClick);
  return button;
}
function formatCompletedAt(value) {
  return new Intl.DateTimeFormat(void 0, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
var TaskTitleModal = class extends Modal {
  constructor(app, title, onSave) {
    super(app);
    this.title = title;
    this.onSave = onSave;
  }
  onOpen() {
    this.setTitle("\u7F16\u8F91\u4EFB\u52A1");
    const input = this.contentEl.createEl("input", {
      cls: "qt-modal-input",
      attr: { type: "text", value: this.title, "aria-label": "\u4EFB\u52A1\u5185\u5BB9" }
    });
    const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
    const cancel = actions.createEl("button", { text: "\u53D6\u6D88" });
    const save = actions.createEl("button", { text: "\u4FDD\u5B58", cls: "mod-cta" });
    const submit = () => {
      const value = input.value.trim();
      if (!value) {
        input.addClass("qt-input-error");
        return;
      }
      this.onSave(value);
      this.close();
    };
    input.addEventListener("input", () => input.removeClass("qt-input-error"));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.isComposing) submit();
    });
    cancel.addEventListener("click", () => this.close());
    save.addEventListener("click", submit);
    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};
var QuadrantBoardRenderChild = class extends MarkdownRenderChild {
  constructor(containerEl, plugin, sourcePath, source) {
    super(containerEl);
    this.plugin = plugin;
    this.sourcePath = sourcePath;
    const parsed = parseBoardSource(source);
    this.boardId = parsed.boardId;
    this.data = parsed.data;
    this.issues = parsed.issues;
    this.filters = { quadrant: "all", period: "all", startDate: "", endDate: "" };
    this.draggedTaskId = null;
  }
  onload() {
    this.plugin.boardRenderers.add(this);
    this.render();
  }
  onunload() {
    this.plugin.boardRenderers.delete(this);
  }
  setBoardData(data) {
    this.data = cloneData(data);
    this.issues = [];
    this.render();
  }
  setBoardError(error) {
    this.issues = [error.message || String(error)];
    this.render();
  }
  async mutate(mutator) {
    if (!this.boardId || this.issues.length) return null;
    const outcome = await this.plugin.mutateBoard(this.sourcePath, this.boardId, mutator);
    return (outcome == null ? void 0 : outcome.result) || null;
  }
  render() {
    const container = this.containerEl;
    container.empty();
    container.addClass("qt-root", "qt-embed");
    if (!this.boardId || this.issues.length) {
      container.createDiv({
        cls: "qt-storage-error",
        text: this.issues.join("\uFF1B") || "\u56DB\u8C61\u9650\u4EE3\u7801\u5757\u7F3A\u5C11 board-id"
      });
      return;
    }
    this.renderHeader(container);
    const matrix = container.createDiv({ cls: "qt-matrix" });
    for (const quadrant of QUADRANTS) this.renderQuadrant(matrix, quadrant);
    this.renderCompleted(container);
  }
  renderHeader(container) {
    const header = container.createEl("header", { cls: "qt-page-header" });
    const titleGroup = header.createDiv({ cls: "qt-title-group" });
    titleGroup.createEl("h3", { text: "\u56DB\u8C61\u9650\u4EFB\u52A1" });
    const stats = titleGroup.createDiv({ cls: "qt-stats", attr: { "aria-live": "polite" } });
    stats.createSpan({ text: `${getActiveTasks(this.data).length} \u9879\u8FDB\u884C\u4E2D` });
    stats.createSpan({ text: `${getCompletedTasks(this.data).length} \u9879\u5DF2\u5B8C\u6210` });
  }
  renderQuadrant(matrix, quadrant) {
    const meta = QUADRANT_META[quadrant];
    const tasks = getActiveTasks(this.data, quadrant);
    const section = matrix.createEl("section", {
      cls: `qt-quadrant qt-quadrant-${quadrant}`,
      attr: { "data-quadrant": quadrant, "aria-label": `${meta.action}\uFF0C${meta.description}` }
    });
    const header = section.createEl("header", { cls: "qt-quadrant-header" });
    const heading = header.createDiv({ cls: "qt-quadrant-heading" });
    const icon = heading.createSpan({ cls: "qt-quadrant-icon", attr: { "aria-hidden": "true" } });
    setIcon(icon, meta.icon);
    const labels = heading.createDiv();
    const title = labels.createEl("h3", { text: meta.action });
    title.createSpan({ text: String(tasks.length), cls: "qt-count" });
    labels.createDiv({ text: meta.description, cls: "qt-quadrant-description" });
    const quickAdd = section.createDiv({ cls: "qt-quick-add" });
    const input = quickAdd.createEl("input", {
      attr: { type: "text", placeholder: "\u6DFB\u52A0\u4EFB\u52A1", "aria-label": `\u6DFB\u52A0\u5230${meta.action}` }
    });
    const submit = async () => {
      const titleText = input.value.trim();
      if (!titleText) {
        input.addClass("qt-input-error");
        return;
      }
      const task = await this.mutate((data) => addTask(data, titleText, quadrant));
      if (task) input.value = "";
    };
    input.addEventListener("input", () => input.removeClass("qt-input-error"));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.isComposing) void submit();
    });
    createIconButton(quickAdd, "plus", `\u6DFB\u52A0\u5230${meta.action}`, () => void submit(), "qt-add-button");
    const list = section.createEl("ul", { cls: "qt-task-list" });
    if (tasks.length === 0) list.createEl("li", { text: "\u6682\u65E0\u4EFB\u52A1", cls: "qt-empty" });
    else for (const task of tasks) this.renderActiveTask(list, task);
    section.addEventListener("dragover", (event) => {
      if (!this.draggedTaskId) return;
      event.preventDefault();
      section.addClass("qt-drop-target");
    });
    section.addEventListener("dragleave", (event) => {
      if (!section.contains(event.relatedTarget)) section.removeClass("qt-drop-target");
    });
    section.addEventListener("drop", (event) => {
      var _a;
      event.preventDefault();
      section.removeClass("qt-drop-target");
      const taskId = ((_a = event.dataTransfer) == null ? void 0 : _a.getData("text/plain")) || this.draggedTaskId;
      this.draggedTaskId = null;
      if (taskId) void this.mutate((data) => moveTask(data, taskId, quadrant));
    });
  }
  renderActiveTask(list, task) {
    const row = list.createEl("li", {
      cls: "qt-task-row",
      attr: { draggable: "true", "data-task-id": task.id }
    });
    const checkbox = row.createEl("input", {
      cls: "qt-task-checkbox",
      attr: { type: "checkbox", "aria-label": `\u5B8C\u6210\u4EFB\u52A1\uFF1A${task.title}` }
    });
    checkbox.addEventListener("change", () => void this.complete(task.id));
    const title = row.createEl("button", {
      text: task.title,
      cls: "qt-task-title",
      attr: { type: "button", title: "\u7F16\u8F91\u4EFB\u52A1" }
    });
    title.addEventListener("click", () => this.openEditor(task));
    createIconButton(row, "more-horizontal", "\u66F4\u591A\u64CD\u4F5C", (event) => this.openTaskMenu(event, task));
    row.addEventListener("dragstart", (event) => {
      var _a;
      this.draggedTaskId = task.id;
      row.addClass("qt-dragging");
      (_a = event.dataTransfer) == null ? void 0 : _a.setData("text/plain", task.id);
    });
    row.addEventListener("dragend", () => {
      this.draggedTaskId = null;
      row.removeClass("qt-dragging");
      this.containerEl.querySelectorAll(".qt-drop-target").forEach((element) => element.removeClass("qt-drop-target"));
    });
  }
  openEditor(task) {
    new TaskTitleModal(this.plugin.app, task.title, (title) => {
      void this.mutate((data) => editTask(data, task.id, title));
    }).open();
  }
  openTaskMenu(event, task) {
    const menu = new Menu();
    menu.addItem((item) => item.setTitle("\u7F16\u8F91").setIcon("pencil").onClick(() => this.openEditor(task)));
    for (const quadrant of QUADRANTS) {
      const meta = QUADRANT_META[quadrant];
      menu.addItem((item) => {
        item.setTitle(`\u79FB\u81F3\uFF1A${meta.action}`).setIcon(meta.icon).setDisabled(task.quadrant === quadrant);
        item.onClick(() => void this.mutate((data) => moveTask(data, task.id, quadrant)));
      });
    }
    menu.addSeparator();
    menu.addItem(
      (item) => item.setTitle("\u5220\u9664").setIcon("trash-2").setWarning(true).onClick(() => void this.remove(task.id))
    );
    menu.showAtMouseEvent(event);
  }
  async complete(taskId) {
    const task = await this.mutate((data) => completeTask(data, taskId));
    if (!task) return;
    this.plugin.showUndo("\u4EFB\u52A1\u5DF2\u5B8C\u6210", () => this.mutate((data) => restoreTask(data, taskId)));
  }
  async restore(taskId) {
    const task = await this.mutate((data) => restoreTask(data, taskId));
    if (!task) return;
    this.plugin.showUndo("\u4EFB\u52A1\u5DF2\u6062\u590D", () => this.mutate((data) => completeTask(data, taskId)));
  }
  async remove(taskId) {
    const deleted = await this.mutate((data) => deleteTask(data, taskId));
    if (!deleted) return;
    this.plugin.showUndo("\u4EFB\u52A1\u5DF2\u5220\u9664", () => this.mutate((data) => restoreDeletedTask(data, deleted)));
  }
  renderCompleted(container) {
    const section = container.createEl("section", { cls: "qt-completed-section" });
    const header = section.createEl("header", { cls: "qt-completed-header" });
    const titleGroup = header.createDiv();
    titleGroup.createEl("h3", { text: "\u5DF2\u5B8C\u6210" });
    const allCompleted = getCompletedTasks(this.data);
    const bounds = completionBounds(this.filters);
    const tasks = getCompletedTasks(this.data, this.filters);
    titleGroup.createSpan({
      text: `${tasks.length} / ${allCompleted.length}`,
      cls: "qt-completed-count",
      attr: { "aria-live": "polite" }
    });
    const controls = section.createDiv({ cls: "qt-filters" });
    const quadrantSelect = controls.createEl("select", { attr: { "aria-label": "\u6309\u6765\u6E90\u8C61\u9650\u7B5B\u9009" } });
    quadrantSelect.createEl("option", { text: "\u5168\u90E8\u8C61\u9650", value: "all" });
    for (const quadrant of QUADRANTS) {
      quadrantSelect.createEl("option", { text: QUADRANT_META[quadrant].action, value: quadrant });
    }
    quadrantSelect.value = this.filters.quadrant;
    quadrantSelect.addEventListener("change", () => {
      this.filters.quadrant = quadrantSelect.value;
      this.render();
    });
    const periods = controls.createDiv({ cls: "qt-periods", attr: { role: "group", "aria-label": "\u5B8C\u6210\u65F6\u95F4" } });
    for (const period of PERIODS) {
      const button = periods.createEl("button", {
        text: period.label,
        cls: this.filters.period === period.id ? "is-active" : "",
        attr: { type: "button", "aria-pressed": String(this.filters.period === period.id) }
      });
      button.addEventListener("click", () => {
        this.filters.period = period.id;
        this.render();
      });
    }
    if (this.filters.period === "custom") this.renderCustomRange(controls);
    const list = section.createEl("ul", { cls: "qt-completed-list" });
    if (!bounds.valid) {
      list.createEl("li", { text: "\u5F00\u59CB\u65E5\u671F\u4E0D\u80FD\u665A\u4E8E\u7ED3\u675F\u65E5\u671F", cls: "qt-empty qt-filter-error" });
    } else if (tasks.length === 0) {
      list.createEl("li", {
        text: allCompleted.length === 0 ? "\u8FD8\u6CA1\u6709\u5DF2\u5B8C\u6210\u7684\u4EFB\u52A1" : "\u6CA1\u6709\u7B26\u5408\u7B5B\u9009\u6761\u4EF6\u7684\u4EFB\u52A1",
        cls: "qt-empty"
      });
    } else {
      for (const task of tasks) this.renderCompletedTask(list, task);
    }
  }
  renderCustomRange(controls) {
    const range = controls.createDiv({ cls: "qt-custom-range" });
    const start = range.createEl("input", { attr: { type: "date", "aria-label": "\u5B8C\u6210\u65F6\u95F4\u8D77\u59CB\u65E5\u671F" } });
    start.value = this.filters.startDate;
    range.createSpan({ text: "\u81F3" });
    const end = range.createEl("input", { attr: { type: "date", "aria-label": "\u5B8C\u6210\u65F6\u95F4\u7ED3\u675F\u65E5\u671F" } });
    end.value = this.filters.endDate;
    start.addEventListener("change", () => {
      this.filters.startDate = start.value;
      this.render();
    });
    end.addEventListener("change", () => {
      this.filters.endDate = end.value;
      this.render();
    });
  }
  renderCompletedTask(list, task) {
    const row = list.createEl("li", { cls: "qt-completed-row" });
    const checkbox = row.createEl("input", {
      cls: "qt-task-checkbox",
      attr: { type: "checkbox", "aria-label": `\u6062\u590D\u4EFB\u52A1\uFF1A${task.title}` }
    });
    checkbox.checked = true;
    checkbox.addEventListener("change", () => void this.restore(task.id));
    const content = row.createDiv({ cls: "qt-completed-content" });
    content.createDiv({ text: task.title, cls: "qt-completed-title" });
    const metadata = content.createDiv({ cls: "qt-completed-meta" });
    metadata.createSpan({ text: QUADRANT_META[task.quadrant].action, cls: `qt-badge qt-badge-${task.quadrant}` });
    metadata.createEl("time", { text: formatCompletedAt(task.completedAt), attr: { datetime: task.completedAt } });
    createIconButton(row, "trash-2", "\u5220\u9664\u4EFB\u52A1", () => void this.remove(task.id));
  }
};
var QuadrantTasksPlugin = class extends Plugin {
  async onload() {
    this.boardRenderers = /* @__PURE__ */ new Set();
    this.fileQueues = /* @__PURE__ */ new Map();
    this.refreshTimers = /* @__PURE__ */ new Map();
    this.registerMarkdownCodeBlockProcessor(BOARD_LANGUAGE, (source, element, context) => {
      context.addChild(new QuadrantBoardRenderChild(element, this, context.sourcePath, source));
    });
    this.addCommand({
      id: "insert-quadrant-board",
      name: "\u5728\u5F53\u524D\u5149\u6807\u5904\u63D2\u5165\u56DB\u8C61\u9650",
      editorCallback: (editor) => this.insertBoard(editor)
    });
    this.addRibbonIcon("layout-grid", "\u63D2\u5165\u56DB\u8C61\u9650", () => this.insertBoardIntoActiveNote());
    this.registerVaultEvents();
    this.app.workspace.onLayoutReady(() => {
      this.app.workspace.detachLeavesOfType(LEGACY_VIEW_TYPE);
      void this.migrateLegacyStorage();
    });
  }
  onunload() {
    for (const timer of this.refreshTimers.values()) window.clearTimeout(timer);
    this.refreshTimers.clear();
  }
  insertBoard(editor) {
    const boardId = createBoardId();
    const block = renderBoardCodeBlock(boardId, createEmptyData());
    const cursor = editor.getCursor("to");
    const line = editor.getLine(cursor.line);
    const prefix = cursor.ch === 0 && !line ? "" : "\n\n";
    const suffix = line.slice(cursor.ch).trim() ? "\n\n" : "\n";
    const inserted = `${prefix}${block}${suffix}`;
    editor.replaceRange(inserted, cursor);
    if (typeof editor.setCursor === "function") {
      const insertedLines = inserted.split("\n");
      editor.setCursor({
        line: cursor.line + insertedLines.length - 1,
        ch: insertedLines[insertedLines.length - 1].length
      });
    }
    new Notice("\u5DF2\u63D2\u5165\u72EC\u7ACB\u56DB\u8C61\u9650");
  }
  insertBoardIntoActiveNote() {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!(view == null ? void 0 : view.editor)) {
      new Notice("\u8BF7\u5148\u6253\u5F00\u4E00\u4E2A\u53EF\u7F16\u8F91\u7684 Markdown \u6587\u4EF6");
      return;
    }
    this.insertBoard(view.editor);
  }
  async mutateBoard(sourcePath, boardId, mutator) {
    const file = this.app.vault.getAbstractFileByPath(sourcePath);
    if (!(file instanceof TFile)) {
      new Notice("\u627E\u4E0D\u5230\u8FD9\u5F20\u56DB\u8C61\u9650\u6240\u5728\u7684 Markdown \u6587\u4EF6");
      return null;
    }
    let outcome = null;
    const previous = this.fileQueues.get(file) || Promise.resolve();
    const pending = previous.catch(() => void 0).then(
      () => this.app.vault.process(file, (content) => {
        outcome = mutateBoardDocument(content, boardId, mutator);
        return outcome.content;
      })
    );
    this.fileQueues.set(file, pending);
    try {
      await pending;
      if (this.fileQueues.get(file) === pending) this.fileQueues.delete(file);
      if (outcome) this.refreshBoardRenderers(sourcePath, boardId, outcome.data);
      return outcome;
    } catch (error) {
      if (this.fileQueues.get(file) === pending) this.fileQueues.delete(file);
      console.error("Quadrant Tasks failed to update a local board", error);
      new Notice(`\u56DB\u8C61\u9650\u4FDD\u5B58\u5931\u8D25\uFF1A${error.message}`, 1e4);
      await this.refreshFileRenderers(sourcePath);
      return null;
    }
  }
  refreshBoardRenderers(sourcePath, boardId, data) {
    for (const renderer of this.boardRenderers) {
      if (renderer.sourcePath === sourcePath && renderer.boardId === boardId) renderer.setBoardData(data);
    }
  }
  async refreshFileRenderers(sourcePath) {
    const renderers = [...this.boardRenderers].filter((renderer) => renderer.sourcePath === sourcePath);
    if (!renderers.length) return;
    const file = this.app.vault.getAbstractFileByPath(sourcePath);
    if (!(file instanceof TFile)) {
      for (const renderer of renderers) renderer.setBoardError(new Error("\u6240\u5728\u7684 Markdown \u6587\u4EF6\u4E0D\u53EF\u7528"));
      return;
    }
    await (this.fileQueues.get(file) || Promise.resolve()).catch(() => void 0);
    try {
      const content = await this.app.vault.read(file);
      for (const renderer of renderers) {
        try {
          renderer.setBoardData(readBoardFromDocument(content, renderer.boardId).data);
        } catch (error) {
          renderer.setBoardError(error);
        }
      }
    } catch (error) {
      for (const renderer of renderers) renderer.setBoardError(error);
    }
  }
  scheduleFileRefresh(sourcePath) {
    if (![...this.boardRenderers].some((renderer) => renderer.sourcePath === sourcePath)) return;
    const existing = this.refreshTimers.get(sourcePath);
    if (existing) window.clearTimeout(existing);
    const timer = window.setTimeout(() => {
      this.refreshTimers.delete(sourcePath);
      void this.refreshFileRenderers(sourcePath);
    }, 120);
    this.refreshTimers.set(sourcePath, timer);
  }
  registerVaultEvents() {
    this.registerEvent(this.app.vault.on("modify", (file) => this.scheduleFileRefresh(file.path)));
    this.registerEvent(this.app.vault.on("delete", (file) => this.scheduleFileRefresh(file.path)));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
      for (const renderer of this.boardRenderers) {
        if (renderer.sourcePath === oldPath) renderer.sourcePath = file.path;
      }
      this.scheduleFileRefresh(file.path);
    }));
  }
  async migrateLegacyStorage() {
    var _a;
    const raw = await this.loadData();
    if ((raw == null ? void 0 : raw.settingsVersion) === SETTINGS_VERSION) return;
    if (!raw) {
      await this.saveData({ settingsVersion: SETTINGS_VERSION });
      return;
    }
    try {
      const legacyJson = Array.isArray(raw.tasks) ? normalizeData(raw) : null;
      let expectedData = legacyJson;
      const sourcePath = normalizePath(raw.taskFilePath || DEFAULT_MIGRATION_PATH);
      let jsonBackup = ((_a = raw.migration) == null ? void 0 : _a.backupFile) || null;
      if (legacyJson) jsonBackup = await this.backupLegacyJson(raw);
      let file = this.app.vault.getAbstractFileByPath(sourcePath);
      if (!(file instanceof TFile)) {
        if (!legacyJson) throw new Error(`\u627E\u4E0D\u5230\u65E7\u4EFB\u52A1\u6587\u4EF6\uFF1A${sourcePath}`);
        file = await this.app.vault.create(
          sourcePath,
          `# Quadrant Tasks

${renderBoardCodeBlock(LEGACY_BOARD_ID, legacyJson)}
`
        );
      } else {
        const before = await this.app.vault.read(file);
        const legacyParsed = parseTaskMarkdown(before);
        if (legacyParsed.hasManagedBlock) await this.backupLegacyNote(before);
        await this.app.vault.process(file, (content) => {
          const parsed = parseTaskMarkdown(content);
          if (parsed.issues.length) throw new Error(`\u65E7\u4EFB\u52A1\u5185\u5BB9\u5F02\u5E38\uFF1A${parsed.issues.join("\uFF1B")}`);
          if (parsed.hasManagedBlock) {
            const replaced = replaceLegacyManagedBlock(content, LEGACY_BOARD_ID, legacyJson);
            expectedData = replaced.data;
            return replaced.content;
          }
          const existing = findBoardCodeBlocks(content).filter((board) => board.boardId === LEGACY_BOARD_ID);
          if (existing.length === 1) {
            if (!legacyJson) {
              expectedData = readBoardFromDocument(content, LEGACY_BOARD_ID).data;
              return content;
            }
            return mutateBoardDocument(content, LEGACY_BOARD_ID, (draft) => {
              const merged = mergeWithoutConflicts(draft, legacyJson);
              draft.tasks = merged.tasks;
              expectedData = merged;
              return true;
            }).content;
          }
          if (existing.length > 1) throw new Error(`\u540C\u4E00\u6587\u4EF6\u4E2D\u5B58\u5728\u91CD\u590D\u7684 board-id\uFF1A${LEGACY_BOARD_ID}`);
          if (legacyJson) {
            expectedData = legacyJson;
            return appendBoardCodeBlock(content, LEGACY_BOARD_ID, legacyJson);
          }
          if (findBoardCodeBlocks(content).length) return content;
          throw new Error("\u65E7\u4EFB\u52A1\u6587\u4EF6\u4E2D\u6CA1\u6709\u53EF\u8FC1\u79FB\u7684\u6570\u636E");
        });
      }
      const verifiedContent = await this.app.vault.read(file);
      const migrated = readBoardFromDocument(verifiedContent, LEGACY_BOARD_ID).data;
      if (!expectedData) throw new Error("\u8FC1\u79FB\u6821\u9A8C\u5931\u8D25\uFF1A\u7F3A\u5C11\u9884\u671F\u4EFB\u52A1\u6570\u636E");
      if (expectedData.tasks.length !== migrated.tasks.length) throw new Error("\u8FC1\u79FB\u6821\u9A8C\u5931\u8D25\uFF1A\u4EFB\u52A1\u6570\u91CF\u4E0D\u4E00\u81F4");
      const migratedById = new Map(migrated.tasks.map((task) => [task.id, task]));
      if (expectedData.tasks.some((task) => JSON.stringify(migratedById.get(task.id)) !== JSON.stringify(task))) {
        throw new Error("\u8FC1\u79FB\u6821\u9A8C\u5931\u8D25\uFF1A\u4EFB\u52A1\u5185\u5BB9\u4E0D\u4E00\u81F4");
      }
      await this.saveData({
        settingsVersion: SETTINGS_VERSION,
        migration: {
          fromVersion: Array.isArray(raw.tasks) ? "1.0.0" : "1.1.0",
          completedAt: (/* @__PURE__ */ new Date()).toISOString(),
          sourcePath,
          boardId: LEGACY_BOARD_ID,
          jsonBackup
        }
      });
      new Notice("\u65E7\u7684\u5168\u5C40\u4EFB\u52A1\u5DF2\u8FC1\u79FB\u4E3A Markdown \u6587\u4EF6\u4E2D\u7684\u72EC\u7ACB\u56DB\u8C61\u9650", 1e4);
    } catch (error) {
      console.error("Quadrant Tasks could not migrate global storage", error);
      new Notice(`\u65E7\u4EFB\u52A1\u8FC1\u79FB\u5931\u8D25\uFF1A${error.message}`, 12e3);
    }
  }
  async backupLegacyJson(raw) {
    if (!this.manifest.dir) throw new Error("\u63D2\u4EF6\u76EE\u5F55\u4E0D\u53EF\u7528\uFF0C\u65E0\u6CD5\u5907\u4EFD\u65E7\u6570\u636E");
    return this.writeVersionedBackup(LEGACY_JSON_BACKUP, `${JSON.stringify(raw, null, 2)}
`);
  }
  async backupLegacyNote(content) {
    if (!this.manifest.dir) throw new Error("\u63D2\u4EF6\u76EE\u5F55\u4E0D\u53EF\u7528\uFF0C\u65E0\u6CD5\u5907\u4EFD\u65E7\u4EFB\u52A1\u6587\u4EF6");
    return this.writeVersionedBackup(LEGACY_NOTE_BACKUP, content);
  }
  async writeVersionedBackup(fileName, content) {
    const adapter = this.app.vault.adapter;
    let candidate = fileName;
    let path = normalizePath(`${this.manifest.dir}/${candidate}`);
    if (await adapter.exists(path)) {
      if (await adapter.read(path) === content) return candidate;
      const extensionIndex = fileName.lastIndexOf(".");
      candidate = `${fileName.slice(0, extensionIndex)}-${Date.now()}${fileName.slice(extensionIndex)}`;
      path = normalizePath(`${this.manifest.dir}/${candidate}`);
    }
    await adapter.write(path, content);
    return candidate;
  }
  showUndo(message, onUndo) {
    const fragment = document.createDocumentFragment();
    fragment.append(document.createTextNode(`${message} `));
    const button = document.createElement("button");
    button.className = "qt-undo-button";
    button.textContent = "\u64A4\u9500";
    fragment.append(button);
    const notice = new Notice(fragment, 6e3);
    button.addEventListener("click", async () => {
      if (await onUndo()) notice.hide();
    });
  }
};
module.exports = QuadrantTasksPlugin;
