"use strict";
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// src/task-details.js
var require_task_details = __commonJS({
  "src/task-details.js"(exports2, module2) {
    "use strict";
    var DAY_MS = 24 * 60 * 60 * 1e3;
    function calendarDay(year, month, day) {
      const value = /* @__PURE__ */ new Date(0);
      value.setUTCFullYear(year, month - 1, day);
      return value;
    }
    function normalizeDueDate(value) {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
      const [year, month, day] = value.split("-").map(Number);
      if (year < 1) return null;
      const parsed = calendarDay(year, month, day);
      return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day ? value : null;
    }
    function getDueDateInfo(dueDate, completedAt, now = /* @__PURE__ */ new Date()) {
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
    module2.exports = { getDueDateInfo, getDueDateTone, normalizeDueDate, normalizeDueTime };
  }
});

// src/task-tags.js
var require_task_tags = __commonJS({
  "src/task-tags.js"(exports2, module2) {
    "use strict";
    function isValidTags(value) {
      return Array.isArray(value) && value.every((tag) => typeof tag === "string");
    }
    function normalizeTag(value) {
      return value.trim().replace(/^#+/, "").trim().normalize("NFC");
    }
    function normalizeTags(value) {
      if (!isValidTags(value)) return [];
      return [...new Set(value.map(normalizeTag).filter(Boolean))];
    }
    function getTagColorIndex(value) {
      const tag = typeof value === "string" ? normalizeTag(value) : "";
      let hash = 2166136261;
      for (let index = 0; index < tag.length; index += 1) {
        hash = Math.imul(hash ^ tag.charCodeAt(index), 16777619) >>> 0;
      }
      return hash % 8;
    }
    module2.exports = { getTagColorIndex, isValidTags, normalizeTags };
  }
});

// src/core.js
var require_core = __commonJS({
  "src/core.js"(exports2, module2) {
    "use strict";
    var { normalizeDueDate, normalizeDueTime } = require_task_details();
    var { isValidTags, normalizeTags } = require_task_tags();
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
          order: Number.isFinite(candidate.order) ? candidate.order : tasks.length,
          dueDate: normalizeDueDate(candidate.dueDate),
          dueTime: normalizeDueDate(candidate.dueDate) ? normalizeDueTime(candidate.dueTime) : null,
          notes: typeof candidate.notes === "string" ? candidate.notes : "",
          tags: normalizeTags(candidate.tags)
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
      var _a;
      const normalizedTitle = typeof title === "string" ? title.trim() : "";
      if (!normalizedTitle) throw new Error("Task title is required");
      if (!isQuadrant(quadrant)) throw new Error("Invalid quadrant");
      if (options.dueDate != null && options.dueDate !== "" && !normalizeDueDate(options.dueDate)) {
        throw new Error("Invalid due date");
      }
      if (options.notes != null && typeof options.notes !== "string") throw new Error("Invalid notes");
      if (options.dueTime != null && options.dueTime !== "" && (!normalizeDueTime(options.dueTime) || !normalizeDueDate(options.dueDate))) {
        throw new Error("Invalid due time or missing due date");
      }
      if (Object.prototype.hasOwnProperty.call(options, "tags") && !isValidTags(options.tags)) throw new Error("Invalid tags");
      const now = options.now instanceof Date ? options.now : /* @__PURE__ */ new Date();
      const idFactory = options.idFactory || defaultIdFactory;
      const existingTasks = getActiveTasks2(data, quadrant);
      const task = {
        id: idFactory(),
        title: normalizedTitle,
        quadrant,
        createdAt: now.toISOString(),
        completedAt: null,
        order: 0,
        dueDate: normalizeDueDate(options.dueDate),
        dueTime: normalizeDueTime(options.dueTime),
        notes: (_a = options.notes) != null ? _a : "",
        tags: normalizeTags(options.tags)
      };
      data.tasks.push(task);
      setTaskOrder([task, ...existingTasks]);
      return task;
    }
    function editTask2(data, taskId, title, details = {}) {
      var _a;
      const normalizedTitle = typeof title === "string" ? title.trim() : "";
      if (!normalizedTitle) return null;
      if (details.dueDate != null && details.dueDate !== "" && !normalizeDueDate(details.dueDate)) return null;
      if (details.notes != null && typeof details.notes !== "string") return null;
      if (details.dueTime != null && details.dueTime !== "" && !normalizeDueTime(details.dueTime)) return null;
      if (Object.prototype.hasOwnProperty.call(details, "tags") && !isValidTags(details.tags)) return null;
      const task = data.tasks.find((item) => item.id === taskId);
      if (!task) return null;
      const hasDueDate = Object.prototype.hasOwnProperty.call(details, "dueDate");
      const dueDate = hasDueDate ? normalizeDueDate(details.dueDate) : task.dueDate;
      if (!dueDate && !hasDueDate && normalizeDueTime(details.dueTime)) return null;
      task.title = normalizedTitle;
      if (hasDueDate) task.dueDate = dueDate;
      if (!dueDate) task.dueTime = null;
      else if (Object.prototype.hasOwnProperty.call(details, "dueTime")) task.dueTime = normalizeDueTime(details.dueTime);
      if (Object.prototype.hasOwnProperty.call(details, "notes")) task.notes = (_a = details.notes) != null ? _a : "";
      if (Object.prototype.hasOwnProperty.call(details, "tags")) task.tags = normalizeTags(details.tags);
      return task;
    }
    function moveTask2(data, taskId, quadrant) {
      if (!isQuadrant(quadrant)) return null;
      const task = data.tasks.find((item) => item.id === taskId && !item.completedAt);
      if (!task) return null;
      if (task.quadrant !== quadrant) {
        const sourceQuadrant = task.quadrant;
        const destinationTasks = getActiveTasks2(data, quadrant);
        task.quadrant = quadrant;
        setTaskOrder(getActiveTasks2(data, sourceQuadrant));
        setTaskOrder([...destinationTasks, task]);
      }
      return task;
    }
    function reorderTask2(data, taskId, quadrant, targetTaskId = null, placement = "before") {
      if (!isQuadrant(quadrant) || !["before", "after"].includes(placement)) return null;
      const task = data.tasks.find((item) => item.id === taskId && !item.completedAt);
      if (!task) return null;
      if (targetTaskId === taskId) return task;
      const sourceQuadrant = task.quadrant;
      const destinationTasks = getActiveTasks2(data, quadrant).filter((item) => item.id !== taskId);
      let insertAt = destinationTasks.length;
      if (targetTaskId) {
        const targetIndex = destinationTasks.findIndex((item) => item.id === targetTaskId);
        if (targetIndex < 0) return null;
        insertAt = targetIndex + (placement === "after" ? 1 : 0);
      }
      task.quadrant = quadrant;
      destinationTasks.splice(insertAt, 0, task);
      if (sourceQuadrant !== quadrant) setTaskOrder(getActiveTasks2(data, sourceQuadrant));
      setTaskOrder(destinationTasks);
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
      const destinationTasks = getActiveTasks2(data, task.quadrant);
      task.completedAt = null;
      setTaskOrder([...destinationTasks, task]);
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
      addTask,
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
      reorderTask: reorderTask2,
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
    var { normalizeDueDate, normalizeDueTime } = require_task_details();
    var { isValidTags } = require_task_tags();
    var START_MARKER = "<!-- quadrant-tasks:start -->";
    var END_MARKER = "<!-- quadrant-tasks:end -->";
    var META_PREFIX = "<!-- quadrant-task ";
    var META_SUFFIX = " -->";
    var SECTION_TO_QUADRANT = {
      "## Important and urgent": "do",
      "## Do now": "do",
      "## \u7ACB\u5373\u505A": "do",
      "## \u91CD\u8981\u4E14\u7D27\u6025": "do",
      "## Important, not urgent": "schedule",
      "## Schedule": "schedule",
      "## \u5B89\u6392": "schedule",
      "## \u91CD\u8981\u4E0D\u7D27\u6025": "schedule",
      "## Urgent, not important": "delegate",
      "## Delegate": "delegate",
      "## \u59D4\u6D3E": "delegate",
      "## \u7D27\u6025\u4E0D\u91CD\u8981": "delegate",
      "## Neither important nor urgent": "eliminate",
      "## Eliminate": "eliminate",
      "## \u820D\u5F03": "eliminate",
      "## \u4E0D\u91CD\u8981\u4E0D\u7D27\u6025": "eliminate"
    };
    var QUADRANT_SECTIONS = [
      ["do", "Important and urgent"],
      ["schedule", "Important, not urgent"],
      ["delegate", "Urgent, not important"],
      ["eliminate", "Neither important nor urgent"]
    ];
    var COMPLETED_SECTIONS = /* @__PURE__ */ new Set(["## Completed", "## \u5DF2\u5B8C\u6210"]);
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
        order: Number.isFinite(metadata == null ? void 0 : metadata.order) ? metadata.order : options.fallbackOrder,
        dueDate: metadata == null ? void 0 : metadata.dueDate,
        dueTime: metadata == null ? void 0 : metadata.dueTime,
        notes: metadata == null ? void 0 : metadata.notes,
        tags: metadata == null ? void 0 : metadata.tags
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
        if (COMPLETED_SECTIONS.has(trimmed)) {
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
          if ((metadata == null ? void 0 : metadata.dueDate) != null && metadata.dueDate !== "" && !normalizeDueDate(metadata.dueDate)) {
            issues.push(`\u7B2C ${index + 1} \u884C\u7684\u4EFB\u52A1\u622A\u6B62\u65E5\u671F\u65E0\u6548`);
          }
          if ((metadata == null ? void 0 : metadata.notes) != null && typeof metadata.notes !== "string") {
            issues.push(`\u7B2C ${index + 1} \u884C\u7684\u4EFB\u52A1\u5907\u6CE8\u5FC5\u987B\u662F\u6587\u672C`);
          }
          if ((metadata == null ? void 0 : metadata.dueTime) != null && metadata.dueTime !== "" && (!normalizeDueTime(metadata.dueTime) || !normalizeDueDate(metadata.dueDate))) {
            issues.push(`\u7B2C ${index + 1} \u884C\u7684\u4EFB\u52A1\u622A\u6B62\u65F6\u95F4\u65E0\u6548\u6216\u7F3A\u5C11\u622A\u6B62\u65E5\u671F`);
          }
          if (metadata && Object.prototype.hasOwnProperty.call(metadata, "tags") && !isValidTags(metadata.tags)) {
            issues.push(`\u7B2C ${index + 1} \u884C\u7684\u4EFB\u52A1\u6807\u7B7E\u5FC5\u987B\u662F\u6587\u672C\u6570\u7EC4`);
          }
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
      const metadata = {
        id: task.id,
        quadrant: task.quadrant,
        createdAt: task.createdAt,
        completedAt: task.completedAt || null,
        order: task.order
      };
      if (task.dueDate) metadata.dueDate = task.dueDate;
      if (task.dueTime) metadata.dueTime = task.dueTime;
      if (task.notes) metadata.notes = task.notes;
      if (task.tags.length) metadata.tags = task.tags;
      const json = JSON.stringify(metadata).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
      return `${META_PREFIX}${json}${META_SUFFIX}`;
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
      lines.push("## Completed");
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
    var { QUADRANTS: QUADRANTS2, normalizeData: normalizeData2 } = require_core();
    var {
      END_MARKER,
      START_MARKER,
      detectNewline,
      findManagedRange,
      parseTaskMarkdown: parseTaskMarkdown2,
      renderManagedBlock
    } = require_markdown_store();
    var BOARD_LANGUAGE = "eisenhower-matrix-blocks";
    var LEGACY_BOARD_LANGUAGE = "quadrant-tasks";
    var BOARD_LANGUAGES2 = Object.freeze([BOARD_LANGUAGE, LEGACY_BOARD_LANGUAGE]);
    var DEFAULT_BOARD_TITLE2 = "Matrix";
    var BOARD_META_PREFIX = "<!-- quadrant-board ";
    var BOARD_META_SUFFIX = " -->";
    var BOARD_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{2,127}$/;
    var MAX_BOARD_TITLE_LENGTH = 120;
    var MAX_QUADRANT_TITLE_LENGTH = 120;
    var MAX_QUADRANT_SUBTITLE_LENGTH = 160;
    function createBoardId2() {
      if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
        return `board-${globalThis.crypto.randomUUID()}`;
      }
      return `board-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
    }
    function cloneData2(data) {
      return normalizeData2(JSON.parse(JSON.stringify(data)));
    }
    function normalizeBoardTitle(value, fallback = DEFAULT_BOARD_TITLE2) {
      if (value === void 0) return fallback;
      if (typeof value !== "string") return null;
      const title = value.trim();
      if (!title || title.length > MAX_BOARD_TITLE_LENGTH) return null;
      return title;
    }
    function normalizeQuadrantLabels(value) {
      if (value === void 0) return {};
      if (!value || typeof value !== "object" || Array.isArray(value)) return null;
      if (Object.keys(value).some((quadrant) => !QUADRANTS2.includes(quadrant))) return null;
      const normalized = {};
      for (const quadrant of QUADRANTS2) {
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
    function parseBoardSource2(source, options = {}) {
      const newline = detectNewline(source);
      const lines = source.split(/\r?\n/);
      const firstContentIndex = lines.findIndex((line) => line.trim());
      const issues = [];
      let boardId = null;
      let title = DEFAULT_BOARD_TITLE2;
      let quadrantLabels = {};
      let bodyStart = 0;
      if (firstContentIndex < 0) {
        issues.push("\u4EE3\u7801\u5757\u7F3A\u5C11\u56DB\u8C61\u9650\u5143\u6570\u636E");
      } else {
        const metadataLine = lines[firstContentIndex].trim();
        if (metadataLine.startsWith(BOARD_META_PREFIX) && metadataLine.endsWith(BOARD_META_SUFFIX)) {
          try {
            const metadata = JSON.parse(metadataLine.slice(BOARD_META_PREFIX.length, -BOARD_META_SUFFIX.length));
            if ((metadata == null ? void 0 : metadata.version) === 2 && BOARD_ID_PATTERN.test(metadata.id || "")) {
              boardId = metadata.id;
              const parsedTitle = normalizeBoardTitle(metadata.title);
              if (parsedTitle) title = parsedTitle;
              else issues.push("\u56DB\u8C61\u9650\u6807\u9898\u683C\u5F0F\u65E0\u6548");
              const parsedQuadrantLabels = normalizeQuadrantLabels(metadata.quadrants);
              if (parsedQuadrantLabels) quadrantLabels = parsedQuadrantLabels;
              else issues.push("\u8C61\u9650\u6807\u9898\u6216\u526F\u6807\u9898\u683C\u5F0F\u65E0\u6548");
            }
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
        title,
        quadrantLabels,
        data: parsed.data,
        issues,
        newline
      };
    }
    function renderBoardSource(boardId, data, newline = "\n", title = DEFAULT_BOARD_TITLE2, quadrantLabels = {}) {
      if (!BOARD_ID_PATTERN.test(boardId || "")) throw new Error("board-id \u683C\u5F0F\u65E0\u6548");
      const normalizedTitle = normalizeBoardTitle(title, null);
      if (!normalizedTitle) throw new Error(`\u56DB\u8C61\u9650\u6807\u9898\u4E0D\u80FD\u4E3A\u7A7A\u4E14\u4E0D\u80FD\u8D85\u8FC7 ${MAX_BOARD_TITLE_LENGTH} \u4E2A\u5B57\u7B26`);
      const normalizedQuadrantLabels = normalizeQuadrantLabels(quadrantLabels);
      if (!normalizedQuadrantLabels) throw new Error("\u8C61\u9650\u6807\u9898\u6216\u526F\u6807\u9898\u683C\u5F0F\u65E0\u6548");
      const managed = renderManagedBlock(data, newline);
      const body = managed.slice(START_MARKER.length, managed.length - END_MARKER.length).replace(/(?:\r?\n)+$/, "");
      const metadata = { id: boardId, version: 2 };
      if (normalizedTitle !== DEFAULT_BOARD_TITLE2) metadata.title = normalizedTitle;
      if (Object.keys(normalizedQuadrantLabels).length) metadata.quadrants = normalizedQuadrantLabels;
      return `${BOARD_META_PREFIX}${JSON.stringify(metadata)}${BOARD_META_SUFFIX}${body}`;
    }
    function renderBoardCodeBlock2(boardId, data, newline = "\n", title = DEFAULT_BOARD_TITLE2, quadrantLabels = {}) {
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
          if (!BOARD_LANGUAGES2.includes(language)) {
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
      return { boardId, title: board.title, quadrantLabels: board.quadrantLabels, data: board.data };
    }
    function mutateBoardDocument2(content, boardId, mutator) {
      const board = findUniqueBoard(content, boardId);
      const draft = cloneData2(board.data);
      const result = mutator(draft);
      if (!result) return { content, data: board.data, title: board.title, quadrantLabels: board.quadrantLabels, result };
      const source = renderBoardSource(boardId, draft, board.newline, board.title, board.quadrantLabels);
      return {
        content: `${content.slice(0, board.sourceStart)}${source}${board.newline}${content.slice(board.sourceEnd)}`,
        data: draft,
        title: board.title,
        quadrantLabels: board.quadrantLabels,
        result
      };
    }
    function renameBoardDocument2(content, boardId, title) {
      const board = findUniqueBoard(content, boardId);
      const normalizedTitle = normalizeBoardTitle(title, null);
      if (!normalizedTitle) throw new Error(`\u56DB\u8C61\u9650\u6807\u9898\u4E0D\u80FD\u4E3A\u7A7A\u4E14\u4E0D\u80FD\u8D85\u8FC7 ${MAX_BOARD_TITLE_LENGTH} \u4E2A\u5B57\u7B26`);
      if (normalizedTitle === board.title) {
        return { content, data: board.data, title: board.title, quadrantLabels: board.quadrantLabels, result: board.title };
      }
      const source = renderBoardSource(boardId, board.data, board.newline, normalizedTitle, board.quadrantLabels);
      return {
        content: `${content.slice(0, board.sourceStart)}${source}${board.newline}${content.slice(board.sourceEnd)}`,
        data: board.data,
        title: normalizedTitle,
        quadrantLabels: board.quadrantLabels,
        result: normalizedTitle
      };
    }
    function updateQuadrantLabelsDocument2(content, boardId, quadrant, labels) {
      if (!QUADRANTS2.includes(quadrant)) throw new Error(`\u8C61\u9650\u65E0\u6548\uFF1A${quadrant}`);
      const board = findUniqueBoard(content, boardId);
      const quadrantLabels = { ...board.quadrantLabels };
      let result = null;
      if (labels === null) {
        delete quadrantLabels[quadrant];
      } else {
        if (!labels || typeof labels.title !== "string" || typeof labels.subtitle !== "string") {
          throw new Error("\u8C61\u9650\u6807\u9898\u548C\u526F\u6807\u9898\u4E0D\u80FD\u4E3A\u7A7A");
        }
        const title = labels.title.trim();
        const subtitle = labels.subtitle.trim();
        if (!title || !subtitle) throw new Error("\u8C61\u9650\u6807\u9898\u548C\u526F\u6807\u9898\u4E0D\u80FD\u4E3A\u7A7A");
        if (title.length > MAX_QUADRANT_TITLE_LENGTH) {
          throw new Error(`\u8C61\u9650\u6807\u9898\u4E0D\u80FD\u8D85\u8FC7 ${MAX_QUADRANT_TITLE_LENGTH} \u4E2A\u5B57\u7B26`);
        }
        if (subtitle.length > MAX_QUADRANT_SUBTITLE_LENGTH) {
          throw new Error(`\u8C61\u9650\u526F\u6807\u9898\u4E0D\u80FD\u8D85\u8FC7 ${MAX_QUADRANT_SUBTITLE_LENGTH} \u4E2A\u5B57\u7B26`);
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
      BOARD_LANGUAGE,
      BOARD_LANGUAGES: BOARD_LANGUAGES2,
      DEFAULT_BOARD_TITLE: DEFAULT_BOARD_TITLE2,
      LEGACY_BOARD_LANGUAGE,
      appendBoardCodeBlock: appendBoardCodeBlock2,
      createBoardId: createBoardId2,
      findBoardCodeBlocks: findBoardCodeBlocks2,
      mergeWithoutConflicts: mergeWithoutConflicts2,
      mutateBoardDocument: mutateBoardDocument2,
      parseBoardSource: parseBoardSource2,
      readBoardFromDocument: readBoardFromDocument2,
      renameBoardDocument: renameBoardDocument2,
      renderBoardCodeBlock: renderBoardCodeBlock2,
      renderBoardSource,
      replaceLegacyManagedBlock: replaceLegacyManagedBlock2,
      updateQuadrantLabelsDocument: updateQuadrantLabelsDocument2
    };
  }
});

// src/i18n.js
var require_i18n = __commonJS({
  "src/i18n.js"(exports2, module2) {
    "use strict";
    var DEFAULT_LANGUAGE = "zh";
    var DEFAULT_LANGUAGE_MODE = "auto";
    var SUPPORTED_LANGUAGES = /* @__PURE__ */ new Set(["zh", "en"]);
    var SUPPORTED_LANGUAGE_MODES = /* @__PURE__ */ new Set([DEFAULT_LANGUAGE_MODE, ...SUPPORTED_LANGUAGES]);
    var TRANSLATIONS = {
      zh: {
        "quadrant.do.action": "\u7ACB\u5373\u505A",
        "quadrant.do.description": "\u91CD\u8981\u4E14\u7D27\u6025",
        "quadrant.schedule.action": "\u5B89\u6392",
        "quadrant.schedule.description": "\u91CD\u8981\u4E0D\u7D27\u6025",
        "quadrant.delegate.action": "\u59D4\u6D3E",
        "quadrant.delegate.description": "\u7D27\u6025\u4E0D\u91CD\u8981",
        "quadrant.eliminate.action": "\u820D\u5F03",
        "quadrant.eliminate.description": "\u4E0D\u91CD\u8981\u4E0D\u7D27\u6025",
        "period.all": "\u5168\u90E8",
        "period.today": "\u4ECA\u5929",
        "period.7d": "\u8FD1 7 \u5929",
        "period.30d": "\u8FD1 30 \u5929",
        "period.custom": "\u81EA\u5B9A\u4E49",
        "common.cancel": "\u53D6\u6D88",
        "common.save": "\u4FDD\u5B58",
        "common.undo": "\u64A4\u9500",
        "modal.editTask": "\u7F16\u8F91\u4EFB\u52A1",
        "modal.taskContent": "\u4EFB\u52A1\u5185\u5BB9",
        "modal.editTitle": "\u7F16\u8F91\u56DB\u8C61\u9650\u6807\u9898",
        "modal.matrixTitle": "\u56DB\u8C61\u9650\u6807\u9898",
        "modal.editQuadrant": "\u7F16\u8F91\u8C61\u9650\u6807\u9898\u548C\u526F\u6807\u9898",
        "modal.quadrantTitle": "\u8C61\u9650\u6807\u9898",
        "modal.quadrantSubtitle": "\u8C61\u9650\u526F\u6807\u9898",
        "modal.restoreQuadrantDefaults": "\u6062\u590D\u9ED8\u8BA4",
        "board.invalid": "\u56DB\u8C61\u9650\u4EE3\u7801\u5757\u5185\u5BB9\u65E0\u6548\uFF0C\u8BF7\u5148\u4FEE\u590D\u6E90\u6587\u672C\u3002",
        "board.editTitle": "\u7F16\u8F91\u56DB\u8C61\u9650\u6807\u9898",
        "board.editQuadrant": "\u7F16\u8F91{quadrant}\u7684\u6807\u9898\u548C\u526F\u6807\u9898",
        "board.collapse": "\u6298\u53E0\u56DB\u8C61\u9650",
        "board.expand": "\u5C55\u5F00\u56DB\u8C61\u9650",
        "board.summary": "\u56DB\u8C61\u9650\u6458\u8981",
        "board.layout": "\u77E9\u9635\u5E03\u5C40",
        "board.layout.auto": "\u81EA\u52A8\u5E03\u5C40",
        "board.layout.grid": "\u7530\u5B57\u578B",
        "board.layout.vertical": "\u7EB5\u5411\u6392\u5217",
        "board.quadrantArea": "\u56DB\u8C61\u9650\u4EFB\u52A1\u533A\u57DF\uFF08\u7530\u5B57\u578B\u5728\u7A84\u5C4F\u53EF\u5DE6\u53F3\u6EDA\u52A8\uFF09",
        "board.layoutHint": "\u5DE6\u53F3\u6ED1\u52A8\u67E5\u770B\u53E6\u4E00\u5217\uFF1B\u62D6\u52A8\u4EFB\u52A1\u5230\u8FB9\u7F18\u4E5F\u53EF\u6EDA\u52A8\u3002",
        "stats.active": "{count} \u9879\u8FDB\u884C\u4E2D",
        "stats.completed": "{count} \u9879\u5DF2\u5B8C\u6210",
        "task.add": "\u6DFB\u52A0\u4EFB\u52A1",
        "task.dueDate": "\u622A\u6B62\u65E5\u671F",
        "task.dueLabel": "\u622A\u6B62",
        "task.noDueDate": "\u622A\u6B62\u65E5\u671F",
        "task.notes": "\u5907\u6CE8",
        "task.notesPlaceholder": "\u5907\u6CE8\uFF08\u9009\u586B\uFF09",
        "task.today": "\u4ECA\u5929",
        "task.tomorrow": "\u660E\u5929",
        "task.clearDate": "\u6E05\u9664\u65E5\u671F",
        "task.applyDate": "\u786E\u8BA4\u65E5\u671F",
        "task.previousMonth": "\u4E0A\u4E2A\u6708",
        "task.nextMonth": "\u4E0B\u4E2A\u6708",
        "task.dueToday": "\u4ECA\u5929\u5230\u671F",
        "task.dueTime": "\u622A\u6B62\u65F6\u95F4\uFF08\u9009\u586B\uFF09",
        "task.timeOptional": "\u65F6\u95F4\uFF08\u9009\u586B\uFF09",
        "task.clearTime": "\u6E05\u9664\u622A\u6B62\u65F6\u95F4",
        "task.tags": "\u6807\u7B7E",
        "task.tagsPlaceholder": "\u6807\u7B7E\uFF0C\u56DE\u8F66\u6216\u9017\u53F7\u6DFB\u52A0",
        "task.removeTag": "\u79FB\u9664\u6807\u7B7E\uFF1A{tag}",
        "task.remainingDays": "\u8FD8\u5269 {count} \u5929",
        "task.overdueDays": "\u5DF2\u903E\u671F {count} \u5929",
        "task.saveFailed": "\u672A\u80FD\u4FDD\u5B58\uFF0C\u5DF2\u4FDD\u7559\u8F93\u5165\u5185\u5BB9\uFF0C\u8BF7\u91CD\u8BD5\u3002",
        "task.addTo": "\u6DFB\u52A0\u5230{quadrant}",
        "task.empty": "\u6682\u65E0\u4EFB\u52A1",
        "task.complete": "\u5B8C\u6210\u4EFB\u52A1\uFF1A{title}",
        "task.edit": "\u7F16\u8F91\u4EFB\u52A1",
        "task.more": "\u66F4\u591A\u64CD\u4F5C",
        "task.drag": "\u62D6\u52A8\u6216\u6253\u5F00\u4EFB\u52A1\u64CD\u4F5C\uFF1A{title}",
        "task.menuEdit": "\u7F16\u8F91",
        "task.moveUp": "\u4E0A\u79FB",
        "task.moveDown": "\u4E0B\u79FB",
        "task.moveTo": "\u79FB\u81F3\uFF1A{quadrant}",
        "task.delete": "\u5220\u9664",
        "task.completedNotice": "\u4EFB\u52A1\u5DF2\u5B8C\u6210",
        "task.restoredNotice": "\u4EFB\u52A1\u5DF2\u6062\u590D",
        "task.deletedNotice": "\u4EFB\u52A1\u5DF2\u5220\u9664",
        "completed.title": "\u5DF2\u5B8C\u6210",
        "completed.at": "\u5B8C\u6210\u4E8E",
        "completed.filterQuadrant": "\u6309\u6765\u6E90\u8C61\u9650\u7B5B\u9009",
        "completed.allQuadrants": "\u5168\u90E8\u8C61\u9650",
        "completed.timeFilter": "\u5B8C\u6210\u65F6\u95F4",
        "completed.invalidRange": "\u5F00\u59CB\u65E5\u671F\u4E0D\u80FD\u665A\u4E8E\u7ED3\u675F\u65E5\u671F",
        "completed.none": "\u8FD8\u6CA1\u6709\u5DF2\u5B8C\u6210\u7684\u4EFB\u52A1",
        "completed.noMatches": "\u6CA1\u6709\u7B26\u5408\u7B5B\u9009\u6761\u4EF6\u7684\u4EFB\u52A1",
        "completed.startDate": "\u5B8C\u6210\u65F6\u95F4\u8D77\u59CB\u65E5\u671F",
        "completed.to": "\u81F3",
        "completed.endDate": "\u5B8C\u6210\u65F6\u95F4\u7ED3\u675F\u65E5\u671F",
        "completed.restore": "\u6062\u590D\u4EFB\u52A1\uFF1A{title}",
        "completed.delete": "\u5220\u9664\u4EFB\u52A1",
        "completed.enableScroll": "\u9650\u5236\u5DF2\u5B8C\u6210\u5217\u8868\u9AD8\u5EA6\u5E76\u6EDA\u52A8\u663E\u793A",
        "completed.showAll": "\u5C55\u5F00\u5DF2\u5B8C\u6210\u5217\u8868\uFF08\u4FDD\u7559\u7B5B\u9009\uFF09",
        "completed.listLabel": "\u53EF\u6EDA\u52A8\u7684\u5DF2\u5B8C\u6210\u4EFB\u52A1\u5217\u8868",
        "command.insert": "\u5728\u5F53\u524D\u5149\u6807\u5904\u63D2\u5165\u56DB\u8C61\u9650",
        "ribbon.insert": "\u63D2\u5165\u56DB\u8C61\u9650",
        "notice.inserted": "\u5DF2\u63D2\u5165\u72EC\u7ACB\u56DB\u8C61\u9650",
        "notice.openMarkdown": "\u8BF7\u5148\u6253\u5F00\u4E00\u4E2A\u53EF\u7F16\u8F91\u7684 Markdown \u6587\u4EF6",
        "notice.fileMissing": "\u627E\u4E0D\u5230\u8FD9\u5F20\u56DB\u8C61\u9650\u6240\u5728\u7684 Markdown \u6587\u4EF6",
        "notice.saveFailed": "\u56DB\u8C61\u9650\u4FDD\u5B58\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u6E90\u6587\u672C\u6216\u6587\u4EF6\u72B6\u6001\u3002",
        "notice.partialEditorWrite": "\u90E8\u5206\u7F16\u8F91\u7A97\u53E3\u53EF\u80FD\u5DF2\u5E94\u7528\u8FD9\u6B21\u4FEE\u6539\uFF0C\u4F46\u7A97\u53E3\u540C\u6B65\u5931\u8D25\u3002\u8BF7\u5148\u68C0\u67E5\u5E76\u7EDF\u4E00\u8FD9\u7BC7\u7B14\u8BB0\u7684\u5185\u5BB9\uFF0C\u4E0D\u8981\u76F4\u63A5\u91CD\u590D\u65B0\u589E\u4EFB\u52A1\u3002",
        "notice.layoutSaveFailed": "\u5E03\u5C40\u504F\u597D\u672A\u80FD\u4FDD\u5B58\uFF0C\u8BF7\u68C0\u67E5\u672C\u673A\u5B58\u50A8\u540E\u91CD\u8BD5\u3002",
        "notice.fileUnavailable": "\u6240\u5728\u7684 Markdown \u6587\u4EF6\u4E0D\u53EF\u7528",
        "notice.migrationComplete": "\u65E7\u7684\u5168\u5C40\u4EFB\u52A1\u5DF2\u8FC1\u79FB\u4E3A Markdown \u6587\u4EF6\u4E2D\u7684\u72EC\u7ACB\u56DB\u8C61\u9650",
        "notice.migrationFailed": "\u65E7\u4EFB\u52A1\u8FC1\u79FB\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u63A7\u5236\u53F0\u548C\u5907\u4EFD\u6587\u4EF6\u3002",
        "settings.language": "\u754C\u9762\u8BED\u8A00",
        "settings.languageDescription": "\u9009\u62E9\u8DDF\u968F Obsidian\uFF0C\u6216\u6307\u5B9A\u56DB\u8C61\u9650\u63A7\u4EF6\u3001\u83DC\u5355\u548C\u63D0\u793A\u4FE1\u606F\u6240\u4F7F\u7528\u7684\u8BED\u8A00\u3002",
        "settings.followObsidian": "\u8DDF\u968F Obsidian"
      },
      en: {
        "quadrant.do.action": "Do now",
        "quadrant.do.description": "Important and urgent",
        "quadrant.schedule.action": "Schedule",
        "quadrant.schedule.description": "Important, not urgent",
        "quadrant.delegate.action": "Delegate",
        "quadrant.delegate.description": "Urgent, not important",
        "quadrant.eliminate.action": "Eliminate",
        "quadrant.eliminate.description": "Neither important nor urgent",
        "period.all": "All",
        "period.today": "Today",
        "period.7d": "Last 7 days",
        "period.30d": "Last 30 days",
        "period.custom": "Custom",
        "common.cancel": "Cancel",
        "common.save": "Save",
        "common.undo": "Undo",
        "modal.editTask": "Edit task",
        "modal.taskContent": "Task content",
        "modal.editTitle": "Edit matrix title",
        "modal.matrixTitle": "Matrix title",
        "modal.editQuadrant": "Edit quadrant title and subtitle",
        "modal.quadrantTitle": "Quadrant title",
        "modal.quadrantSubtitle": "Quadrant subtitle",
        "modal.restoreQuadrantDefaults": "Restore defaults",
        "board.invalid": "This matrix block contains invalid data. Fix the source before continuing.",
        "board.editTitle": "Edit matrix title",
        "board.editQuadrant": "Edit {quadrant} title and subtitle",
        "board.collapse": "Collapse matrix",
        "board.expand": "Expand matrix",
        "board.summary": "Matrix summary",
        "board.layout": "Matrix layout",
        "board.layout.auto": "Auto layout",
        "board.layout.grid": "2 \xD7 2 grid",
        "board.layout.vertical": "Vertical",
        "board.quadrantArea": "Quadrant tasks (scroll horizontally for a narrow grid)",
        "board.layoutHint": "Scroll sideways to see the other column, or drag a task to the edge.",
        "stats.active": "{count} active",
        "stats.completed": "{count} completed",
        "task.add": "Add task",
        "task.dueDate": "Due date",
        "task.dueLabel": "Due",
        "task.noDueDate": "Due date",
        "task.notes": "Notes",
        "task.notesPlaceholder": "Notes (optional)",
        "task.today": "Today",
        "task.tomorrow": "Tomorrow",
        "task.clearDate": "Clear date",
        "task.applyDate": "Apply date",
        "task.previousMonth": "Previous month",
        "task.nextMonth": "Next month",
        "task.dueToday": "Due today",
        "task.dueTime": "Due time (optional)",
        "task.timeOptional": "Time (optional)",
        "task.clearTime": "Clear due time",
        "task.tags": "Tags",
        "task.tagsPlaceholder": "Tags \xB7 Enter or comma to add",
        "task.removeTag": "Remove tag: {tag}",
        "task.remainingDays": "{count} days left",
        "task.overdueDays": "{count} days overdue",
        "task.saveFailed": "Could not save. Your input has been kept; please retry.",
        "task.addTo": "Add to {quadrant}",
        "task.empty": "No tasks",
        "task.complete": "Complete task: {title}",
        "task.edit": "Edit task",
        "task.more": "More actions",
        "task.drag": "Drag or open task actions: {title}",
        "task.menuEdit": "Edit",
        "task.moveUp": "Move up",
        "task.moveDown": "Move down",
        "task.moveTo": "Move to: {quadrant}",
        "task.delete": "Delete",
        "task.completedNotice": "Task completed",
        "task.restoredNotice": "Task restored",
        "task.deletedNotice": "Task deleted",
        "completed.title": "Completed",
        "completed.at": "Completed on",
        "completed.filterQuadrant": "Filter by source quadrant",
        "completed.allQuadrants": "All quadrants",
        "completed.timeFilter": "Completion date",
        "completed.invalidRange": "The start date must not be after the end date",
        "completed.none": "No completed tasks yet",
        "completed.noMatches": "No tasks match these filters",
        "completed.startDate": "Completion start date",
        "completed.to": "to",
        "completed.endDate": "Completion end date",
        "completed.restore": "Restore task: {title}",
        "completed.delete": "Delete task",
        "completed.enableScroll": "Limit completed list height and scroll",
        "completed.showAll": "Expand completed list (keep filters)",
        "completed.listLabel": "Scrollable completed task list",
        "command.insert": "Insert matrix at cursor",
        "ribbon.insert": "Insert matrix",
        "notice.inserted": "Independent matrix inserted",
        "notice.openMarkdown": "Open an editable Markdown file first",
        "notice.fileMissing": "The Markdown file containing this matrix was not found",
        "notice.saveFailed": "The matrix could not be saved. Check the source or file state.",
        "notice.partialEditorWrite": "Some editors may have applied this change, but pane synchronization failed. Check and reconcile the note before retrying; do not add the task again blindly.",
        "notice.layoutSaveFailed": "Layout preference could not be saved. Check local storage and try again.",
        "notice.fileUnavailable": "The Markdown file containing this matrix is unavailable",
        "notice.migrationComplete": "The global task board was migrated to an independent Markdown matrix",
        "notice.migrationFailed": "Legacy task migration failed. Check the console and backup files.",
        "settings.language": "Interface language",
        "settings.languageDescription": "Follow Obsidian or choose the language used by matrix controls, menus, and messages.",
        "settings.followObsidian": "Follow Obsidian"
      }
    };
    function normalizeLanguage(value) {
      const baseLanguage = String(value || "").toLowerCase().split("-")[0];
      return SUPPORTED_LANGUAGES.has(baseLanguage) ? baseLanguage : DEFAULT_LANGUAGE;
    }
    function normalizeLanguageMode2(value) {
      return SUPPORTED_LANGUAGE_MODES.has(value) ? value : DEFAULT_LANGUAGE_MODE;
    }
    function resolveLanguage2(mode, appLanguage) {
      const normalizedMode = normalizeLanguageMode2(mode);
      if (normalizedMode !== DEFAULT_LANGUAGE_MODE) return normalizedMode;
      const appBaseLanguage = String(appLanguage || "en").toLowerCase().split("-")[0];
      return appBaseLanguage === "zh" ? "zh" : "en";
    }
    function translate2(language, key, variables = {}) {
      var _a, _b;
      const normalized = normalizeLanguage(language);
      const template = (_b = (_a = TRANSLATIONS[normalized][key]) != null ? _a : TRANSLATIONS[DEFAULT_LANGUAGE][key]) != null ? _b : key;
      return template.replace(
        /\{([A-Za-z0-9_]+)\}/g,
        (match, name) => Object.prototype.hasOwnProperty.call(variables, name) ? String(variables[name]) : match
      );
    }
    module2.exports = {
      DEFAULT_LANGUAGE,
      DEFAULT_LANGUAGE_MODE,
      normalizeLanguage,
      normalizeLanguageMode: normalizeLanguageMode2,
      resolveLanguage: resolveLanguage2,
      translate: translate2
    };
  }
});

// src/layout-preferences.js
var require_layout_preferences = __commonJS({
  "src/layout-preferences.js"(exports2, module2) {
    "use strict";
    var STORAGE_KEY = "eisenhower-matrix-blocks:layouts";
    var LAYOUT_MODES2 = Object.freeze(["auto", "grid", "vertical"]);
    function legacyKey(app) {
      return `${STORAGE_KEY}:${app.vault.adapter.getResourcePath("")}`;
    }
    function readPreferences(app) {
      var _a;
      let value;
      if (typeof app.loadLocalStorage === "function") {
        value = app.loadLocalStorage(STORAGE_KEY);
        if (value == null && ((_a = app.vault) == null ? void 0 : _a.adapter) && globalThis.localStorage) {
          value = JSON.parse(globalThis.localStorage.getItem(legacyKey(app)) || "null");
        }
      } else value = JSON.parse(globalThis.localStorage.getItem(legacyKey(app)) || "null");
      const entries = /* @__PURE__ */ new Map();
      if (!Array.isArray(value)) return entries;
      for (const entry of value) {
        if (!Array.isArray(entry) || entry.length !== 3) continue;
        const [path, boardId, mode] = entry;
        if (typeof path === "string" && typeof boardId === "string" && ["grid", "vertical"].includes(mode)) {
          entries.set(JSON.stringify([path, boardId]), mode);
        }
      }
      return entries;
    }
    function writePreferences(app, entries) {
      const value = [...entries].map(([key, mode]) => [...JSON.parse(key), mode]);
      if (typeof app.saveLocalStorage === "function") app.saveLocalStorage(STORAGE_KEY, value);
      else if (value.length) globalThis.localStorage.setItem(legacyKey(app), JSON.stringify(value));
      else globalThis.localStorage.removeItem(legacyKey(app));
    }
    function getBoardLayout2(app, path, boardId) {
      try {
        return readPreferences(app).get(JSON.stringify([path, boardId])) || "auto";
      } catch (error) {
        console.warn("Eisenhower Matrix Blocks could not read local layout preferences", error);
        return "auto";
      }
    }
    function saveBoardLayout2(app, path, boardId, mode) {
      if (!LAYOUT_MODES2.includes(mode)) throw new Error("Invalid matrix layout");
      const entries = readPreferences(app);
      const key = JSON.stringify([path, boardId]);
      if (mode === "auto") entries.delete(key);
      else entries.set(key, mode);
      writePreferences(app, entries);
    }
    function moveBoardLayouts2(app, oldPath, newPath) {
      const entries = readPreferences(app);
      let changed = false;
      for (const [key, mode] of [...entries]) {
        const [path, boardId] = JSON.parse(key);
        if (path !== oldPath && !path.startsWith(`${oldPath}/`)) continue;
        entries.delete(key);
        entries.set(JSON.stringify([newPath + path.slice(oldPath.length), boardId]), mode);
        changed = true;
      }
      if (changed) writePreferences(app, entries);
    }
    module2.exports = { LAYOUT_MODES: LAYOUT_MODES2, getBoardLayout: getBoardLayout2, saveBoardLayout: saveBoardLayout2, moveBoardLayouts: moveBoardLayouts2 };
  }
});

// src/tag-input.js
var require_tag_input = __commonJS({
  "src/tag-input.js"(exports2, module2) {
    "use strict";
    var { normalizeTags, getTagColorIndex } = require_task_tags();
    function createTagChip(parent, tag) {
      const chip = parent.createSpan({ cls: `qt-tag qt-tag-color-${getTagColorIndex(tag)}`, attr: { title: tag } });
      chip.createSpan({ cls: "qt-tag-label", text: `#${tag}` });
      return chip;
    }
    function createTagInput(parent, plugin, initialTags, onChange) {
      let tags = normalizeTags(initialTags);
      let disabled = false;
      let composing = false;
      const root = parent.createDiv({ cls: "qt-tag-field" });
      const chips = root.createDiv({ cls: "qt-tag-chips" });
      const input = root.createEl("textarea", {
        cls: "qt-tag-input",
        attr: { rows: "1", "aria-label": plugin.t("task.tags"), placeholder: plugin.t("task.tagsPlaceholder") }
      });
      const split = (value) => value.split(/[,，\r\n]+/);
      const getValue = () => normalizeTags([...tags, ...split(input.value)]);
      const render = () => {
        chips.empty();
        for (const tag of tags) {
          const chip = createTagChip(chips, tag);
          const remove = chip.createEl("button", {
            cls: "qt-tag-remove",
            text: "\xD7",
            attr: { type: "button", "aria-label": plugin.t("task.removeTag", { tag }) }
          });
          remove.disabled = disabled;
          remove.addEventListener("click", () => {
            if (disabled) return;
            tags = tags.filter((value) => value !== tag);
            render();
            onChange(getValue());
            input.focus();
          });
        }
      };
      const commit = () => {
        if (disabled) return;
        tags = getValue();
        input.value = "";
        render();
        onChange(getValue());
      };
      const onInput = (event) => {
        if (disabled || event.isComposing) return;
        if (/[,，\r\n]/.test(input.value)) {
          const parts = split(input.value);
          input.value = parts.pop();
          tags = normalizeTags([...tags, ...parts]);
          render();
        }
        onChange(getValue());
      };
      const onKey = (event) => {
        if (event.key !== "Enter" || event.isComposing || event.keyCode === 229) return;
        event.preventDefault();
        event.stopPropagation();
        commit();
      };
      input.addEventListener("input", onInput);
      const compositionStart = () => {
        composing = true;
      };
      const compositionEnd = (event) => {
        composing = false;
        onInput(event);
      };
      input.addEventListener("compositionstart", compositionStart);
      input.addEventListener("compositionend", compositionEnd);
      input.addEventListener("keydown", onKey);
      render();
      return {
        getValue,
        isEditing: () => composing,
        setValue(value) {
          if (composing) return;
          tags = normalizeTags(value);
          input.value = "";
          render();
        },
        setDisabled(value) {
          disabled = value;
          input.disabled = value;
          render();
        },
        destroy() {
          input.removeEventListener("input", onInput);
          input.removeEventListener("compositionstart", compositionStart);
          input.removeEventListener("compositionend", compositionEnd);
          input.removeEventListener("keydown", onKey);
        }
      };
    }
    module2.exports = { createTagInput, createTagChip };
  }
});

// src/task-fields.js
var require_task_fields = __commonJS({
  "src/task-fields.js"(exports2, module2) {
    "use strict";
    var { Modal: Modal2, setIcon: setIcon2 } = require("obsidian");
    var { normalizeDueDate, normalizeDueTime } = require_task_details();
    var { createTagInput } = require_tag_input();
    function autoSize(textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
    function validateNativeField(input, normalize) {
      var _a, _b, _c;
      const valid = !((_a = input.validity) == null ? void 0 : _a.badInput) && ((_b = input.validity) == null ? void 0 : _b.valid) !== false && (!input.value || Boolean(normalize(input.value)));
      if (!valid) {
        (_c = input.reportValidity) == null ? void 0 : _c.call(input);
        input.focus();
      }
      return valid;
    }
    function createDueDateControl(parent, plugin, initialValue, onChange) {
      const wrapper = parent.createDiv({ cls: "qt-date-control" });
      const input = wrapper.createEl("input", {
        cls: "qt-native-date",
        attr: { type: "date", "aria-label": plugin.t("task.dueDate"), title: plugin.t("task.dueDate"), min: "0001-01-01", max: "9999-12-31" }
      });
      const getValue = () => normalizeDueDate(input.value);
      const setValue = (value) => {
        input.value = normalizeDueDate(value) || "";
      };
      const change = () => {
        var _a;
        if (!((_a = input.validity) == null ? void 0 : _a.badInput)) onChange(getValue());
      };
      input.addEventListener("change", change);
      setValue(initialValue);
      return {
        getValue,
        setValue,
        validate: () => validateNativeField(input, normalizeDueDate),
        setDisabled(disabled) {
          input.disabled = disabled;
        },
        destroy() {
          input.removeEventListener("change", change);
        }
      };
    }
    function createDeadlineFields(parent, plugin, initialValue = {}, onChange = () => {
    }) {
      const wrapper = parent.createDiv({ cls: "qt-deadline-fields" });
      let disabled = false;
      const date = createDueDateControl(wrapper, plugin, initialValue.dueDate, (value) => {
        if (!value) time.value = "";
        updateDisabled();
        onChange(getValue());
      });
      const timeWrapper = wrapper.createDiv({ cls: "qt-time-control" });
      const time = timeWrapper.createEl("input", {
        cls: "qt-due-time",
        attr: { type: "time", step: "60", "aria-label": plugin.t("task.dueTime"), title: plugin.t("task.timeOptional") }
      });
      const clear = timeWrapper.createEl("button", {
        cls: "clickable-icon qt-icon-button qt-clear-time",
        attr: { type: "button", "aria-label": plugin.t("task.clearTime"), title: plugin.t("task.clearTime") }
      });
      setIcon2(clear, "x");
      const getValue = () => ({ dueDate: date.getValue(), dueTime: date.getValue() ? normalizeDueTime(time.value) : null });
      const updateDisabled = () => {
        var _a;
        date.setDisabled(disabled);
        time.disabled = disabled || !date.getValue();
        clear.hidden = !date.getValue() || !time.value && !((_a = time.validity) == null ? void 0 : _a.badInput);
        clear.disabled = disabled || clear.hidden;
      };
      const setValue = (value = {}) => {
        date.setValue(value.dueDate);
        time.value = date.getValue() ? normalizeDueTime(value.dueTime) || "" : "";
        updateDisabled();
      };
      const change = () => {
        var _a;
        updateDisabled();
        if (!((_a = time.validity) == null ? void 0 : _a.badInput)) onChange(getValue());
      };
      const clearTime = () => {
        time.value = "";
        updateDisabled();
        onChange(getValue());
        time.focus();
      };
      const stateEvents = ["input", "keyup", "pointerup", "blur"];
      for (const event of stateEvents) time.addEventListener(event, updateDisabled);
      time.addEventListener("change", change);
      clear.addEventListener("click", clearTime);
      setValue(initialValue);
      return {
        getValue,
        setValue,
        validate: () => date.validate() && (!date.getValue() || validateNativeField(time, normalizeDueTime)),
        setDisabled(value) {
          disabled = value;
          updateDisabled();
        },
        destroy() {
          date.destroy();
          for (const event of stateEvents) time.removeEventListener(event, updateDisabled);
          time.removeEventListener("change", change);
          clear.removeEventListener("click", clearTime);
        }
      };
    }
    var TaskEditorModal2 = class extends Modal2 {
      constructor(plugin, task, onSave) {
        super(plugin.app);
        this.plugin = plugin;
        this.task = { ...task };
        this.onSave = onSave;
      }
      onOpen() {
        var _a, _b, _c;
        const t = (key) => this.plugin.t(key);
        this.setTitle(t("modal.editTask"));
        this.contentEl.addClass("qt-task-editor");
        const createTextarea = (labelKey, className, value, rows) => {
          const label = this.contentEl.createEl("label", { cls: "qt-modal-field" });
          label.createSpan({ cls: "qt-field-label", text: t(labelKey) });
          const input = label.createEl("textarea", { cls: `qt-modal-input qt-task-textarea ${className}`, attr: { rows: String(rows), "aria-label": t(labelKey) } });
          input.value = value || "";
          input.addEventListener("input", () => {
            input.removeClass("qt-input-error");
            input.setAttribute("aria-invalid", "false");
            autoSize(input);
          });
          return input;
        };
        const title = createTextarea("modal.taskContent", "qt-task-name-input", this.task.title, 1);
        const dueField = this.contentEl.createDiv({ cls: "qt-modal-field" });
        dueField.createSpan({ cls: "qt-field-label", text: t("task.dueDate") });
        this.dueControl = createDeadlineFields(dueField, this.plugin, this.task);
        const tagsField = this.contentEl.createDiv({ cls: "qt-modal-field" });
        tagsField.createSpan({ cls: "qt-field-label", text: t("task.tags") });
        this.tagControl = createTagInput(tagsField, this.plugin, this.task.tags || [], () => {
        });
        const notes = createTextarea("task.notes", "qt-task-notes-input", this.task.notes, 3);
        notes.setAttribute("placeholder", t("task.notesPlaceholder"));
        const error = this.contentEl.createDiv({ cls: "qt-task-save-error", attr: { role: "alert" } });
        const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
        const cancel = actions.createEl("button", { text: t("common.cancel"), attr: { type: "button" } });
        const save = actions.createEl("button", { cls: "mod-cta", text: t("common.save"), attr: { type: "button" } });
        let submitting = false;
        const submit = async () => {
          if (submitting) return;
          const taskTitle = title.value.replace(/\s*[\r\n]+\s*/g, " ").trim();
          if (!taskTitle) {
            title.addClass("qt-input-error");
            title.setAttribute("aria-invalid", "true");
            title.focus();
            return;
          }
          if (!this.dueControl.validate()) return;
          submitting = true;
          error.textContent = "";
          const details = { ...this.dueControl.getValue(), notes: notes.value, tags: this.tagControl.getValue() };
          const fields = [title, notes, save];
          for (const field of fields) field.disabled = true;
          this.dueControl.setDisabled(true);
          this.tagControl.setDisabled(true);
          try {
            const result = await this.onSave(taskTitle, details);
            if (result === false) throw new Error("Task save rejected");
            this.close();
          } catch (e) {
            error.textContent = t("task.saveFailed");
          } finally {
            submitting = false;
            for (const field of fields) field.disabled = false;
            this.dueControl.setDisabled(false);
            this.tagControl.setDisabled(false);
          }
        };
        for (const input of [title, notes]) {
          input.addEventListener("keydown", (event) => {
            if (event.key !== "Enter" || event.isComposing || event.keyCode === 229) return;
            if (input === notes && !event.ctrlKey && !event.metaKey) return;
            event.preventDefault();
            event.stopPropagation();
            void submit();
          });
        }
        cancel.addEventListener("click", () => this.close());
        save.addEventListener("click", () => void submit());
        const schedule = ((_c = (_b = (_a = this.contentEl.ownerDocument) == null ? void 0 : _a.defaultView) == null ? void 0 : _b.requestAnimationFrame) == null ? void 0 : _c.bind(this.contentEl.ownerDocument.defaultView)) || ((callback) => callback());
        schedule(() => {
          autoSize(title);
          autoSize(notes);
          title.focus();
          title.select();
        });
      }
      onClose() {
        var _a, _b;
        (_a = this.dueControl) == null ? void 0 : _a.destroy();
        (_b = this.tagControl) == null ? void 0 : _b.destroy();
        this.contentEl.empty();
      }
    };
    module2.exports = { TaskEditorModal: TaskEditorModal2, createDueDateControl, createDeadlineFields };
  }
});

// src/task-card.js
var require_task_card = __commonJS({
  "src/task-card.js"(exports2, module2) {
    "use strict";
    var { setIcon: setIcon2 } = require("obsidian");
    var { addTask } = require_core();
    var { getDueDateInfo, getDueDateTone } = require_task_details();
    var { createDeadlineFields } = require_task_fields();
    var { createTagInput, createTagChip } = require_tag_input();
    function growTextarea(input) {
      input.style.height = "auto";
      input.style.height = `${input.scrollHeight}px`;
    }
    function renderTaskDetails2(parent, task, plugin) {
      var _a, _b;
      const due = getDueDateInfo(task.dueDate, task.completedAt);
      const metadata = ((_a = task.tags) == null ? void 0 : _a.length) || due ? parent.createSpan({ cls: "qt-task-meta" }) : null;
      if ((_b = task.tags) == null ? void 0 : _b.length) {
        const tags = metadata.createSpan({ cls: "qt-task-tags", attr: { "aria-label": plugin.t("task.tags") } });
        for (const tag of task.tags) createTagChip(tags, tag);
      }
      if (due) {
        const tone = getDueDateTone(due.days, task.completedAt);
        const line = metadata.createSpan({ cls: `qt-task-due qt-due-${tone}${due.urgent ? " is-urgent" : ""}` });
        const dateUnit = line.createSpan({ cls: "qt-due-unit" });
        const icon = dateUnit.createSpan({ cls: "qt-due-icon", attr: { "aria-hidden": "true" } });
        setIcon2(icon, due.urgent ? "alarm-clock" : "calendar");
        dateUnit.createSpan({ text: plugin.t("task.dueLabel"), cls: "qt-due-label" });
        const time = dateUnit.createEl("time", { attr: { datetime: due.date + (task.dueTime ? `T${task.dueTime}` : "") } });
        time.createSpan({ text: due.date, cls: "qt-due-date" });
        const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(/* @__PURE__ */ new Date(`${due.date}T12:00:00Z`));
        time.createSpan({ text: weekday, cls: "qt-due-weekday" });
        if (task.dueTime) line.createSpan({ text: task.dueTime, cls: "qt-due-clock" });
        if (!task.completedAt) {
          const relative = plugin.t(due.days < 0 ? "task.overdueDays" : due.days === 0 ? "task.dueToday" : "task.remainingDays", { count: Math.abs(due.days) });
          line.createSpan({ text: relative, cls: "qt-due-relative" });
        }
      }
      if (task.notes) parent.createSpan({
        cls: "qt-task-notes",
        text: task.notes.replace(/\s+/g, " ")
      });
    }
    function renderQuickAdd2(section, renderer, quadrant, quadrantName) {
      const { plugin } = renderer;
      let draft = renderer.quickAddDrafts.get(quadrant);
      if (!draft) {
        draft = { title: "", dueDate: null, dueTime: null, tags: [], notes: "", submitting: false, error: false };
        renderer.quickAddDrafts.set(quadrant, draft);
      }
      const form = section.createDiv({ cls: "qt-quick-add" });
      const title = form.createEl("textarea", {
        cls: "qt-task-textarea",
        attr: { rows: "1", placeholder: plugin.t("task.add"), "aria-label": plugin.t("task.addTo", { quadrant: quadrantName }) }
      });
      title.value = draft.title;
      const button = form.createEl("button", {
        cls: "clickable-icon qt-icon-button qt-add-button",
        attr: { type: "button", "aria-label": plugin.t("task.addTo", { quadrant: quadrantName }), title: plugin.t("task.addTo", { quadrant: quadrantName }) }
      });
      setIcon2(button, "plus");
      button.disabled = draft.submitting;
      const details = form.createDiv({ cls: "qt-quick-details" });
      const dateControl = createDeadlineFields(details, plugin, draft, (value) => {
        Object.assign(draft, value);
      });
      renderer.quickAddControls.push(dateControl);
      const notes = details.createEl("textarea", {
        cls: "qt-quick-notes qt-task-textarea",
        attr: { rows: "1", placeholder: plugin.t("task.notesPlaceholder"), "aria-label": plugin.t("task.notes") }
      });
      notes.value = draft.notes;
      const tagHost = form.createDiv({ cls: "qt-quick-tags" });
      const tagControl = createTagInput(tagHost, plugin, draft.tags, (value) => {
        draft.tags = value;
      });
      renderer.quickAddControls.push(tagControl);
      const hasPartialDate = () => [...form.querySelectorAll("input")].some((input) => {
        var _a;
        return (_a = input.validity) == null ? void 0 : _a.badInput;
      });
      for (const input of form.querySelectorAll("input")) for (const event of ["input", "keyup", "pointerup"]) {
        input.addEventListener(event, () => {
          if (!hasPartialDate()) Object.assign(draft, dateControl.getValue());
        });
      }
      for (const [input, key] of [[title, "title"], [notes, "notes"]]) {
        input.addEventListener("input", () => {
          draft[key] = input.value;
          input.removeClass("qt-input-error");
          growTextarea(input);
        });
        if (input.value) (globalThis.requestAnimationFrame || ((callback) => callback()))(() => growTextarea(input));
      }
      const sync = () => {
        for (const [input, key] of [[title, "title"], [notes, "notes"]]) {
          if (input.value !== draft[key]) {
            input.value = draft[key];
            growTextarea(input);
          }
        }
        const partialDate = hasPartialDate();
        const deadline = dateControl.getValue();
        if (!partialDate && (deadline.dueDate !== draft.dueDate || deadline.dueTime !== draft.dueTime)) dateControl.setValue(draft);
        if (JSON.stringify(tagControl.getValue()) !== JSON.stringify(draft.tags)) tagControl.setValue(draft.tags);
        button.disabled = draft.submitting;
        const error = form.querySelector(".qt-quick-error");
        if (!draft.error) error == null ? void 0 : error.remove();
        else if (!error) form.createDiv({ cls: "qt-quick-error", text: plugin.t("task.saveFailed"), attr: { role: "alert" } });
      };
      const formState = { sync, hasPartialDate };
      renderer.quickAddForms.set(quadrant, formState);
      sync();
      const submit = async () => {
        if (draft.submitting) return;
        const value = title.value.replace(/\s*[\r\n]+\s*/g, " ").trim();
        if (!value) {
          title.addClass("qt-input-error");
          title.focus();
          return;
        }
        if (!dateControl.validate()) return;
        draft.submitting = true;
        button.disabled = true;
        const snapshot = { title: title.value, ...dateControl.getValue(), notes: notes.value, tags: tagControl.getValue() };
        try {
          const task = await renderer.mutate((data) => addTask(data, value, quadrant, snapshot));
          if (!task) throw new Error("Task creation did not complete");
          if (renderer.containerEl.isConnected !== false && renderer.quickAddForms.get(quadrant) === formState) draft.tags = tagControl.getValue();
          for (const key of ["title", "notes"]) {
            if (draft[key] === snapshot[key]) draft[key] = "";
          }
          const partialDeadline = [...plugin.boardRenderers].some((current) => {
            var _a;
            return current.containerEl.isConnected !== false && current.quickAddDrafts === renderer.quickAddDrafts && ((_a = current.quickAddForms.get(quadrant)) == null ? void 0 : _a.hasPartialDate());
          });
          if (!partialDeadline && draft.dueDate === snapshot.dueDate && draft.dueTime === snapshot.dueTime) {
            draft.dueDate = null;
            draft.dueTime = null;
          }
          if (JSON.stringify(draft.tags) === JSON.stringify(snapshot.tags)) draft.tags = [];
          draft.error = false;
        } catch (error) {
          draft.error = true;
        } finally {
          draft.submitting = false;
          for (const current of plugin.boardRenderers) {
            if (current.containerEl.isConnected !== false && current.quickAddDrafts === renderer.quickAddDrafts) current.syncQuickAddForms();
          }
        }
      };
      button.addEventListener("click", () => void submit());
      for (const input of [title, notes]) input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" || event.isComposing || event.keyCode === 229 || input === notes && !event.ctrlKey && !event.metaKey) return;
        event.preventDefault();
        event.stopPropagation();
        void submit();
      });
    }
    module2.exports = { renderTaskDetails: renderTaskDetails2, renderQuickAdd: renderQuickAdd2 };
  }
});

// src/board-view-state.js
var require_board_view_state = __commonJS({
  "src/board-view-state.js"(exports2, module2) {
    "use strict";
    function listKey(list) {
      var _a;
      return ((_a = list.closest("[data-quadrant]")) == null ? void 0 : _a.getAttribute("data-quadrant")) || "completed";
    }
    function captureBoardView2(root) {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i;
      const document2 = root.ownerDocument;
      const view = document2 == null ? void 0 : document2.defaultView;
      const lists = [...root.querySelectorAll(".qt-task-list, .qt-completed-list")].map((list) => {
        const bounds = list.getBoundingClientRect();
        const rows = [...list.querySelectorAll("[data-task-id]")];
        let low = 0, high = rows.length;
        while (low < high) {
          const middle = low + high >>> 1;
          if (rows[middle].getBoundingClientRect().bottom <= bounds.top) low = middle + 1;
          else high = middle;
        }
        const anchors = rows.slice(low, low + 3).map((row) => ({
          id: row.getAttribute("data-task-id"),
          offset: row.getBoundingClientRect().top - bounds.top
        }));
        return { key: listKey(list), top: list.scrollTop || 0, anchors };
      });
      const outer = [];
      for (let node = root.parentElement; node; node = node.parentElement) {
        if (node.scrollHeight > node.clientHeight && /auto|scroll|overlay/.test((view == null ? void 0 : view.getComputedStyle(node).overflowY) || "")) {
          outer.push({ node, top: node.scrollTop, left: node.scrollLeft });
        }
      }
      const page = document2 == null ? void 0 : document2.scrollingElement;
      if (page && !outer.some((item) => item.node === page)) outer.push({ node: page, top: page.scrollTop, left: page.scrollLeft });
      const visibleTop = ((_a = outer[0]) == null ? void 0 : _a.node) === page ? 0 : ((_b = outer[0]) == null ? void 0 : _b.node.getBoundingClientRect().top) || 0;
      const visibleBottom = ((_c = outer[0]) == null ? void 0 : _c.node) === page ? (_d = view == null ? void 0 : view.innerHeight) != null ? _d : Infinity : (_f = (_e = outer[0]) == null ? void 0 : _e.node.getBoundingClientRect().bottom) != null ? _f : Infinity;
      const rootBounds = root.getBoundingClientRect();
      if (rootBounds.bottom <= visibleTop || rootBounds.top >= visibleBottom) outer.length = 0;
      const sections = [...root.querySelectorAll("[data-quadrant], .qt-completed-section")];
      const section = sections.find((node) => node.getBoundingClientRect().bottom > visibleTop) || root;
      const focus = document2 == null ? void 0 : document2.activeElement;
      const focusState = focus && root.contains(focus) ? {
        node: focus,
        quadrant: (_g = focus.closest("[data-quadrant]")) == null ? void 0 : _g.getAttribute("data-quadrant"),
        taskId: (_h = focus.closest("[data-task-id]")) == null ? void 0 : _h.getAttribute("data-task-id"),
        label: focus.getAttribute("aria-label"),
        className: focus.className,
        start: focus.selectionStart,
        end: focus.selectionEnd
      } : null;
      return {
        lists,
        outer,
        focus: focusState,
        x: ((_i = root.querySelector(".qt-matrix-viewport")) == null ? void 0 : _i.scrollLeft) || 0,
        sectionKey: section === root ? "root" : section.getAttribute("data-quadrant") || "completed",
        sectionTop: section.getBoundingClientRect().top
      };
    }
    function restoreBoardView2(root, state, { focus = true, outer = true } = {}) {
      var _a, _b;
      if (!state) return;
      for (const list of root.querySelectorAll(".qt-task-list, .qt-completed-list")) {
        const saved = state.lists.find((item) => item.key === listKey(list));
        if (!saved) continue;
        list.scrollTop = saved.top;
        if (saved.top <= 0) continue;
        const rows = new Map([...list.querySelectorAll("[data-task-id]")].map((row) => [row.getAttribute("data-task-id"), row]));
        const anchor = saved.anchors.find((item) => rows.has(item.id));
        if (anchor) list.scrollTop += rows.get(anchor.id).getBoundingClientRect().top - list.getBoundingClientRect().top - anchor.offset;
      }
      const viewport = root.querySelector(".qt-matrix-viewport");
      if (viewport) viewport.scrollLeft = state.x;
      if (focus && state.focus) {
        const document2 = root.ownerDocument;
        const active = document2 == null ? void 0 : document2.activeElement;
        if (active === state.focus.node || !active || active === (document2 == null ? void 0 : document2.body)) {
          let target = state.focus.node;
          if (!root.contains(target)) {
            let scope = root;
            if (state.focus.taskId) scope = [...root.querySelectorAll("[data-task-id]")].find((node) => node.getAttribute("data-task-id") === state.focus.taskId);
            else if (state.focus.quadrant) scope = [...root.querySelectorAll("[data-quadrant]")].find((node) => node.getAttribute("data-quadrant") === state.focus.quadrant);
            target = [...(scope == null ? void 0 : scope.querySelectorAll("input, textarea, button, select")) || []].find((node) => node.className === state.focus.className && (state.focus.taskId || node.getAttribute("aria-label") === state.focus.label));
          }
          if (target && !target.disabled && target !== active) {
            target.focus({ preventScroll: true });
            if (typeof state.focus.start === "number") (_a = target.setSelectionRange) == null ? void 0 : _a.call(target, state.focus.start, state.focus.end);
          }
        }
      }
      if (outer) {
        for (const item of state.outer) {
          if (item.node.isConnected === false) continue;
          item.node.scrollTop = item.top;
          item.node.scrollLeft = item.left;
        }
        const section = state.sectionKey === "root" ? root : state.sectionKey === "completed" ? root.querySelector(".qt-completed-section") : [...root.querySelectorAll("[data-quadrant]")].find((node) => node.getAttribute("data-quadrant") === state.sectionKey);
        const scroller = (_b = state.outer[0]) == null ? void 0 : _b.node;
        if (section && (scroller == null ? void 0 : scroller.isConnected)) scroller.scrollTop += section.getBoundingClientRect().top - state.sectionTop;
      }
    }
    module2.exports = { captureBoardView: captureBoardView2, restoreBoardView: restoreBoardView2 };
  }
});

// src/board-task-updates.js
var require_board_task_updates = __commonJS({
  "src/board-task-updates.js"(exports2, module2) {
    "use strict";
    var { QUADRANTS: QUADRANTS2, getActiveTasks: getActiveTasks2, getCompletedTasks: getCompletedTasks2, completionBounds: completionBounds2 } = require_core();
    function cardContent(task) {
      if (!task) return "";
      const { order, ...content } = task;
      return JSON.stringify(content);
    }
    function reconcileRows(list, tasks, oldTasks, renderRow, emptyText) {
      const existing = new Map([...list.children].map((row) => [row.getAttribute("data-task-id"), row]));
      const retained = /* @__PURE__ */ new Set();
      for (let index = 0; index < tasks.length; index += 1) {
        const task = tasks[index];
        let row = existing.get(task.id);
        if (!row || cardContent(oldTasks.get(task.id)) !== cardContent(task)) row = renderRow(list, task);
        if (list.children[index] !== row) list.insertBefore(row, list.children[index] || null);
        retained.add(row);
      }
      for (const row of [...list.children]) if (!retained.has(row)) row.remove();
      if (!tasks.length) list.createEl("li", { cls: "qt-empty", text: emptyText });
    }
    function updateBoardTasks2(renderer, previousData) {
      const root = renderer.containerEl;
      const oldTasks = new Map(previousData.tasks.map((task) => [task.id, task]));
      const stats = root.querySelector(".qt-stats");
      stats.children[0].textContent = renderer.plugin.t("stats.active", { count: getActiveTasks2(renderer.data).length });
      stats.children[1].textContent = renderer.plugin.t("stats.completed", { count: getCompletedTasks2(renderer.data).length });
      for (const quadrant of QUADRANTS2) {
        const section = root.querySelector(`[data-quadrant="${quadrant}"]`);
        const tasks2 = getActiveTasks2(renderer.data, quadrant);
        section.querySelector(".qt-count").textContent = String(tasks2.length);
        reconcileRows(
          section.querySelector(".qt-task-list"),
          tasks2,
          oldTasks,
          (list2, task) => renderer.renderActiveTask(list2, task),
          renderer.plugin.t("task.empty")
        );
      }
      const completed = getCompletedTasks2(renderer.data, renderer.filters);
      root.querySelector(".qt-completed-count").textContent = `${completed.length} / ${getCompletedTasks2(renderer.data).length}`;
      const valid = completionBounds2(renderer.filters).valid;
      const message = !valid ? "completed.invalidRange" : getCompletedTasks2(renderer.data).length ? "completed.noMatches" : "completed.none";
      const list = root.querySelector(".qt-completed-list");
      const tasks = valid ? completed : [];
      reconcileRows(list, tasks, oldTasks, (parent, task) => renderer.renderCompletedTask(parent, task), renderer.plugin.t(message));
      if (!valid) list.children[0].addClass("qt-filter-error");
    }
    module2.exports = { updateBoardTasks: updateBoardTasks2 };
  }
});

// src/view-handoff.js
var require_view_handoff = __commonJS({
  "src/view-handoff.js"(exports2, module2) {
    "use strict";
    var { captureBoardView: captureBoardView2 } = require_board_view_state();
    var MAX_PENDING_MS = 1e4;
    var SETTLED_MS = 1500;
    function createViewHandoff2(plugin) {
      var _a;
      const entries = /* @__PURE__ */ new Set();
      const workspace = (_a = plugin.app) == null ? void 0 : _a.workspace;
      let disposed = false;
      const findView = (root) => {
        var _a2;
        let found = null;
        (_a2 = workspace == null ? void 0 : workspace.iterateAllLeaves) == null ? void 0 : _a2.call(workspace, (leaf) => {
          var _a3;
          const pane = (_a3 = leaf.view) == null ? void 0 : _a3.containerEl;
          if ((pane == null ? void 0 : pane.ownerDocument) === root.ownerDocument && pane.contains(root)) found = leaf.view;
        });
        return found;
      };
      const remove = (entry) => {
        var _a2, _b;
        if (!entries.delete(entry)) return;
        clearTimeout(entry.timer);
        if (entry.frame !== null) (_b = (_a2 = entry.document.defaultView) == null ? void 0 : _a2.cancelAnimationFrame) == null ? void 0 : _b.call(_a2, entry.frame);
        for (const [type, handler, capture] of entry.listeners) entry.pane.removeEventListener(type, handler, capture);
      };
      const expireAfter = (entry, delay) => {
        var _a2, _b;
        clearTimeout(entry.timer);
        entry.expiresAt = Date.now() + delay;
        entry.timer = setTimeout(() => remove(entry), delay);
        (_b = (_a2 = entry.timer) == null ? void 0 : _a2.unref) == null ? void 0 : _b.call(_a2);
      };
      const visibleDistance = (owner, view) => {
        var _a2, _b;
        const pane = view.containerEl.getBoundingClientRect();
        const top = Math.max(0, pane.top);
        const bottom = Math.min((_b = (_a2 = view.containerEl.ownerDocument.defaultView) == null ? void 0 : _a2.innerHeight) != null ? _b : pane.bottom, pane.bottom);
        const board = owner.containerEl.getBoundingClientRect();
        return bottom > top && board.bottom > top && board.top < bottom ? Math.max(0, board.top - top) : Infinity;
      };
      const remember = (entry) => {
        if (!entry.owner.containerEl.isConnected) return;
        entry.snapshot = captureBoardView2(entry.owner.containerEl);
        if (!entry.outerAuthority || !Number.isFinite(visibleDistance(entry.owner, entry.view))) entry.snapshot.outer = [];
        entry.filters = { ...entry.owner.filters };
        entry.isCollapsed = entry.owner.isCollapsed;
        entry.isCompletedScrollable = entry.owner.isCompletedScrollable;
      };
      const scheduleRefresh = (entry) => {
        if (!entries.has(entry) || entry.frame !== null || !entry.owner.containerEl.isConnected) return;
        const view = entry.document.defaultView;
        if (!(view == null ? void 0 : view.requestAnimationFrame)) {
          remember(entry);
          return;
        }
        entry.frame = view.requestAnimationFrame(() => {
          entry.frame = null;
          if (entries.has(entry)) remember(entry);
        });
      };
      const pruneNavigation = () => {
        var _a2;
        for (const entry of entries) {
          if (Date.now() >= entry.expiresAt || !entry.pane.isConnected || entry.view.containerEl !== entry.pane || ((_a2 = entry.view.file) == null ? void 0 : _a2.path) !== entry.hostPath) remove(entry);
        }
      };
      const events = ["file-open", "layout-change"].map((name) => {
        var _a2;
        return (_a2 = workspace == null ? void 0 : workspace.on) == null ? void 0 : _a2.call(workspace, name, pruneNavigation);
      }).filter(Boolean);
      return {
        armForFile(path) {
          var _a2, _b, _c, _d;
          if (disposed) return () => {
          };
          for (const entry of entries) if (entry.path === path) remove(entry);
          const candidates = [...plugin.boardRenderers].filter((renderer) => renderer.sourcePath === path && renderer.containerEl.isConnected).map((owner) => ({ owner, view: findView(owner.containerEl) })).filter((candidate) => candidate.view);
          const eligible = candidates.filter(({ owner, view }) => candidates.filter((candidate) => candidate.view === view && candidate.owner.boardId === owner.boardId).length === 1);
          const authorities = /* @__PURE__ */ new Map();
          for (const candidate of eligible) {
            const distance = visibleDistance(candidate.owner, candidate.view);
            if (distance < ((_b = (_a2 = authorities.get(candidate.view)) == null ? void 0 : _a2.distance) != null ? _b : Infinity)) authorities.set(candidate.view, { owner: candidate.owner, distance });
          }
          const armed = [];
          for (const { owner, view } of eligible) {
            const entry = {
              owner,
              view,
              pane: view.containerEl,
              path,
              boardId: owner.boardId,
              document: owner.containerEl.ownerDocument,
              hostPath: (_c = view.file) == null ? void 0 : _c.path,
              createdAt: Date.now(),
              drafts: owner.quickAddDrafts,
              listeners: [],
              frame: null,
              outerAuthority: ((_d = authorities.get(view)) == null ? void 0 : _d.owner) === owner
            };
            remember(entry);
            const refresh = () => scheduleRefresh(entry);
            const focusOut = (event) => {
              const clearFocus = () => {
                if (!entries.has(entry) || !owner.containerEl.isConnected) return;
                entry.snapshot.focus = null;
                refresh();
              };
              if (event.relatedTarget) clearFocus();
              else queueMicrotask(clearFocus);
            };
            const intent = () => {
              if (!owner.containerEl.isConnected) remove(entry);
            };
            entry.listeners = [
              ["scroll", refresh, true],
              ["input", refresh, false],
              ["change", refresh, false],
              ["focusin", refresh, false],
              ["focusout", focusOut, false],
              ["wheel", intent, true],
              ["pointerdown", intent, true],
              ["keydown", intent, true]
            ];
            for (const [type, handler, capture] of entry.listeners) entry.pane.addEventListener(type, handler, { capture, passive: true });
            entries.add(entry);
            armed.push(entry);
            expireAfter(entry, MAX_PENDING_MS);
          }
          let finished = false;
          return () => {
            if (finished) return;
            finished = true;
            for (const entry of armed) {
              if (!entries.has(entry)) continue;
              expireAfter(entry, Math.max(0, Math.min(SETTLED_MS, MAX_PENDING_MS - (Date.now() - entry.createdAt))));
            }
          };
        },
        adopt(renderer) {
          if (disposed || !renderer.containerEl.isConnected) return null;
          pruneNavigation();
          const view = findView(renderer.containerEl);
          if (!view) return null;
          const entry = [...entries].find((item) => item.view === view && item.path === renderer.sourcePath && item.boardId === renderer.boardId);
          if (!entry || entry.owner.containerEl.isConnected || entry.document !== renderer.containerEl.ownerDocument) return null;
          const duplicates = [...plugin.boardRenderers].filter((other) => other.containerEl.isConnected && other.sourcePath === renderer.sourcePath && other.boardId === renderer.boardId && findView(other.containerEl) === view);
          if (duplicates.some((other) => other !== renderer)) {
            remove(entry);
            return null;
          }
          renderer.quickAddDrafts = entry.drafts;
          renderer.filters = { ...entry.filters };
          renderer.isCollapsed = entry.isCollapsed;
          renderer.isCompletedScrollable = entry.isCompletedScrollable;
          remove(entry);
          return entry.snapshot;
        },
        dispose() {
          var _a2;
          disposed = true;
          for (const entry of entries) remove(entry);
          for (const event of events) (_a2 = workspace == null ? void 0 : workspace.offref) == null ? void 0 : _a2.call(workspace, event);
        }
      };
    }
    module2.exports = { createViewHandoff: createViewHandoff2 };
  }
});

// src/editor-write.js
var require_editor_write = __commonJS({
  "src/editor-write.js"(exports2, module2) {
    "use strict";
    function readEditorBuffer2(plugin, sourcePath, preferredView) {
      var _a, _b;
      const views = [];
      (_b = (_a = plugin.app.workspace).iterateAllLeaves) == null ? void 0 : _b.call(_a, ({ view: view2 }) => {
        var _a2, _b2;
        if (((_a2 = view2 == null ? void 0 : view2.file) == null ? void 0 : _a2.path) === sourcePath && ((_b2 = view2.getMode) == null ? void 0 : _b2.call(view2)) === "source" && view2.editor) views.push(view2);
      });
      if (!views.length) return null;
      const view = views.includes(preferredView) ? preferredView : views[0];
      const content = view.editor.getValue();
      if (views.some((candidate) => candidate.editor.getValue() !== content)) {
        throw new Error("Open editors have conflicting unsaved buffers; reconcile them before changing this board.");
      }
      return { view, views, content };
    }
    function splitsPair(text, offset) {
      const before = text.charCodeAt(offset - 1);
      const after = text.charCodeAt(offset);
      return before >= 55296 && before <= 56319 && after >= 56320 && after <= 57343 || before === 13 && after === 10;
    }
    function changedRange(before, after) {
      let start = 0;
      while (start < before.length && start < after.length && before[start] === after[start]) start += 1;
      if (splitsPair(before, start) || splitsPair(after, start)) start -= 1;
      let end = before.length;
      let nextEnd = after.length;
      while (end > start && nextEnd > start && before[end - 1] === after[nextEnd - 1]) {
        end -= 1;
        nextEnd -= 1;
      }
      if (splitsPair(before, end) || splitsPair(after, nextEnd)) {
        end += 1;
        nextEnd += 1;
      }
      return { start, end, text: after.slice(start, nextEnd) };
    }
    function tryEditorWrite2(plugin, sourcePath, boardId, updater, preferredView) {
      var _a;
      const buffer = readEditorBuffer2(plugin, sourcePath, preferredView);
      if (!buffer) return null;
      const { view, views, content: before } = buffer;
      const outcome = updater(before, boardId);
      const after = outcome.content;
      if (after !== before) {
        const change = changedRange(before, after);
        const orderedViews = [view, ...views.filter((candidate) => candidate !== view)];
        const editors = [...new Set(orderedViews.map((candidate) => candidate.editor))];
        const cancelGuards = [];
        try {
          for (const candidate of orderedViews) cancelGuards.push((_a = plugin.editorScrollGuards) == null ? void 0 : _a.arm(candidate, after));
          for (const editor of editors) {
            const current = editor.getValue();
            if (current === after) continue;
            if (current !== before) throw new Error("Open editor changed during this operation; resolve the buffer conflict before continuing.");
            editor.transaction({ changes: [{
              from: editor.offsetToPos(change.start),
              to: editor.offsetToPos(change.end),
              text: change.text
            }] }, "eisenhower-matrix");
          }
        } catch (error) {
          for (const cancel of cancelGuards) cancel == null ? void 0 : cancel();
          const partiallyWritten = editors.some((editor) => {
            try {
              return editor.getValue() !== before;
            } catch (e) {
              return true;
            }
          });
          if (partiallyWritten) {
            const partialError = new Error((error == null ? void 0 : error.message) || "An editor write failed after a buffer changed.");
            partialError.code = "EDITOR_PARTIAL_WRITE";
            partialError.cause = error;
            throw partialError;
          }
          throw error;
        }
      }
      return { outcome, view, before, after };
    }
    module2.exports = { readEditorBuffer: readEditorBuffer2, tryEditorWrite: tryEditorWrite2 };
  }
});

// src/editor-scroll-guard.js
var require_editor_scroll_guard = __commonJS({
  "src/editor-scroll-guard.js"(exports2, module2) {
    "use strict";
    var GUARD_MS = 750;
    var MAX_CORRECTIONS = 4;
    var TOLERANCE = 1;
    function createEditorScrollGuards2() {
      const active = /* @__PURE__ */ new Map();
      let disposed = false;
      const supportsEvents = (target) => typeof (target == null ? void 0 : target.addEventListener) === "function" && typeof (target == null ? void 0 : target.removeEventListener) === "function";
      return {
        arm(view, expectedAfter) {
          var _a, _b, _c;
          (_a = active.get(view)) == null ? void 0 : _a();
          const noop = () => {
          };
          if (disposed || typeof expectedAfter !== "string") return noop;
          const root = view == null ? void 0 : view.containerEl, editor = view == null ? void 0 : view.editor;
          const document2 = root == null ? void 0 : root.ownerDocument, window2 = document2 == null ? void 0 : document2.defaultView;
          if (![root, document2, window2].every(supportsEvents) || !window2.requestAnimationFrame || !window2.cancelAnimationFrame || typeof (editor == null ? void 0 : editor.getScrollInfo) !== "function" || typeof (editor == null ? void 0 : editor.scrollTo) !== "function" || typeof (editor == null ? void 0 : editor.getValue) !== "function" || typeof (view == null ? void 0 : view.getMode) !== "function") return noop;
          const visible = () => {
            var _a2, _b2;
            if (!root.isConnected || document2.hidden || window2.closed) return false;
            const rect = (_a2 = root.getBoundingClientRect) == null ? void 0 : _a2.call(root);
            if (rect && (rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0 || rect.top >= window2.innerHeight)) return false;
            return ((_b2 = window2.getComputedStyle) == null ? void 0 : _b2.call(window2, root).visibility) !== "hidden";
          };
          let position, path, mode;
          try {
            path = (_b = view.file) == null ? void 0 : _b.path;
            mode = view.getMode();
            if (!path || mode !== "source" || !visible()) return noop;
            const current = editor.getScrollInfo();
            if (!Number.isFinite(current.top) || !Number.isFinite(current.left)) return noop;
            position = { top: current.top, left: current.left };
          } catch (e) {
            return noop;
          }
          const deadline = Date.now() + GUARD_MS;
          const listeners = [];
          let frame = null, timer = null, stopped = false, corrections = 0;
          const cancel = () => {
            if (stopped) return;
            stopped = true;
            if (frame !== null) window2.cancelAnimationFrame(frame);
            clearTimeout(timer);
            for (const [target, type, handler] of listeners) target.removeEventListener(type, handler, true);
            if (active.get(view) === cancel) active.delete(view);
          };
          const valid = (checkContent) => {
            var _a2;
            return !stopped && Date.now() < deadline && visible() && view.containerEl === root && view.editor === editor && ((_a2 = view.file) == null ? void 0 : _a2.path) === path && view.getMode() === mode && (!checkContent || editor.getValue() === expectedAfter);
          };
          const drifted = () => {
            const current = editor.getScrollInfo();
            return Number.isFinite(current.top) && Number.isFinite(current.left) && (Math.abs(current.top - position.top) > TOLERANCE || Math.abs(current.left - position.left) > TOLERANCE);
          };
          const schedule = () => {
            if (stopped || frame !== null) return;
            frame = window2.requestAnimationFrame(() => {
              frame = null;
              try {
                if (!valid(true)) {
                  cancel();
                  return;
                }
                if (!drifted()) return;
                corrections++;
                editor.scrollTo(position.left, position.top);
                if (corrections >= MAX_CORRECTIONS) cancel();
              } catch (e) {
                cancel();
              }
            });
          };
          const onScroll = () => {
            try {
              if (stopped || Date.now() >= deadline) {
                cancel();
                return;
              }
              if (!drifted()) return;
              if (!valid(false)) {
                cancel();
                return;
              }
              schedule();
            } catch (e) {
              cancel();
            }
          };
          const listen = (target, type, handler) => {
            if (!supportsEvents(target)) return;
            target.addEventListener(type, handler, { capture: true, passive: true });
            listeners.push([target, type, handler]);
          };
          active.set(view, cancel);
          listen(root, "scroll", onScroll);
          for (const target of [document2, window2]) {
            for (const type of ["pointerdown", "touchstart", "wheel", "keydown", "beforeinput", "compositionstart"]) listen(target, type, cancel);
          }
          listen(document2, "visibilitychange", () => {
            if (document2.hidden) cancel();
          });
          listen(window2, "blur", (event) => {
            if (event.target === window2) cancel();
          });
          for (const type of ["pagehide", "resize"]) listen(window2, type, cancel);
          listen(window2.visualViewport, "resize", cancel);
          timer = setTimeout(cancel, GUARD_MS);
          (_c = timer == null ? void 0 : timer.unref) == null ? void 0 : _c.call(timer);
          schedule();
          return cancel;
        },
        dispose() {
          disposed = true;
          for (const cancel of active.values()) cancel();
        }
      };
    }
    module2.exports = { createEditorScrollGuards: createEditorScrollGuards2 };
  }
});

// src/drag-scroll.js
var require_drag_scroll = __commonJS({
  "src/drag-scroll.js"(exports2, module2) {
    "use strict";
    function clamp(value, minimum, maximum) {
      return Math.min(maximum, Math.max(minimum, value));
    }
    function getEdgeScrollVelocity2(position, start, end, edgeSize, maxSpeed) {
      if (!Number.isFinite(position) || end <= start || edgeSize <= 0 || maxSpeed <= 0) return 0;
      const topDepth = clamp((start + edgeSize - position) / edgeSize, 0, 1);
      if (topDepth > 0) return -maxSpeed * topDepth * topDepth;
      const bottomDepth = clamp((position - (end - edgeSize)) / edgeSize, 0, 1);
      if (bottomDepth > 0) return maxSpeed * bottomDepth * bottomDepth;
      return 0;
    }
    function getFrameScrollDelta2(velocity, deltaMs) {
      const clampedDelta = clamp(Number.isFinite(deltaMs) ? deltaMs : 0, 0, 32);
      return velocity * clampedDelta / 1e3;
    }
    function canScrollElement2(element, direction) {
      if (!element || !direction || element.scrollHeight <= element.clientHeight) return false;
      if (direction < 0) return element.scrollTop > 0;
      return element.scrollTop + element.clientHeight < element.scrollHeight - 1;
    }
    module2.exports = {
      canScrollElement: canScrollElement2,
      getEdgeScrollVelocity: getEdgeScrollVelocity2,
      getFrameScrollDelta: getFrameScrollDelta2
    };
  }
});

// src/main.js
var obsidian = require("obsidian");
var {
  MarkdownRenderChild,
  MarkdownView,
  Menu,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  normalizePath,
  setIcon
} = obsidian;
var {
  QUADRANTS,
  completeTask,
  completionBounds,
  createEmptyData,
  deleteTask,
  editTask,
  getActiveTasks,
  getCompletedTasks,
  moveTask,
  normalizeData,
  reorderTask,
  restoreDeletedTask,
  restoreTask
} = require_core();
var {
  BOARD_LANGUAGES,
  DEFAULT_BOARD_TITLE,
  appendBoardCodeBlock,
  createBoardId,
  findBoardCodeBlocks,
  mergeWithoutConflicts,
  mutateBoardDocument,
  parseBoardSource,
  readBoardFromDocument,
  renameBoardDocument,
  renderBoardCodeBlock,
  replaceLegacyManagedBlock,
  updateQuadrantLabelsDocument
} = require_board_store();
var { normalizeLanguageMode, resolveLanguage, translate } = require_i18n();
var { LAYOUT_MODES, getBoardLayout, saveBoardLayout, moveBoardLayouts } = require_layout_preferences();
var { parseTaskMarkdown } = require_markdown_store();
var { TaskEditorModal } = require_task_fields();
var { renderTaskDetails, renderQuickAdd } = require_task_card();
var { captureBoardView, restoreBoardView } = require_board_view_state();
var { updateBoardTasks } = require_board_task_updates();
var { createViewHandoff } = require_view_handoff();
var { readEditorBuffer, tryEditorWrite } = require_editor_write();
var { createEditorScrollGuards } = require_editor_scroll_guard();
var {
  canScrollElement,
  getEdgeScrollVelocity,
  getFrameScrollDelta
} = require_drag_scroll();
var SETTINGS_VERSION = 2;
var DEFAULT_MIGRATION_PATH = "Quadrant Tasks.md";
var LEGACY_BOARD_ID = "board-migrated-global";
var LEGACY_JSON_BACKUP = "data-backup-1.0.0.json";
var LEGACY_NOTE_BACKUP = "global-note-backup-1.1.0.md";
var LEGACY_VIEW_TYPE = "quadrant-tasks-view";
var QUADRANT_META = {
  do: { icon: "zap" },
  schedule: { icon: "calendar-clock" },
  delegate: { icon: "users" },
  eliminate: { icon: "archive" }
};
var PERIODS = ["all", "today", "7d", "30d", "custom"];
var LIST_SCROLL_EDGE = 48;
var PAGE_SCROLL_EDGE_MOUSE = 72;
var PAGE_SCROLL_EDGE_TOUCH = 96;
var LIST_SCROLL_MAX_SPEED = 720;
var PAGE_SCROLL_MAX_SPEED = 960;
var getAppLanguage = typeof obsidian.getLanguage === "function" ? obsidian.getLanguage : () => {
  var _a, _b;
  return ((_b = (_a = globalThis.document) == null ? void 0 : _a.documentElement) == null ? void 0 : _b.lang) || "en";
};
function cloneData(data) {
  return normalizeData(JSON.parse(JSON.stringify(data)));
}
function createIconButton(parent, icon, label, onClick, className = "") {
  const button = parent.createEl("button", {
    cls: `clickable-icon qt-icon-button ${className}`.trim(),
    attr: { "aria-label": label, title: label, type: "button" }
  });
  setIcon(button, icon);
  button.addEventListener("click", onClick);
  return button;
}
function autoSizeTaskTextarea(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}
function normalizeTaskTitle(value) {
  return String(value || "").replace(/\s*[\r\n]+\s*/g, " ").trim();
}
function focusAfterRender(container, selector) {
  const schedule = globalThis.requestAnimationFrame || ((callback) => callback());
  schedule(() => {
    var _a;
    return (_a = container.querySelector(selector)) == null ? void 0 : _a.focus();
  });
}
function formatCompletedAt(value, language) {
  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
var TextInputModal = class extends Modal {
  constructor(plugin, title, onSave, options = {}) {
    super(plugin.app);
    this.plugin = plugin;
    this.title = title;
    this.onSave = onSave;
    this.modalTitleKey = options.modalTitleKey || "modal.editTask";
    this.inputLabelKey = options.inputLabelKey || "modal.taskContent";
    this.maxLength = options.maxLength || null;
    this.multiline = options.multiline !== false;
  }
  onOpen() {
    this.setTitle(this.plugin.t(this.modalTitleKey));
    const input = this.multiline ? this.contentEl.createEl("textarea", {
      cls: "qt-modal-input qt-task-textarea",
      attr: { rows: "1", "aria-label": this.plugin.t(this.inputLabelKey) }
    }) : this.contentEl.createEl("input", {
      cls: "qt-modal-input",
      attr: { type: "text", value: this.title, "aria-label": this.plugin.t(this.inputLabelKey) }
    });
    if (this.multiline) input.value = this.title;
    if (this.maxLength) input.maxLength = this.maxLength;
    const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
    const cancel = actions.createEl("button", { text: this.plugin.t("common.cancel") });
    const save = actions.createEl("button", { text: this.plugin.t("common.save"), cls: "mod-cta" });
    let isSubmitting = false;
    const submit = async () => {
      if (isSubmitting) return;
      const value = this.multiline ? normalizeTaskTitle(input.value) : input.value.trim();
      if (!value) {
        input.addClass("qt-input-error");
        return;
      }
      isSubmitting = true;
      save.disabled = true;
      try {
        await this.onSave(value);
        this.close();
      } catch (error) {
        input.addClass("qt-input-error");
        console.error("Failed to save matrix text input", error);
      } finally {
        isSubmitting = false;
        save.disabled = false;
      }
    };
    input.addEventListener("input", () => {
      input.removeClass("qt-input-error");
      if (this.multiline) autoSizeTaskTextarea(input);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.isComposing) return;
      event.preventDefault();
      event.stopPropagation();
      void submit();
    });
    cancel.addEventListener("click", () => this.close());
    save.addEventListener("click", () => void submit());
    requestAnimationFrame(() => {
      if (this.multiline) autoSizeTaskTextarea(input);
      input.focus();
      input.select();
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};
var QuadrantLabelsModal = class extends Modal {
  constructor(plugin, labels, onSave, onReset) {
    super(plugin.app);
    this.plugin = plugin;
    this.labels = labels;
    this.onSave = onSave;
    this.onReset = onReset;
  }
  onOpen() {
    this.setTitle(this.plugin.t("modal.editQuadrant"));
    const createField = (key, value, maxLength) => {
      const field = this.contentEl.createDiv({ cls: "qt-modal-field" });
      const inputId = `qt-${key}-input`;
      field.createEl("label", { text: this.plugin.t(`modal.${key}`), attr: { for: inputId } });
      const input = field.createEl("input", {
        cls: "qt-modal-input",
        attr: { id: inputId, type: "text", value, maxlength: String(maxLength) }
      });
      input.addEventListener("input", () => input.removeClass("qt-input-error"));
      return input;
    };
    const titleInput = createField("quadrantTitle", this.labels.title, 120);
    const subtitleInput = createField("quadrantSubtitle", this.labels.subtitle, 160);
    const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
    const reset = actions.createEl("button", { text: this.plugin.t("modal.restoreQuadrantDefaults") });
    const cancel = actions.createEl("button", { text: this.plugin.t("common.cancel") });
    const save = actions.createEl("button", { text: this.plugin.t("common.save"), cls: "mod-cta" });
    const submit = () => {
      const title = titleInput.value.trim();
      const subtitle = subtitleInput.value.trim();
      if (!title) titleInput.addClass("qt-input-error");
      if (!subtitle) subtitleInput.addClass("qt-input-error");
      if (!title || !subtitle) return;
      this.onSave({ title, subtitle });
      this.close();
    };
    for (const input of [titleInput, subtitleInput]) {
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.isComposing) submit();
      });
    }
    reset.addEventListener("click", () => {
      this.onReset();
      this.close();
    });
    cancel.addEventListener("click", () => this.close());
    save.addEventListener("click", submit);
    requestAnimationFrame(() => {
      titleInput.focus();
      titleInput.select();
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};
var MatrixBoardRenderChild = class extends MarkdownRenderChild {
  constructor(containerEl, plugin, sourcePath, source) {
    super(containerEl);
    this.plugin = plugin;
    this.sourcePath = sourcePath;
    const parsed = parseBoardSource(source);
    this.boardId = parsed.boardId;
    this.boardTitle = parsed.title;
    this.quadrantLabels = parsed.quadrantLabels;
    this.data = parsed.data;
    this.issues = parsed.issues;
    this.filters = { quadrant: "all", period: "today", startDate: "", endDate: "" };
    this.quickAddDrafts = /* @__PURE__ */ new Map();
    this.quickAddControls = [];
    this.quickAddForms = /* @__PURE__ */ new Map();
    this.pendingRender = false;
    this.composingInputs = /* @__PURE__ */ new Set();
    this.handleCompositionStart = (event) => this.composingInputs.add(event.target);
    this.handleCompositionEnd = (event) => {
      this.composingInputs.delete(event.target);
      this.flushPendingRender();
    };
    this.flushPendingRender = () => queueMicrotask(() => {
      if (this.pendingRender && this.plugin.boardRenderers.has(this)) this.render();
    });
    this.calendarDay = (/* @__PURE__ */ new Date()).toDateString();
    this.handleDayChange = () => this.refreshCalendarDay();
    this.draggedTaskId = null;
    this.dragSourceRow = null;
    this.dragInputType = null;
    this.dragPoint = null;
    this.dragTarget = null;
    this.dragFrame = null;
    this.dragFrameTime = 0;
    this.pointerDrag = null;
    this.dragPreview = null;
    this.handleDocumentDragOver = (event) => {
      if (this.draggedTaskId) this.updateDragPoint(event.clientX, event.clientY);
    };
    this.handleDragInterruption = () => this.finishDrag(false);
    this.handleVisibilityChange = () => {
      var _a;
      if ((_a = this.getOwnerDocument()) == null ? void 0 : _a.hidden) this.finishDrag(false);
      else this.refreshCalendarDay();
    };
    this.isCollapsed = false;
    this.isCompletedScrollable = true;
    this.layoutMode = getBoardLayout(plugin.app, sourcePath, this.boardId);
  }
  onload() {
    var _a, _b, _c, _d, _e;
    this.plugin.boardRenderers.add(this);
    const handoff = (_a = this.plugin.viewHandoff) == null ? void 0 : _a.adopt(this);
    this.containerEl.addEventListener("compositionstart", this.handleCompositionStart);
    this.containerEl.addEventListener("compositionend", this.handleCompositionEnd);
    for (const event of ["input", "change", "compositionend", "focusout"]) this.containerEl.addEventListener(event, this.flushPendingRender);
    const document2 = this.getOwnerDocument();
    document2 == null ? void 0 : document2.addEventListener("dragover", this.handleDocumentDragOver, true);
    document2 == null ? void 0 : document2.addEventListener("visibilitychange", this.handleVisibilityChange);
    (_b = document2 == null ? void 0 : document2.defaultView) == null ? void 0 : _b.addEventListener("blur", this.handleDragInterruption);
    (_c = document2 == null ? void 0 : document2.defaultView) == null ? void 0 : _c.addEventListener("focus", this.handleDayChange);
    this.calendarTimer = (_e = (_d = document2 == null ? void 0 : document2.defaultView) == null ? void 0 : _d.setInterval) == null ? void 0 : _e.call(_d, this.handleDayChange, 6e4);
    this.render();
    restoreBoardView(this.containerEl, handoff);
  }
  onunload() {
    var _a, _b, _c;
    this.quickAddForms.clear();
    this.containerEl.removeEventListener("compositionstart", this.handleCompositionStart);
    this.containerEl.removeEventListener("compositionend", this.handleCompositionEnd);
    this.composingInputs.clear();
    for (const event of ["input", "change", "compositionend", "focusout"]) this.containerEl.removeEventListener(event, this.flushPendingRender);
    for (const control of this.quickAddControls) control.destroy();
    const document2 = this.getOwnerDocument();
    document2 == null ? void 0 : document2.removeEventListener("dragover", this.handleDocumentDragOver, true);
    document2 == null ? void 0 : document2.removeEventListener("visibilitychange", this.handleVisibilityChange);
    (_a = document2 == null ? void 0 : document2.defaultView) == null ? void 0 : _a.removeEventListener("blur", this.handleDragInterruption);
    (_b = document2 == null ? void 0 : document2.defaultView) == null ? void 0 : _b.removeEventListener("focus", this.handleDayChange);
    if (this.calendarTimer != null) (_c = document2 == null ? void 0 : document2.defaultView) == null ? void 0 : _c.clearInterval(this.calendarTimer);
    this.finishDrag(false);
    this.plugin.boardRenderers.delete(this);
  }
  getOwnerDocument() {
    return this.containerEl.ownerDocument || globalThis.document || null;
  }
  refreshCalendarDay(now = /* @__PURE__ */ new Date()) {
    const day = now.toDateString();
    if (day === this.calendarDay || this.draggedTaskId) return;
    this.calendarDay = day;
    this.render();
  }
  setBoardData(data, title = this.boardTitle, quadrantLabels = this.quadrantLabels) {
    const nextData = cloneData(data);
    const structuralChange = this.issues.length || this.boardTitle !== (title || DEFAULT_BOARD_TITLE) || JSON.stringify(this.quadrantLabels) !== JSON.stringify(quadrantLabels || {});
    if (!structuralChange && JSON.stringify(this.data) === JSON.stringify(nextData)) return;
    const previousData = this.data;
    const view = captureBoardView(this.containerEl);
    this.data = nextData;
    this.boardTitle = title || DEFAULT_BOARD_TITLE;
    this.quadrantLabels = JSON.parse(JSON.stringify(quadrantLabels || {}));
    this.issues = [];
    if (!structuralChange && !this.isCollapsed && this.containerEl.querySelector(".qt-matrix")) {
      updateBoardTasks(this, previousData);
      restoreBoardView(this.containerEl, view);
    } else this.render();
  }
  setBoardError(error) {
    this.issues = [error.message || String(error)];
    this.render();
  }
  async mutate(mutator) {
    if (!this.boardId || this.issues.length) return null;
    const outcome = await this.plugin.mutateBoard(this.sourcePath, this.boardId, mutator, this.containerEl);
    return (outcome == null ? void 0 : outcome.result) || null;
  }
  render() {
    if (this.composingInputs.size || [...this.containerEl.querySelectorAll("input")].some((input) => {
      var _a;
      return (_a = input.validity) == null ? void 0 : _a.badInput;
    }) || this.quickAddControls.some((control) => {
      var _a;
      return (_a = control.isEditing) == null ? void 0 : _a.call(control);
    })) {
      this.pendingRender = true;
      return;
    }
    this.pendingRender = false;
    const view = this.containerEl.children.length ? captureBoardView(this.containerEl) : null;
    this.renderContents();
    restoreBoardView(this.containerEl, view);
  }
  syncQuickAddForms() {
    const view = captureBoardView(this.containerEl);
    for (const form of this.quickAddForms.values()) form.sync();
    restoreBoardView(this.containerEl, view);
  }
  renderContents() {
    for (const control of this.quickAddControls) control.destroy();
    this.quickAddControls = [];
    this.quickAddForms.clear();
    const container = this.containerEl;
    container.empty();
    container.addClass("qt-root", "qt-embed");
    container.setAttribute("data-layout", this.layoutMode);
    if (!this.boardId || this.issues.length) {
      container.createDiv({
        cls: "qt-storage-error",
        text: this.plugin.t("board.invalid")
      });
      return;
    }
    this.renderHeader(container);
    if (this.isCollapsed) {
      this.renderSummary(container);
      return;
    }
    container.createDiv({ cls: "qt-layout-hint", text: this.plugin.t("board.layoutHint") });
    const viewport = container.createDiv({
      cls: "qt-matrix-viewport",
      attr: { tabindex: "0", role: "region", "aria-label": this.plugin.t("board.quadrantArea") }
    });
    const matrix = viewport.createDiv({ cls: "qt-matrix" });
    for (const quadrant of QUADRANTS) this.renderQuadrant(matrix, quadrant);
    this.renderCompleted(container);
  }
  renderHeader(container) {
    const header = container.createEl("header", { cls: "qt-page-header" });
    const titleGroup = header.createDiv({ cls: "qt-title-group" });
    const titleRow = titleGroup.createDiv({ cls: "qt-title-row" });
    titleRow.createEl("h3", { text: this.boardTitle });
    createIconButton(titleRow, "pencil", this.plugin.t("board.editTitle"), () => this.openBoardTitleEditor(), "qt-title-edit");
    const stats = titleGroup.createDiv({ cls: "qt-stats", attr: { "aria-live": "polite" } });
    stats.createSpan({ text: this.plugin.t("stats.active", { count: getActiveTasks(this.data).length }) });
    stats.createSpan({ text: this.plugin.t("stats.completed", { count: getCompletedTasks(this.data).length }) });
    const actions = header.createDiv({ cls: "qt-board-actions" });
    const layout = actions.createEl("select", {
      cls: "qt-layout-select",
      attr: { "aria-label": this.plugin.t("board.layout"), title: this.plugin.t("board.layout") }
    });
    for (const mode of LAYOUT_MODES) {
      layout.createEl("option", { text: this.plugin.t(`board.layout.${mode}`), attr: { value: mode } });
    }
    layout.value = this.layoutMode;
    layout.addEventListener("change", () => {
      if (!LAYOUT_MODES.includes(layout.value)) return;
      try {
        saveBoardLayout(this.plugin.app, this.sourcePath, this.boardId, layout.value);
        for (const renderer of this.plugin.boardRenderers) {
          if (renderer.sourcePath !== this.sourcePath || renderer.boardId !== this.boardId) continue;
          renderer.layoutMode = layout.value;
          renderer.containerEl.setAttribute("data-layout", layout.value);
          const select = renderer.containerEl.querySelector(".qt-layout-select");
          if (select) select.value = layout.value;
        }
      } catch (error) {
        layout.value = this.layoutMode;
        console.error("Eisenhower Matrix Blocks could not save local layout preferences", error);
        new Notice(this.plugin.t("notice.layoutSaveFailed"), 1e4);
      }
    });
    const toggleLabel = this.plugin.t(this.isCollapsed ? "board.expand" : "board.collapse");
    const toggle = createIconButton(
      actions,
      this.isCollapsed ? "chevron-down" : "chevron-up",
      toggleLabel,
      () => {
        this.isCollapsed = !this.isCollapsed;
        this.render();
        focusAfterRender(this.containerEl, ".qt-board-toggle");
      },
      "qt-board-toggle"
    );
    toggle.setAttribute("aria-expanded", String(!this.isCollapsed));
  }
  renderSummary(container) {
    const summary = container.createEl("ul", {
      cls: "qt-board-summary",
      attr: { "aria-label": this.plugin.t("board.summary") }
    });
    for (const quadrant of QUADRANTS) {
      const item = summary.createEl("li");
      item.createSpan({ text: this.getQuadrantName(quadrant), cls: "qt-summary-label" });
      item.createSpan({ text: String(getActiveTasks(this.data, quadrant).length), cls: "qt-summary-count" });
    }
    const completed = summary.createEl("li", { cls: "qt-summary-completed" });
    completed.createSpan({
      text: this.plugin.t("stats.completed", { count: getCompletedTasks(this.data).length }),
      cls: "qt-summary-label"
    });
  }
  clearDropIndicators() {
    this.containerEl.querySelectorAll(".qt-drop-target, .qt-drop-before, .qt-drop-after").forEach((element) => {
      element.removeClass("qt-drop-target", "qt-drop-before", "qt-drop-after");
    });
  }
  clearDragTarget() {
    if (!this.dragTarget) return;
    this.clearDropIndicators();
    this.dragTarget = null;
  }
  beginDrag(taskId, row, inputType) {
    if (this.draggedTaskId) this.finishDrag(false);
    this.draggedTaskId = taskId;
    this.dragSourceRow = row;
    this.dragInputType = inputType;
    row.addClass("qt-dragging");
  }
  updateDragPoint(clientX, clientY, refreshImmediately = false) {
    if (!this.draggedTaskId || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return;
    this.dragPoint = { x: clientX, y: clientY };
    this.updateDragPreview();
    if (refreshImmediately) this.refreshDragTargetAtPoint();
    this.scheduleDragFrame();
  }
  scheduleDragFrame() {
    var _a;
    if (this.dragFrame !== null || !this.draggedTaskId) return;
    const view = ((_a = this.getOwnerDocument()) == null ? void 0 : _a.defaultView) || globalThis;
    if (typeof view.requestAnimationFrame !== "function") return;
    this.dragFrame = view.requestAnimationFrame((timestamp) => this.runDragFrame(timestamp));
  }
  runDragFrame(timestamp) {
    this.dragFrame = null;
    if (!this.draggedTaskId || !this.dragPoint) return;
    this.refreshDragTargetAtPoint();
    const deltaMs = this.dragFrameTime ? timestamp - this.dragFrameTime : 16;
    this.dragFrameTime = timestamp;
    const scroll = this.resolveAutoScroll();
    const horizontal = this.resolveHorizontalAutoScroll();
    if (!scroll && !horizontal) return;
    if (scroll) scroll.element.scrollTop += getFrameScrollDelta(scroll.velocity, deltaMs);
    if (horizontal) horizontal.element.scrollLeft += getFrameScrollDelta(horizontal.velocity, deltaMs);
    this.refreshDragTargetAtPoint();
    this.scheduleDragFrame();
  }
  resolveHorizontalAutoScroll() {
    var _a, _b, _c;
    const document2 = this.getOwnerDocument();
    const point = this.dragPoint;
    const viewport = this.containerEl.querySelector(".qt-matrix-viewport");
    if (!document2 || !point || !viewport || viewport.scrollWidth <= viewport.clientWidth) return null;
    const bounds = viewport.getBoundingClientRect();
    const left = Math.max(0, bounds.left);
    const right = Math.min((_b = (_a = document2.defaultView) == null ? void 0 : _a.innerWidth) != null ? _b : bounds.right, bounds.right);
    if (point.x < left || point.x > right || point.y < bounds.top || point.y > bounds.bottom) return null;
    if (!viewport.contains((_c = document2.elementFromPoint) == null ? void 0 : _c.call(document2, point.x, point.y))) return null;
    const velocity = getEdgeScrollVelocity(point.x, left, right, LIST_SCROLL_EDGE, LIST_SCROLL_MAX_SPEED);
    if (velocity < 0 && viewport.scrollLeft > 0 || velocity > 0 && viewport.scrollLeft + viewport.clientWidth < viewport.scrollWidth - 1) {
      return { element: viewport, velocity };
    }
    return null;
  }
  resolveAutoScroll() {
    var _a, _b, _c;
    const document2 = this.getOwnerDocument();
    const point = this.dragPoint;
    if (!document2 || !point) return null;
    const hit = (_a = document2.elementFromPoint) == null ? void 0 : _a.call(document2, point.x, point.y);
    const taskList = (_b = hit == null ? void 0 : hit.closest) == null ? void 0 : _b.call(hit, ".qt-task-list");
    if (taskList && this.containerEl.contains(taskList)) {
      const bounds = taskList.getBoundingClientRect();
      const velocity = getEdgeScrollVelocity(point.y, bounds.top, bounds.bottom, LIST_SCROLL_EDGE, LIST_SCROLL_MAX_SPEED);
      if (canScrollElement(taskList, Math.sign(velocity))) return { element: taskList, velocity };
    }
    const edgeSize = this.dragInputType === "pointer" ? PAGE_SCROLL_EDGE_TOUCH : PAGE_SCROLL_EDGE_MOUSE;
    for (let element = hit || this.containerEl.parentElement; element; element = element.parentElement) {
      if (element === taskList || !((_c = element.contains) == null ? void 0 : _c.call(element, this.containerEl)) || !this.isScrollableElement(element)) continue;
      const bounds = element.getBoundingClientRect();
      const velocity = getEdgeScrollVelocity(point.y, bounds.top, bounds.bottom, edgeSize, PAGE_SCROLL_MAX_SPEED);
      if (canScrollElement(element, Math.sign(velocity))) return { element, velocity };
    }
    const scrollingElement = document2.scrollingElement;
    const view = document2.defaultView;
    if (scrollingElement && view) {
      const velocity = getEdgeScrollVelocity(point.y, 0, view.innerHeight, edgeSize, PAGE_SCROLL_MAX_SPEED);
      if (canScrollElement(scrollingElement, Math.sign(velocity))) return { element: scrollingElement, velocity };
    }
    return null;
  }
  isScrollableElement(element) {
    var _a, _b;
    if (!element || element.scrollHeight <= element.clientHeight) return false;
    const view = (_a = element.ownerDocument) == null ? void 0 : _a.defaultView;
    const overflowY = ((_b = view == null ? void 0 : view.getComputedStyle) == null ? void 0 : _b.call(view, element).overflowY) || "";
    return /auto|scroll|overlay/.test(overflowY);
  }
  refreshDragTargetAtPoint() {
    var _a, _b, _c, _d;
    const document2 = this.getOwnerDocument();
    const point = this.dragPoint;
    if (!document2 || !point) return;
    const hit = (_a = document2.elementFromPoint) == null ? void 0 : _a.call(document2, point.x, point.y);
    let row = (_b = hit == null ? void 0 : hit.closest) == null ? void 0 : _b.call(hit, ".qt-task-row");
    const list = (_c = hit == null ? void 0 : hit.closest) == null ? void 0 : _c.call(hit, ".qt-task-list");
    if (!row && list && this.containerEl.contains(list)) {
      const rows = list.querySelectorAll(".qt-task-row");
      for (let index = 1; index < rows.length; index += 1) {
        const previous = rows[index - 1].getBoundingClientRect();
        const next = rows[index].getBoundingClientRect();
        if (point.y >= previous.bottom && point.y <= next.top && point.x >= next.left && point.x <= next.right) {
          row = rows[index];
          break;
        }
      }
    }
    if (row && this.containerEl.contains(row)) {
      if (row.getAttribute("data-task-id") === this.draggedTaskId) {
        this.clearDragTarget();
        return;
      }
      const quadrantElement2 = row.closest(".qt-quadrant");
      this.setDragTarget({
        quadrant: quadrantElement2 == null ? void 0 : quadrantElement2.getAttribute("data-quadrant"),
        taskId: row.getAttribute("data-task-id"),
        placement: this.getDropPlacementAtY(point.y, row),
        element: row
      });
      return;
    }
    const quadrantElement = (_d = hit == null ? void 0 : hit.closest) == null ? void 0 : _d.call(hit, ".qt-quadrant");
    if (quadrantElement && this.containerEl.contains(quadrantElement)) {
      this.setDragTarget({
        quadrant: quadrantElement.getAttribute("data-quadrant"),
        taskId: null,
        placement: "after",
        element: quadrantElement
      });
      return;
    }
    this.clearDragTarget();
  }
  setDragTarget(target) {
    if (!(target == null ? void 0 : target.quadrant)) return;
    const currentKey = this.dragTarget ? `${this.dragTarget.quadrant}:${this.dragTarget.taskId || "end"}:${this.dragTarget.placement}` : "";
    const nextKey = `${target.quadrant}:${target.taskId || "end"}:${target.placement}`;
    if (currentKey === nextKey) return;
    this.clearDropIndicators();
    this.dragTarget = target;
    if (target.taskId) target.element.addClass(target.placement === "before" ? "qt-drop-before" : "qt-drop-after");
    else target.element.addClass("qt-drop-target");
  }
  getDropPlacementAtY(clientY, row) {
    const bounds = row.getBoundingClientRect();
    return clientY < bounds.top + bounds.height / 2 ? "before" : "after";
  }
  finishDrag(commit) {
    var _a, _b, _c;
    const taskId = this.draggedTaskId;
    const target = this.dragTarget;
    const view = ((_a = this.getOwnerDocument()) == null ? void 0 : _a.defaultView) || globalThis;
    if (this.dragFrame !== null && typeof view.cancelAnimationFrame === "function") view.cancelAnimationFrame(this.dragFrame);
    this.dragFrame = null;
    this.dragFrameTime = 0;
    (_b = this.dragSourceRow) == null ? void 0 : _b.removeClass("qt-dragging");
    (_c = this.dragPreview) == null ? void 0 : _c.remove();
    this.dragPreview = null;
    this.clearDropIndicators();
    this.draggedTaskId = null;
    this.dragSourceRow = null;
    this.dragInputType = null;
    this.dragPoint = null;
    this.dragTarget = null;
    this.pointerDrag = null;
    if (!commit || !taskId || !target) return;
    if (target.taskId && target.taskId !== taskId) {
      void this.mutate((data) => reorderTask(data, taskId, target.quadrant, target.taskId, target.placement));
    } else if (!target.taskId) {
      void this.mutate((data) => reorderTask(data, taskId, target.quadrant, null, "after"));
    }
  }
  createDragPreview(title) {
    const document2 = this.getOwnerDocument();
    if (!(document2 == null ? void 0 : document2.body)) return;
    const preview = document2.createElement("div");
    preview.className = "qt-drag-preview";
    preview.textContent = title;
    preview.setAttribute("aria-hidden", "true");
    document2.body.appendChild(preview);
    this.dragPreview = preview;
    this.updateDragPreview();
  }
  updateDragPreview() {
    if (!this.dragPreview || !this.dragPoint) return;
    this.dragPreview.style.transform = `translate3d(${this.dragPoint.x + 14}px, ${this.dragPoint.y + 14}px, 0)`;
  }
  startPointerDrag(event, task, row, handle) {
    var _a;
    if (!/touch|pen/.test(event.pointerType || "") || event.button > 0) return;
    event.preventDefault();
    this.pointerDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      task,
      row,
      handle,
      active: false
    };
    (_a = handle.setPointerCapture) == null ? void 0 : _a.call(handle, event.pointerId);
  }
  movePointerDrag(event) {
    const pointer = this.pointerDrag;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY);
    if (!pointer.active && distance < 6) return;
    event.preventDefault();
    if (!pointer.active) {
      pointer.active = true;
      this.beginDrag(pointer.task.id, pointer.row, "pointer");
      this.pointerDrag = pointer;
      this.createDragPreview(pointer.task.title);
    }
    this.updateDragPoint(event.clientX, event.clientY);
  }
  endPointerDrag(event, commit) {
    var _a, _b;
    const pointer = this.pointerDrag;
    if (!pointer || pointer.pointerId !== event.pointerId) return false;
    if (pointer.active) this.updateDragPoint(event.clientX, event.clientY, true);
    this.pointerDrag = null;
    (_b = (_a = pointer.handle).releasePointerCapture) == null ? void 0 : _b.call(_a, event.pointerId);
    this.finishDrag(commit && pointer.active);
    return pointer.active;
  }
  getQuadrantPresentation(quadrant) {
    const defaults = this.plugin.getQuadrantMeta(quadrant);
    const custom = this.quadrantLabels[quadrant];
    return {
      icon: defaults.icon,
      title: (custom == null ? void 0 : custom.title) || defaults.description,
      subtitle: (custom == null ? void 0 : custom.subtitle) || defaults.action
    };
  }
  getQuadrantName(quadrant) {
    return this.getQuadrantPresentation(quadrant).title;
  }
  renderQuadrant(matrix, quadrant) {
    const meta = this.getQuadrantPresentation(quadrant);
    const quadrantName = meta.title;
    const tasks = getActiveTasks(this.data, quadrant);
    const section = matrix.createEl("section", {
      cls: `qt-quadrant qt-quadrant-${quadrant}`,
      attr: { "data-quadrant": quadrant, "aria-label": `${quadrantName}, ${meta.subtitle}` }
    });
    const header = section.createEl("header", { cls: "qt-quadrant-header" });
    const heading = header.createDiv({ cls: "qt-quadrant-heading" });
    const icon = heading.createSpan({ cls: "qt-quadrant-icon", attr: { "aria-hidden": "true" } });
    setIcon(icon, meta.icon);
    const labels = heading.createDiv({ cls: "qt-quadrant-labels" });
    const title = labels.createEl("h3", { text: quadrantName });
    title.createSpan({ text: String(tasks.length), cls: "qt-count" });
    labels.createDiv({ text: meta.subtitle, cls: "qt-quadrant-description" });
    createIconButton(
      header,
      "pencil",
      this.plugin.t("board.editQuadrant", { quadrant: quadrantName }),
      () => this.openQuadrantLabelsEditor(quadrant),
      "qt-quadrant-edit"
    );
    renderQuickAdd(section, this, quadrant, quadrantName);
    section.createDiv({ cls: "qt-task-divider", attr: { "aria-hidden": "true" } });
    const list = section.createEl("ul", { cls: "qt-task-list" });
    if (tasks.length === 0) list.createEl("li", { text: this.plugin.t("task.empty"), cls: "qt-empty" });
    else for (const task of tasks) this.renderActiveTask(list, task);
    section.addEventListener("dragover", (event) => {
      if (!this.draggedTaskId) return;
      event.preventDefault();
      this.updateDragPoint(event.clientX, event.clientY);
    });
    section.addEventListener("dragleave", (event) => {
      var _a;
      if (!section.contains(event.relatedTarget) && ((_a = this.dragTarget) == null ? void 0 : _a.element) === section) {
        this.clearDragTarget();
      }
    });
    section.addEventListener("drop", (event) => {
      event.preventDefault();
      this.updateDragPoint(event.clientX, event.clientY, true);
      this.finishDrag(true);
    });
  }
  renderActiveTask(list, task) {
    const row = list.createEl("li", {
      cls: "qt-task-row",
      attr: { draggable: "true", "data-task-id": task.id }
    });
    const checkbox = row.createEl("input", {
      cls: "qt-task-checkbox",
      attr: { type: "checkbox", "aria-label": this.plugin.t("task.complete", { title: task.title }) }
    });
    checkbox.addEventListener("change", () => void this.complete(task.id));
    const title = row.createEl("button", {
      cls: "qt-task-title",
      attr: { type: "button", title: this.plugin.t("task.edit") }
    });
    title.createSpan({ text: task.title, cls: "qt-task-name" });
    renderTaskDetails(title, task, this.plugin);
    title.addEventListener("click", () => this.openEditor(task));
    const actions = row.createDiv({ cls: "qt-task-actions" });
    let suppressNextHandleClick = false;
    const dragHandle = createIconButton(
      actions,
      "grip-vertical",
      this.plugin.t("task.drag", { title: task.title }),
      (event) => {
        if (suppressNextHandleClick) {
          suppressNextHandleClick = false;
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        this.openTaskMenu(event, task);
      },
      "qt-drag-handle"
    );
    dragHandle.addEventListener("pointerdown", (event) => {
      suppressNextHandleClick = false;
      this.startPointerDrag(event, task, row, dragHandle);
    }, { passive: false });
    dragHandle.addEventListener("keydown", () => {
      suppressNextHandleClick = false;
    });
    dragHandle.addEventListener("pointermove", (event) => this.movePointerDrag(event), { passive: false });
    dragHandle.addEventListener("pointerup", (event) => {
      if (this.endPointerDrag(event, true)) suppressNextHandleClick = true;
    });
    dragHandle.addEventListener("pointercancel", (event) => this.endPointerDrag(event, false));
    dragHandle.addEventListener("lostpointercapture", (event) => this.endPointerDrag(event, false));
    createIconButton(actions, "more-horizontal", this.plugin.t("task.more"), (event) => this.openTaskMenu(event, task), "qt-task-more");
    row.addEventListener("dragstart", (event) => {
      var _a;
      this.beginDrag(task.id, row, "mouse");
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
      (_a = event.dataTransfer) == null ? void 0 : _a.setData("text/plain", task.id);
    });
    row.addEventListener("dragover", (event) => {
      if (!this.draggedTaskId || this.draggedTaskId === task.id) return;
      event.preventDefault();
      event.stopPropagation();
      this.updateDragPoint(event.clientX, event.clientY);
    });
    row.addEventListener("dragleave", (event) => {
      var _a;
      if (!row.contains(event.relatedTarget) && ((_a = this.dragTarget) == null ? void 0 : _a.element) === row) {
        this.clearDragTarget();
      }
    });
    row.addEventListener("drop", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.updateDragPoint(event.clientX, event.clientY, true);
      this.finishDrag(true);
    });
    row.addEventListener("dragend", () => {
      this.finishDrag(false);
    });
    return row;
  }
  openEditor(task) {
    new TaskEditorModal(this.plugin, task, async (title, details) => {
      const result = await this.mutate((data) => editTask(data, task.id, title, details));
      if (!result) throw new Error("Task update did not complete");
    }).open();
  }
  openBoardTitleEditor() {
    new TextInputModal(this.plugin, this.boardTitle, (title) => this.plugin.renameBoard(this.sourcePath, this.boardId, title, this.containerEl), {
      modalTitleKey: "modal.editTitle",
      inputLabelKey: "modal.matrixTitle",
      maxLength: 120,
      multiline: false
    }).open();
  }
  openQuadrantLabelsEditor(quadrant) {
    const labels = this.getQuadrantPresentation(quadrant);
    new QuadrantLabelsModal(
      this.plugin,
      { title: labels.title, subtitle: labels.subtitle },
      (value) => void this.plugin.updateQuadrantLabels(this.sourcePath, this.boardId, quadrant, value, this.containerEl),
      () => void this.plugin.updateQuadrantLabels(this.sourcePath, this.boardId, quadrant, null, this.containerEl)
    ).open();
  }
  openTaskMenu(event, task) {
    const menu = new Menu();
    menu.addItem((item) => item.setTitle(this.plugin.t("task.menuEdit")).setIcon("pencil").onClick(() => this.openEditor(task)));
    const siblings = getActiveTasks(this.data, task.quadrant);
    const taskIndex = siblings.findIndex((item) => item.id === task.id);
    menu.addItem(
      (item) => item.setTitle(this.plugin.t("task.moveUp")).setIcon("arrow-up").setDisabled(taskIndex <= 0).onClick(() => void this.moveWithinQuadrant(task.id, -1))
    );
    menu.addItem(
      (item) => item.setTitle(this.plugin.t("task.moveDown")).setIcon("arrow-down").setDisabled(taskIndex < 0 || taskIndex >= siblings.length - 1).onClick(() => void this.moveWithinQuadrant(task.id, 1))
    );
    menu.addSeparator();
    for (const quadrant of QUADRANTS) {
      const meta = this.plugin.getQuadrantMeta(quadrant);
      menu.addItem((item) => {
        item.setTitle(this.plugin.t("task.moveTo", { quadrant: this.getQuadrantName(quadrant) })).setIcon(meta.icon).setDisabled(task.quadrant === quadrant);
        item.onClick(() => void this.mutate((data) => moveTask(data, task.id, quadrant)));
      });
    }
    menu.addSeparator();
    menu.addItem(
      (item) => item.setTitle(this.plugin.t("task.delete")).setIcon("trash-2").setWarning(true).onClick(() => void this.remove(task.id))
    );
    menu.showAtMouseEvent(event);
  }
  moveWithinQuadrant(taskId, offset) {
    return this.mutate((data) => {
      const task = data.tasks.find((item) => item.id === taskId && !item.completedAt);
      if (!task) return null;
      const siblings = getActiveTasks(data, task.quadrant);
      const taskIndex = siblings.findIndex((item) => item.id === taskId);
      const target = siblings[taskIndex + offset];
      if (!target) return null;
      return reorderTask(data, taskId, task.quadrant, target.id, offset < 0 ? "before" : "after");
    });
  }
  async complete(taskId) {
    const task = await this.mutate((data) => completeTask(data, taskId));
    if (!task) return;
    this.plugin.showUndo(this.plugin.t("task.completedNotice"), () => this.mutate((data) => restoreTask(data, taskId)));
  }
  async restore(taskId) {
    const task = await this.mutate((data) => restoreTask(data, taskId));
    if (!task) return;
    this.plugin.showUndo(this.plugin.t("task.restoredNotice"), () => this.mutate((data) => completeTask(data, taskId)));
  }
  async remove(taskId) {
    const deleted = await this.mutate((data) => deleteTask(data, taskId));
    if (!deleted) return;
    this.plugin.showUndo(this.plugin.t("task.deletedNotice"), () => this.mutate((data) => restoreDeletedTask(data, deleted)));
  }
  renderCompleted(container) {
    const section = container.createEl("section", { cls: "qt-completed-section" });
    const header = section.createEl("header", { cls: "qt-completed-header" });
    const titleGroup = header.createDiv();
    titleGroup.createEl("h3", { text: this.plugin.t("completed.title") });
    const allCompleted = getCompletedTasks(this.data);
    const bounds = completionBounds(this.filters);
    const tasks = getCompletedTasks(this.data, this.filters);
    titleGroup.createSpan({
      text: `${tasks.length} / ${allCompleted.length}`,
      cls: "qt-completed-count",
      attr: { "aria-live": "polite" }
    });
    const scrollLabel = this.plugin.t(this.isCompletedScrollable ? "completed.showAll" : "completed.enableScroll");
    const scrollToggle = createIconButton(
      header,
      this.isCompletedScrollable ? "chevrons-up-down" : "chevrons-down-up",
      scrollLabel,
      () => {
        this.isCompletedScrollable = !this.isCompletedScrollable;
        this.render();
        focusAfterRender(this.containerEl, ".qt-completed-scroll-toggle");
      },
      "qt-completed-scroll-toggle"
    );
    scrollToggle.setAttribute("aria-pressed", String(this.isCompletedScrollable));
    const controls = section.createDiv({ cls: "qt-filters" });
    const quadrantSelect = controls.createEl("select", { attr: { "aria-label": this.plugin.t("completed.filterQuadrant") } });
    quadrantSelect.createEl("option", { text: this.plugin.t("completed.allQuadrants"), value: "all" });
    for (const quadrant of QUADRANTS) {
      quadrantSelect.createEl("option", { text: this.getQuadrantName(quadrant), value: quadrant });
    }
    quadrantSelect.value = this.filters.quadrant;
    quadrantSelect.addEventListener("change", () => {
      this.filters.quadrant = quadrantSelect.value;
      this.render();
    });
    const periods = controls.createDiv({ cls: "qt-periods", attr: { role: "group", "aria-label": this.plugin.t("completed.timeFilter") } });
    for (const periodId of PERIODS) {
      const button = periods.createEl("button", {
        text: this.plugin.t(`period.${periodId}`),
        cls: this.filters.period === periodId ? "is-active" : "",
        attr: { type: "button", "aria-pressed": String(this.filters.period === periodId) }
      });
      button.addEventListener("click", () => {
        this.filters.period = periodId;
        this.render();
      });
    }
    if (this.filters.period === "custom") this.renderCustomRange(controls);
    const list = section.createEl("ul", {
      cls: `qt-completed-list${this.isCompletedScrollable ? " is-scrollable" : ""}`,
      attr: this.isCompletedScrollable ? { tabindex: "0", "aria-label": this.plugin.t("completed.listLabel") } : {}
    });
    if (!bounds.valid) {
      list.createEl("li", { text: this.plugin.t("completed.invalidRange"), cls: "qt-empty qt-filter-error" });
    } else if (tasks.length === 0) {
      list.createEl("li", {
        text: allCompleted.length === 0 ? this.plugin.t("completed.none") : this.plugin.t("completed.noMatches"),
        cls: "qt-empty"
      });
    } else {
      for (const task of tasks) this.renderCompletedTask(list, task);
    }
  }
  renderCustomRange(controls) {
    const range = controls.createDiv({ cls: "qt-custom-range" });
    const start = range.createEl("input", { attr: { type: "date", "aria-label": this.plugin.t("completed.startDate") } });
    start.value = this.filters.startDate;
    range.createSpan({ text: this.plugin.t("completed.to") });
    const end = range.createEl("input", { attr: { type: "date", "aria-label": this.plugin.t("completed.endDate") } });
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
    const row = list.createEl("li", { cls: "qt-completed-row", attr: { "data-task-id": task.id } });
    const checkbox = row.createEl("input", {
      cls: "qt-task-checkbox",
      attr: { type: "checkbox", "aria-label": this.plugin.t("completed.restore", { title: task.title }) }
    });
    checkbox.checked = true;
    checkbox.addEventListener("change", () => void this.restore(task.id));
    const content = row.createDiv({ cls: "qt-completed-content" });
    const edit = content.createEl("button", { cls: "qt-task-title qt-completed-edit", attr: { type: "button", title: this.plugin.t("task.edit") } });
    edit.createSpan({ text: task.title, cls: "qt-completed-title" });
    renderTaskDetails(edit, task, this.plugin);
    edit.addEventListener("click", () => this.openEditor(task));
    const metadata = content.createDiv({ cls: "qt-completed-meta" });
    metadata.createSpan({ text: this.getQuadrantName(task.quadrant), cls: `qt-badge qt-badge-${task.quadrant}` });
    const stamp = metadata.createSpan({ cls: "qt-completed-stamp" });
    const caption = stamp.createSpan({ cls: "qt-completed-caption" });
    const icon = caption.createSpan({ cls: "qt-completed-icon", attr: { "aria-hidden": "true" } });
    setIcon(icon, "check-circle-2");
    caption.createSpan({ cls: "qt-completed-label", text: this.plugin.t("completed.at") });
    stamp.createEl("time", { text: formatCompletedAt(task.completedAt, this.plugin.language), attr: { datetime: task.completedAt } });
    createIconButton(row, "trash-2", this.plugin.t("completed.delete"), () => void this.remove(task.id));
    return row;
  }
};
var EisenhowerMatrixBlocksSettingTab = class extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl).setName(this.plugin.t("settings.language")).setDesc(this.plugin.t("settings.languageDescription")).addDropdown(
      (dropdown) => dropdown.addOption("auto", this.plugin.t("settings.followObsidian")).addOption("zh", "\u4E2D\u6587").addOption("en", "English").setValue(this.plugin.languageMode).onChange(async (value) => {
        await this.plugin.setLanguage(value);
        this.display();
      })
    );
  }
};
var EisenhowerMatrixBlocksPlugin = class extends Plugin {
  async onload() {
    await this.loadPluginSettings();
    this.boardRenderers = /* @__PURE__ */ new Set();
    this.viewHandoff = createViewHandoff(this);
    this.editorScrollGuards = createEditorScrollGuards();
    this.fileQueues = /* @__PURE__ */ new Map();
    this.refreshTimers = /* @__PURE__ */ new Map();
    for (const language of BOARD_LANGUAGES) {
      this.registerMarkdownCodeBlockProcessor(language, (source, element, context) => {
        context.addChild(new MatrixBoardRenderChild(element, this, context.sourcePath, source));
      });
    }
    this.insertCommand = this.addCommand({
      id: "insert-quadrant-board",
      name: this.t("command.insert"),
      editorCallback: (editor) => this.insertBoard(editor)
    });
    this.ribbonEl = this.addRibbonIcon("layout-grid", this.t("ribbon.insert"), () => this.insertBoardIntoActiveNote());
    this.addSettingTab(new EisenhowerMatrixBlocksSettingTab(this.app, this));
    this.registerVaultEvents();
    this.app.workspace.onLayoutReady(() => {
      this.app.workspace.detachLeavesOfType(LEGACY_VIEW_TYPE);
      void this.migrateLegacyStorage();
    });
  }
  onunload() {
    var _a, _b;
    (_a = this.viewHandoff) == null ? void 0 : _a.dispose();
    (_b = this.editorScrollGuards) == null ? void 0 : _b.dispose();
    for (const timer of this.refreshTimers.values()) window.clearTimeout(timer);
    this.refreshTimers.clear();
  }
  get language() {
    return resolveLanguage(this.languageMode, getAppLanguage());
  }
  get languageMode() {
    var _a;
    return normalizeLanguageMode((_a = this.settings) == null ? void 0 : _a.language);
  }
  t(key, variables) {
    return translate(this.language, key, variables);
  }
  getQuadrantMeta(quadrant) {
    return {
      ...QUADRANT_META[quadrant],
      action: this.t(`quadrant.${quadrant}.action`),
      description: this.t(`quadrant.${quadrant}.description`)
    };
  }
  getQuadrantName(quadrant) {
    return this.getQuadrantMeta(quadrant).description;
  }
  async loadPluginSettings() {
    const raw = await this.loadData();
    this.settings = { language: normalizeLanguageMode(raw == null ? void 0 : raw.language) };
  }
  async setLanguage(value) {
    const languageMode = normalizeLanguageMode(value);
    if (languageMode === this.languageMode) return;
    this.settings = { ...this.settings, language: languageMode };
    const raw = await this.loadData();
    await this.saveData({ ...raw || {}, language: languageMode });
    if (this.insertCommand) this.insertCommand.name = this.t("command.insert");
    if (this.ribbonEl) {
      this.ribbonEl.setAttribute("aria-label", this.t("ribbon.insert"));
      this.ribbonEl.setAttribute("title", this.t("ribbon.insert"));
    }
    for (const renderer of this.boardRenderers) renderer.render();
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
    new Notice(this.t("notice.inserted"));
  }
  insertBoardIntoActiveNote() {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!(view == null ? void 0 : view.editor)) {
      new Notice(this.t("notice.openMarkdown"));
      return;
    }
    this.insertBoard(view.editor);
  }
  async updateBoard(sourcePath, boardId, updater, originRoot) {
    var _a, _b;
    const file = this.app.vault.getAbstractFileByPath(sourcePath);
    if (!(file instanceof TFile)) {
      new Notice(this.t("notice.fileMissing"));
      return null;
    }
    let outcome = null;
    let preferredView;
    (_b = (_a = this.app.workspace).iterateAllLeaves) == null ? void 0 : _b.call(_a, ({ view }) => {
      var _a2, _b2, _c;
      if (originRoot && ((_a2 = view == null ? void 0 : view.containerEl) == null ? void 0 : _a2.contains(originRoot)) && ((_b2 = view.file) == null ? void 0 : _b2.path) === sourcePath && ((_c = view.getMode) == null ? void 0 : _c.call(view)) === "source") preferredView = view;
    });
    const expectedEditor = preferredView == null ? void 0 : preferredView.editor;
    const previous = this.fileQueues.get(file) || Promise.resolve();
    const pending = previous.catch(() => void 0).then(async () => {
      var _a2, _b2, _c;
      const finishHandoff = (_a2 = this.viewHandoff) == null ? void 0 : _a2.armForFile(sourcePath);
      try {
        let originStillOpen = !preferredView;
        (_c = (_b2 = this.app.workspace).iterateAllLeaves) == null ? void 0 : _c.call(_b2, ({ view }) => {
          var _a3, _b3;
          if (view === preferredView && ((_a3 = view.file) == null ? void 0 : _a3.path) === sourcePath && ((_b3 = view.getMode) == null ? void 0 : _b3.call(view)) === "source" && view.editor === expectedEditor) originStillOpen = true;
        });
        if (!originStillOpen) throw new Error("The originating editor changed while this operation was queued.");
        const edited = tryEditorWrite(this, sourcePath, boardId, updater, preferredView);
        if (edited) outcome = edited.outcome;
        else await this.app.vault.process(file, (content) => {
          outcome = updater(content, boardId);
          return outcome.content;
        });
      } finally {
        finishHandoff == null ? void 0 : finishHandoff();
      }
    });
    this.fileQueues.set(file, pending);
    try {
      await pending;
      if (this.fileQueues.get(file) === pending) this.fileQueues.delete(file);
      if (outcome) {
        this.refreshBoardRenderers(sourcePath, boardId, outcome.data, outcome.title, outcome.quadrantLabels);
      }
      return outcome;
    } catch (error) {
      if (this.fileQueues.get(file) === pending) this.fileQueues.delete(file);
      console.error("Eisenhower Matrix Blocks failed to update a local board", error);
      new Notice(this.t(error.code === "EDITOR_PARTIAL_WRITE" ? "notice.partialEditorWrite" : "notice.saveFailed"), 1e4);
      await this.refreshFileRenderers(sourcePath);
      return null;
    }
  }
  mutateBoard(sourcePath, boardId, mutator, originRoot) {
    return this.updateBoard(
      sourcePath,
      boardId,
      (content, targetBoardId) => mutateBoardDocument(content, targetBoardId, mutator),
      originRoot
    );
  }
  renameBoard(sourcePath, boardId, title, originRoot) {
    return this.updateBoard(
      sourcePath,
      boardId,
      (content, targetBoardId) => renameBoardDocument(content, targetBoardId, title),
      originRoot
    );
  }
  updateQuadrantLabels(sourcePath, boardId, quadrant, labels, originRoot) {
    return this.updateBoard(
      sourcePath,
      boardId,
      (content, targetBoardId) => updateQuadrantLabelsDocument(content, targetBoardId, quadrant, labels),
      originRoot
    );
  }
  refreshBoardRenderers(sourcePath, boardId, data, title, quadrantLabels) {
    for (const renderer of this.boardRenderers) {
      if (renderer.sourcePath === sourcePath && renderer.boardId === boardId) renderer.setBoardData(data, title, quadrantLabels);
    }
  }
  async refreshFileRenderers(sourcePath) {
    var _a, _b, _c;
    const renderers = [...this.boardRenderers].filter((renderer) => renderer.sourcePath === sourcePath);
    if (!renderers.length) return;
    const file = this.app.vault.getAbstractFileByPath(sourcePath);
    if (!(file instanceof TFile)) {
      for (const renderer of renderers) renderer.setBoardError(new Error(this.t("notice.fileUnavailable")));
      return;
    }
    await (this.fileQueues.get(file) || Promise.resolve()).catch(() => void 0);
    try {
      let content = (_a = readEditorBuffer(this, sourcePath)) == null ? void 0 : _a.content;
      if (content === void 0) {
        const diskContent = await this.app.vault.read(file);
        if (this.fileQueues.has(file)) {
          this.scheduleFileRefresh(sourcePath);
          return;
        }
        content = (_c = (_b = readEditorBuffer(this, sourcePath)) == null ? void 0 : _b.content) != null ? _c : diskContent;
      }
      for (const renderer of renderers) {
        if (!this.boardRenderers.has(renderer) || renderer.sourcePath !== sourcePath) continue;
        try {
          const board = readBoardFromDocument(content, renderer.boardId);
          renderer.setBoardData(board.data, board.title, board.quadrantLabels);
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
    this.registerEvent(this.app.workspace.on("editor-change", (_editor, view) => {
      var _a;
      if ((_a = view.file) == null ? void 0 : _a.path) this.scheduleFileRefresh(view.file.path);
    }));
    this.registerEvent(this.app.vault.on("modify", (file) => this.scheduleFileRefresh(file.path)));
    this.registerEvent(this.app.vault.on("delete", (file) => this.scheduleFileRefresh(file.path)));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
      try {
        moveBoardLayouts(this.app, oldPath, file.path);
      } catch (error) {
        console.error("Eisenhower Matrix Blocks could not move local layout preferences", error);
        new Notice(this.t("notice.layoutSaveFailed"), 1e4);
      }
      for (const renderer of this.boardRenderers) {
        if (renderer.sourcePath === oldPath || renderer.sourcePath.startsWith(`${oldPath}/`)) {
          renderer.sourcePath = file.path + renderer.sourcePath.slice(oldPath.length);
        }
      }
      this.scheduleFileRefresh(file.path);
    }));
  }
  async migrateLegacyStorage() {
    var _a;
    const raw = await this.loadData();
    if ((raw == null ? void 0 : raw.settingsVersion) === SETTINGS_VERSION) return;
    if (!raw) {
      await this.saveData({ settingsVersion: SETTINGS_VERSION, language: this.languageMode });
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
          `# Eisenhower Matrix Blocks

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
        language: normalizeLanguageMode(raw.language),
        migration: {
          fromVersion: Array.isArray(raw.tasks) ? "1.0.0" : "1.1.0",
          completedAt: (/* @__PURE__ */ new Date()).toISOString(),
          sourcePath,
          boardId: LEGACY_BOARD_ID,
          jsonBackup
        }
      });
      new Notice(this.t("notice.migrationComplete"), 1e4);
    } catch (error) {
      console.error("Eisenhower Matrix Blocks could not migrate global storage", error);
      new Notice(this.t("notice.migrationFailed"), 12e3);
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
    button.textContent = this.t("common.undo");
    fragment.append(button);
    const notice = new Notice(fragment, 6e3);
    button.addEventListener("click", async () => {
      if (await onUndo()) notice.hide();
    });
  }
};
module.exports = EisenhowerMatrixBlocksPlugin;
