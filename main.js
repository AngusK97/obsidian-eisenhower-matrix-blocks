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
    function createEmptyData() {
      return { version: DATA_VERSION, tasks: [] };
    }
    function isQuadrant(value) {
      return QUADRANTS2.includes(value);
    }
    function isValidDate(value) {
      return typeof value === "string" && !Number.isNaN(Date.parse(value));
    }
    function normalizeData2(raw) {
      if (!raw || !Array.isArray(raw.tasks)) return createEmptyData();
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
      createEmptyData,
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
    var { createEmptyData, isQuadrant, normalizeData: normalizeData2 } = require_core();
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
          data: createEmptyData(),
          issues: ["\u4EFB\u52A1\u7BA1\u7406\u533A\u6807\u8BB0\u7F3A\u5931\u6216\u91CD\u590D"],
          hasManagedBlock: false
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
    function updateMarkdownDocument2(content, data) {
      const newline = detectNewline(content);
      const block = renderManagedBlock(data, newline);
      const range = findManagedRange(content);
      if (range) return `${content.slice(0, range.start)}${block}${content.slice(range.end)}`;
      if (!content.trim()) return `# Quadrant Tasks${newline}${newline}${block}${newline}`;
      const separator = content.endsWith(newline) ? newline : `${newline}${newline}`;
      return `${content}${separator}${block}${newline}`;
    }
    function mergeTaskData2(primary, additional) {
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
      mergeTaskData: mergeTaskData2,
      parseTaskMarkdown: parseTaskMarkdown2,
      renderManagedBlock,
      updateMarkdownDocument: updateMarkdownDocument2
    };
  }
});

// src/main.js
var {
  ItemView,
  Menu,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  normalizePath,
  setIcon
} = require("obsidian");
var {
  QUADRANTS,
  addTask,
  completeTask,
  completionBounds,
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
  mergeTaskData,
  parseTaskMarkdown,
  updateMarkdownDocument
} = require_markdown_store();
var VIEW_TYPE = "quadrant-tasks-view";
var DEFAULT_TASK_FILE_PATH = "Quadrant Tasks.md";
var SETTINGS_VERSION = 1;
var LEGACY_BACKUP_NAME = "data-backup-1.0.0.json";
var QUADRANT_META = {
  do: {
    action: "\u7ACB\u5373\u505A",
    description: "\u91CD\u8981\u4E14\u7D27\u6025",
    icon: "zap"
  },
  schedule: {
    action: "\u5B89\u6392",
    description: "\u91CD\u8981\u4E0D\u7D27\u6025",
    icon: "calendar-clock"
  },
  delegate: {
    action: "\u59D4\u6D3E",
    description: "\u7D27\u6025\u4E0D\u91CD\u8981",
    icon: "users"
  },
  eliminate: {
    action: "\u820D\u5F03",
    description: "\u4E0D\u91CD\u8981\u4E0D\u7D27\u6025",
    icon: "archive"
  }
};
var PERIODS = [
  { id: "all", label: "\u5168\u90E8" },
  { id: "today", label: "\u4ECA\u5929" },
  { id: "7d", label: "\u8FD1 7 \u5929" },
  { id: "30d", label: "\u8FD1 30 \u5929" },
  { id: "custom", label: "\u81EA\u5B9A\u4E49" }
];
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
  const date = new Date(value);
  return new Intl.DateTimeFormat(void 0, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
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
var QuadrantTasksView = class extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.filters = {
      quadrant: "all",
      period: "all",
      startDate: "",
      endDate: ""
    };
    this.draggedTaskId = null;
  }
  getViewType() {
    return VIEW_TYPE;
  }
  getDisplayText() {
    return "\u56DB\u8C61\u9650\u4EFB\u52A1";
  }
  getIcon() {
    return "layout-grid";
  }
  async onOpen() {
    this.render();
  }
  async onClose() {
  }
  render() {
    const container = this.contentEl;
    container.empty();
    container.addClass("qt-root");
    this.renderHeader(container);
    if (!this.plugin.storageReady) {
      container.createDiv({ cls: "qt-storage-loading", text: "\u6B63\u5728\u52A0\u8F7D\u4EFB\u52A1 Markdown \u6587\u4EF6\u2026" });
      return;
    }
    if (this.plugin.storageMode === "markdown" && this.plugin.storageIssue) {
      container.createDiv({
        cls: "qt-storage-error",
        text: "\u4EFB\u52A1 Markdown \u6587\u4EF6\u4E0D\u53EF\u7528\u3002\u8BF7\u6062\u590D\u6587\u4EF6\u6216\u4FEE\u6B63\u63D2\u4EF6\u7BA1\u7406\u533A\u540E\u518D\u7EE7\u7EED\u64CD\u4F5C\u3002"
      });
      return;
    }
    const matrix = container.createDiv({ cls: "qt-matrix" });
    for (const quadrant of QUADRANTS) this.renderQuadrant(matrix, quadrant);
    this.renderCompleted(container);
  }
  renderHeader(container) {
    const header = container.createEl("header", { cls: "qt-page-header" });
    const titleGroup = header.createDiv({ cls: "qt-title-group" });
    titleGroup.createEl("h2", { text: "\u56DB\u8C61\u9650\u4EFB\u52A1" });
    const stats = titleGroup.createDiv({ cls: "qt-stats", attr: { "aria-live": "polite" } });
    if (!this.plugin.storageReady) {
      stats.createSpan({ text: "\u6B63\u5728\u52A0\u8F7D" });
      return;
    }
    if (this.plugin.storageMode === "markdown" && this.plugin.storageIssue) {
      stats.createSpan({ text: "\u6570\u636E\u6E90\u4E0D\u53EF\u7528" });
      return;
    }
    const activeCount = getActiveTasks(this.plugin.data).length;
    const completedCount = getCompletedTasks(this.plugin.data).length;
    stats.createSpan({ text: `${activeCount} \u9879\u8FDB\u884C\u4E2D` });
    stats.createSpan({ text: `${completedCount} \u9879\u5DF2\u5B8C\u6210` });
  }
  renderQuadrant(matrix, quadrant) {
    const meta = QUADRANT_META[quadrant];
    const tasks = getActiveTasks(this.plugin.data, quadrant);
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
      const task = await this.plugin.mutate((data) => addTask(data, titleText, quadrant));
      if (task) input.value = "";
    };
    input.addEventListener("input", () => input.removeClass("qt-input-error"));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.isComposing) submit();
    });
    createIconButton(quickAdd, "plus", `\u6DFB\u52A0\u5230${meta.action}`, () => void submit(), "qt-add-button");
    const list = section.createEl("ul", { cls: "qt-task-list" });
    if (tasks.length === 0) {
      list.createEl("li", { text: "\u6682\u65E0\u4EFB\u52A1", cls: "qt-empty" });
    } else {
      for (const task of tasks) this.renderActiveTask(list, task);
    }
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
      if (taskId) void this.plugin.mutate((data) => moveTask(data, taskId, quadrant));
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
      this.contentEl.querySelectorAll(".qt-drop-target").forEach((element) => element.removeClass("qt-drop-target"));
    });
  }
  openEditor(task) {
    new TaskTitleModal(this.app, task.title, (title) => {
      void this.plugin.mutate((data) => editTask(data, task.id, title));
    }).open();
  }
  openTaskMenu(event, task) {
    const menu = new Menu();
    menu.addItem((item) => item.setTitle("\u7F16\u8F91").setIcon("pencil").onClick(() => this.openEditor(task)));
    for (const quadrant of QUADRANTS) {
      const meta = QUADRANT_META[quadrant];
      menu.addItem((item) => {
        item.setTitle(`\u79FB\u81F3\uFF1A${meta.action}`).setIcon(meta.icon).setDisabled(task.quadrant === quadrant);
        item.onClick(() => {
          void this.plugin.mutate((data) => moveTask(data, task.id, quadrant));
        });
      });
    }
    menu.addSeparator();
    menu.addItem(
      (item) => item.setTitle("\u5220\u9664").setIcon("trash-2").setWarning(true).onClick(() => void this.remove(task.id))
    );
    menu.showAtMouseEvent(event);
  }
  async complete(taskId) {
    const task = await this.plugin.mutate((data) => completeTask(data, taskId));
    if (!task) return;
    this.plugin.showUndo("\u4EFB\u52A1\u5DF2\u5B8C\u6210", async () => {
      return this.plugin.mutate((data) => restoreTask(data, taskId));
    });
  }
  async restore(taskId) {
    const task = await this.plugin.mutate((data) => restoreTask(data, taskId));
    if (!task) return;
    this.plugin.showUndo("\u4EFB\u52A1\u5DF2\u6062\u590D", async () => {
      return this.plugin.mutate((data) => completeTask(data, taskId));
    });
  }
  async remove(taskId) {
    const deleted = await this.plugin.mutate((data) => deleteTask(data, taskId));
    if (!deleted) return;
    this.plugin.showUndo("\u4EFB\u52A1\u5DF2\u5220\u9664", async () => {
      return this.plugin.mutate((data) => restoreDeletedTask(data, deleted));
    });
  }
  renderCompleted(container) {
    const section = container.createEl("section", { cls: "qt-completed-section" });
    const header = section.createEl("header", { cls: "qt-completed-header" });
    const titleGroup = header.createDiv();
    titleGroup.createEl("h3", { text: "\u5DF2\u5B8C\u6210" });
    const allCompleted = getCompletedTasks(this.plugin.data);
    const bounds = completionBounds(this.filters);
    const tasks = getCompletedTasks(this.plugin.data, this.filters);
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
    const start = range.createEl("input", {
      attr: { type: "date", "aria-label": "\u5B8C\u6210\u65F6\u95F4\u8D77\u59CB\u65E5\u671F" }
    });
    start.value = this.filters.startDate;
    range.createSpan({ text: "\u81F3" });
    const end = range.createEl("input", {
      attr: { type: "date", "aria-label": "\u5B8C\u6210\u65F6\u95F4\u7ED3\u675F\u65E5\u671F" }
    });
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
    const meta = QUADRANT_META[task.quadrant];
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
    metadata.createSpan({ text: meta.action, cls: `qt-badge qt-badge-${task.quadrant}` });
    metadata.createEl("time", { text: formatCompletedAt(task.completedAt), attr: { datetime: task.completedAt } });
    createIconButton(row, "trash-2", "\u5220\u9664\u4EFB\u52A1", () => void this.remove(task.id));
  }
};
function cloneData(data) {
  return normalizeData(JSON.parse(JSON.stringify(data)));
}
function isLegacyData(raw) {
  return Boolean(raw && Array.isArray(raw.tasks));
}
function normalizeTaskFilePath(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (raw && (/^[\\/]/.test(raw) || /^[a-z]:/i.test(raw) || raw.split(/[\\/]/).includes(".."))) {
    throw new Error("\u4EFB\u52A1\u6587\u4EF6\u8DEF\u5F84\u5FC5\u987B\u662F\u7B14\u8BB0\u5E93\u5185\u7684\u76F8\u5BF9\u8DEF\u5F84");
  }
  const path = normalizePath(raw || DEFAULT_TASK_FILE_PATH);
  if (!path || !path.toLowerCase().endsWith(".md")) throw new Error("\u4EFB\u52A1\u6587\u4EF6\u8DEF\u5F84\u5FC5\u987B\u4EE5 .md \u7ED3\u5C3E");
  if (path === ".obsidian" || path.startsWith(".obsidian/")) {
    throw new Error("\u4EFB\u52A1\u6587\u4EF6\u5FC5\u987B\u4F4D\u4E8E\u7B14\u8BB0\u5E93\u4E2D\uFF0C\u4E0D\u80FD\u653E\u5728 .obsidian \u76EE\u5F55");
  }
  return path;
}
function storageSettings(raw) {
  let taskFilePath = DEFAULT_TASK_FILE_PATH;
  try {
    taskFilePath = normalizeTaskFilePath(raw == null ? void 0 : raw.taskFilePath);
  } catch (e) {
    taskFilePath = DEFAULT_TASK_FILE_PATH;
  }
  return {
    taskFilePath,
    migration: (raw == null ? void 0 : raw.migration) && typeof raw.migration === "object" ? raw.migration : null
  };
}
var QuadrantTasksSettingTab = class extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.pendingPath = plugin.settings.taskFilePath;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "\u56DB\u8C61\u9650\u4EFB\u52A1" });
    new Setting(containerEl).setName("\u4EFB\u52A1 Markdown \u6587\u4EF6").setDesc("\u56DB\u8C61\u9650\u548C\u5DF2\u5B8C\u6210\u4EFB\u52A1\u90FD\u4FDD\u5B58\u5728\u8FD9\u4E2A\u666E\u901A Markdown \u6587\u4EF6\u4E2D\u3002\u79FB\u52A8\u6587\u4EF6\u540E\uFF0C\u63D2\u4EF6\u4F1A\u7EE7\u7EED\u8DDF\u968F\u5B83\u3002").addText(
      (text) => text.setPlaceholder(DEFAULT_TASK_FILE_PATH).setValue(this.plugin.settings.taskFilePath).onChange((value) => {
        this.pendingPath = value;
      })
    ).addButton(
      (button) => button.setButtonText("\u79FB\u52A8\u5E76\u4F7F\u7528").setCta().onClick(async () => {
        if (await this.plugin.moveTaskFile(this.pendingPath)) this.display();
      })
    );
    new Setting(containerEl).setName("\u6253\u5F00\u4EFB\u52A1\u6587\u4EF6").setDesc("\u76F4\u63A5\u67E5\u770B\u6216\u624B\u52A8\u7F16\u8F91\u63D2\u4EF6\u7BA1\u7406\u7684 Markdown \u4EFB\u52A1\u5217\u8868\u3002").addButton((button) => button.setButtonText("\u6253\u5F00").onClick(() => void this.plugin.openTaskFile()));
  }
};
var QuadrantTasksPlugin = class extends Plugin {
  async onload() {
    this.data = normalizeData(null);
    this.settings = storageSettings(null);
    this.saveQueue = Promise.resolve();
    this.storageMode = "markdown";
    this.storageIssue = null;
    this.storageReady = false;
    this.movingTaskFile = false;
    this.settingsDirty = false;
    this.registerView(VIEW_TYPE, (leaf) => new QuadrantTasksView(leaf, this));
    this.addRibbonIcon("layout-grid", "\u6253\u5F00\u56DB\u8C61\u9650\u4EFB\u52A1", () => void this.activateView());
    this.addCommand({
      id: "open-quadrant-tasks",
      name: "\u6253\u5F00\u56DB\u8C61\u9650\u4EFB\u52A1",
      callback: () => void this.activateView()
    });
    this.addCommand({
      id: "open-quadrant-task-file",
      name: "\u6253\u5F00\u4EFB\u52A1 Markdown \u6587\u4EF6",
      callback: () => void this.openTaskFile()
    });
    this.addSettingTab(new QuadrantTasksSettingTab(this.app, this));
    this.app.workspace.onLayoutReady(() => void this.finishStorageInitialization());
  }
  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }
  async finishStorageInitialization() {
    try {
      await this.initializeStorage();
      this.registerTaskFileEvents();
    } catch (error) {
      this.storageIssue = error;
      console.error("Quadrant Tasks storage initialization failed", error);
      new Notice("\u56DB\u8C61\u9650\u4EFB\u52A1\u5B58\u50A8\u521D\u59CB\u5316\u5931\u8D25\uFF0C\u8BF7\u67E5\u770B\u63A7\u5236\u53F0\u3002", 1e4);
    } finally {
      this.storageReady = true;
      this.renderViews();
    }
  }
  async initializeStorage() {
    const raw = await this.loadData();
    this.settings = storageSettings(raw);
    if (isLegacyData(raw)) {
      try {
        const backupFile = await this.backupLegacyData(raw);
        await this.migrateLegacyData(normalizeData(raw));
        this.settings.migration = {
          fromVersion: "1.0.0",
          completedAt: (/* @__PURE__ */ new Date()).toISOString(),
          backupFile
        };
        await this.saveStorageSettings();
        return;
      } catch (error) {
        this.storageMode = "legacy";
        this.data = normalizeData(raw);
        this.storageIssue = error;
        console.error("Quadrant Tasks could not migrate legacy data", error);
        new Notice("\u4EFB\u52A1\u8FC1\u79FB\u5230 Markdown \u5931\u8D25\uFF0C\u63D2\u4EF6\u5DF2\u7EE7\u7EED\u4F7F\u7528\u539F\u6709\u6570\u636E\u3002\u8BF7\u67E5\u770B\u63A7\u5236\u53F0\u3002", 1e4);
        return;
      }
    }
    const firstRun = !raw || raw.settingsVersion !== SETTINGS_VERSION;
    try {
      if (firstRun) await this.ensureTaskFile();
      this.data = await this.readTaskData();
      if (firstRun) await this.saveStorageSettings();
    } catch (error) {
      this.storageIssue = error;
      console.error("Quadrant Tasks could not load its Markdown file", error);
      new Notice("\u4EFB\u52A1 Markdown \u6587\u4EF6\u6682\u65F6\u4E0D\u53EF\u7528\u3002\u63D2\u4EF6\u4E0D\u4F1A\u8986\u76D6\u6216\u91CD\u5EFA\u5DF2\u6709\u6570\u636E\u3002", 1e4);
    }
  }
  async backupLegacyData(raw) {
    if (!this.manifest.dir) throw new Error("\u63D2\u4EF6\u76EE\u5F55\u4E0D\u53EF\u7528\uFF0C\u65E0\u6CD5\u5907\u4EFD\u65E7\u6570\u636E");
    const adapter = this.app.vault.adapter;
    let backupFile = LEGACY_BACKUP_NAME;
    let backupPath = normalizePath(`${this.manifest.dir}/${backupFile}`);
    if (await adapter.exists(backupPath)) {
      try {
        const previous = JSON.parse(await adapter.read(backupPath));
        if (JSON.stringify(normalizeData(previous)) === JSON.stringify(normalizeData(raw))) return backupFile;
      } catch (e) {
      }
      backupFile = `data-backup-1.0.0-${Date.now()}.json`;
      backupPath = normalizePath(`${this.manifest.dir}/${backupFile}`);
    }
    await adapter.write(backupPath, `${JSON.stringify(raw, null, 2)}
`);
    return backupFile;
  }
  async migrateLegacyData(legacyData) {
    await this.ensureTaskFile();
    const file = this.getTaskFile();
    let expectedData = null;
    await this.app.vault.process(file, (content) => {
      const parsed = parseTaskMarkdown(content);
      if (parsed.issues.length) throw new Error(`\u4EFB\u52A1 Markdown \u5185\u5BB9\u5F02\u5E38\uFF1A${parsed.issues.join("\uFF1B")}`);
      const existingById = new Map(parsed.data.tasks.map((task) => [task.id, task]));
      for (const legacyTask of legacyData.tasks) {
        const existing = existingById.get(legacyTask.id);
        if (existing && JSON.stringify(existing) !== JSON.stringify(legacyTask)) {
          throw new Error(`\u8FC1\u79FB\u51B2\u7A81\uFF1A\u4EFB\u52A1 ${legacyTask.id} \u5728 Markdown \u4E0E\u65E7\u6570\u636E\u4E2D\u7684\u5185\u5BB9\u4E0D\u540C`);
        }
      }
      expectedData = mergeTaskData(parsed.data, legacyData);
      return updateMarkdownDocument(content, expectedData);
    });
    const migrated = await this.readTaskData();
    const migratedById = new Map(migrated.tasks.map((task) => [task.id, task]));
    if (migrated.tasks.length !== expectedData.tasks.length || expectedData.tasks.some((task) => JSON.stringify(migratedById.get(task.id)) !== JSON.stringify(task))) {
      throw new Error("\u8FC1\u79FB\u6821\u9A8C\u5931\u8D25\uFF1AMarkdown \u4E0E\u9884\u671F\u4EFB\u52A1\u5185\u5BB9\u4E0D\u4E00\u81F4");
    }
    this.data = migrated;
  }
  async ensureTaskFile() {
    const existing = this.app.vault.getAbstractFileByPath(this.settings.taskFilePath);
    if (existing instanceof TFile) return existing;
    if (existing) throw new Error("\u4EFB\u52A1\u6587\u4EF6\u8DEF\u5F84\u5DF2\u88AB\u6587\u4EF6\u5939\u5360\u7528");
    await this.ensureParentFolder(this.settings.taskFilePath);
    try {
      return await this.app.vault.create(
        this.settings.taskFilePath,
        updateMarkdownDocument("", normalizeData(null))
      );
    } catch (error) {
      const createdElsewhere = this.app.vault.getAbstractFileByPath(this.settings.taskFilePath);
      if (createdElsewhere instanceof TFile) return createdElsewhere;
      throw error;
    }
  }
  async ensureParentFolder(path) {
    const slash = path.lastIndexOf("/");
    if (slash < 0) return;
    const segments = path.slice(0, slash).split("/");
    let current = "";
    for (const segment of segments) {
      current = current ? `${current}/${segment}` : segment;
      if (!this.app.vault.getAbstractFileByPath(current)) await this.app.vault.createFolder(current);
    }
  }
  getTaskFile() {
    const file = this.app.vault.getAbstractFileByPath(this.settings.taskFilePath);
    if (!(file instanceof TFile)) throw new Error(`\u627E\u4E0D\u5230\u4EFB\u52A1\u6587\u4EF6\uFF1A${this.settings.taskFilePath}`);
    return file;
  }
  async readTaskData() {
    const content = await this.app.vault.read(this.getTaskFile());
    const parsed = parseTaskMarkdown(content);
    if (parsed.issues.length) throw new Error(`\u4EFB\u52A1 Markdown \u5185\u5BB9\u5F02\u5E38\uFF1A${parsed.issues.join("\uFF1B")}`);
    if (!parsed.hasManagedBlock) throw new Error("\u4EFB\u52A1 Markdown \u4E2D\u7F3A\u5C11\u63D2\u4EF6\u7BA1\u7406\u533A");
    return parsed.data;
  }
  async saveStorageSettings() {
    await this.saveData({
      settingsVersion: SETTINGS_VERSION,
      taskFilePath: this.settings.taskFilePath,
      migration: this.settings.migration
    });
  }
  async mutate(mutator) {
    if (!this.storageReady) {
      new Notice("\u4EFB\u52A1\u6587\u4EF6\u4ECD\u5728\u52A0\u8F7D\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5\u3002");
      return null;
    }
    let mutationResult = null;
    let committedData = null;
    const pendingSave = this.saveQueue.catch(() => void 0).then(async () => {
      if (this.storageMode === "legacy") {
        const draft = cloneData(this.data);
        mutationResult = mutator(draft);
        if (!mutationResult) return;
        await this.saveData(draft);
        committedData = draft;
        return;
      }
      const file = this.getTaskFile();
      await this.app.vault.process(file, (content) => {
        const parsed = parseTaskMarkdown(content);
        if (parsed.issues.length) throw new Error(`\u4EFB\u52A1 Markdown \u5185\u5BB9\u5F02\u5E38\uFF1A${parsed.issues.join("\uFF1B")}`);
        if (!parsed.hasManagedBlock) throw new Error("\u4EFB\u52A1 Markdown \u4E2D\u7F3A\u5C11\u63D2\u4EF6\u7BA1\u7406\u533A");
        const draft = cloneData(parsed.data);
        mutationResult = mutator(draft);
        if (!mutationResult) return content;
        committedData = draft;
        return updateMarkdownDocument(content, draft);
      });
    });
    this.saveQueue = pendingSave;
    try {
      await pendingSave;
      if (committedData) this.data = committedData;
      this.storageIssue = null;
      this.renderViews();
      return mutationResult;
    } catch (error) {
      if (this.saveQueue !== pendingSave) await this.saveQueue.catch(() => void 0);
      await this.reloadAfterFailure();
      console.error("Quadrant Tasks failed to save task data", error);
      new Notice("\u4EFB\u52A1\u4FDD\u5B58\u5931\u8D25\uFF0C\u78C1\u76D8\u5185\u5BB9\u672A\u88AB\u8986\u76D6\u3002\u8BF7\u68C0\u67E5\u4EFB\u52A1 Markdown \u6587\u4EF6\u3002", 1e4);
      return null;
    }
  }
  async reloadAfterFailure() {
    try {
      this.data = this.storageMode === "legacy" ? normalizeData(await this.loadData()) : await this.readTaskData();
      this.storageIssue = null;
    } catch (error) {
      this.storageIssue = error;
    }
    this.renderViews();
  }
  registerTaskFileEvents() {
    this.registerEvent(this.app.vault.on("modify", (file) => {
      if (file.path === this.settings.taskFilePath) void this.reloadFromTaskFile();
    }));
    this.registerEvent(this.app.vault.on("create", (file) => {
      if (file.path === this.settings.taskFilePath) void this.reloadFromTaskFile();
    }));
    this.registerEvent(this.app.vault.on("delete", (file) => {
      if (file.path === this.settings.taskFilePath) void this.reloadFromTaskFile(true);
    }));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
      if (this.movingTaskFile || !(file instanceof TFile)) return;
      if (oldPath === this.settings.taskFilePath) {
        void this.followRenamedTaskFile(file.path);
      } else if (file.path === this.settings.taskFilePath) {
        void this.reloadFromTaskFile();
      }
    }));
  }
  async reloadFromTaskFile(notifyOnFailure = false) {
    if (this.storageMode !== "markdown") return;
    await this.saveQueue.catch(() => void 0);
    try {
      this.data = await this.readTaskData();
      this.storageIssue = null;
      this.renderViews();
    } catch (error) {
      this.storageIssue = error;
      console.error("Quadrant Tasks could not reload its Markdown file", error);
      if (notifyOnFailure) new Notice("\u4EFB\u52A1 Markdown \u6587\u4EF6\u5DF2\u88AB\u5220\u9664\u6216\u6682\u65F6\u4E0D\u53EF\u7528\uFF0C\u5199\u5165\u5DF2\u6682\u505C\u3002", 1e4);
      this.renderViews();
    }
  }
  async followRenamedTaskFile(newPath) {
    try {
      await this.saveQueue.catch(() => void 0);
      this.settings.taskFilePath = normalizeTaskFilePath(newPath);
      try {
        await this.saveStorageSettings();
        this.settingsDirty = false;
      } catch (error) {
        this.settingsDirty = true;
        console.error("Quadrant Tasks could not save the renamed task path", error);
        new Notice("\u4EFB\u52A1\u6587\u4EF6\u5DF2\u91CD\u547D\u540D\uFF0C\u4F46\u65B0\u8DEF\u5F84\u6682\u65F6\u65E0\u6CD5\u4FDD\u5B58\u5230\u63D2\u4EF6\u8BBE\u7F6E\u3002", 1e4);
      }
      await this.reloadFromTaskFile();
      return true;
    } catch (error) {
      this.storageIssue = error;
      console.error("Quadrant Tasks could not follow its renamed Markdown file", error);
      new Notice(`\u65E0\u6CD5\u7EE7\u7EED\u8DDF\u968F\u91CD\u547D\u540D\u540E\u7684\u4EFB\u52A1\u6587\u4EF6\uFF1A${error.message}`, 1e4);
      this.renderViews();
      return false;
    }
  }
  async moveTaskFile(value) {
    if (!this.storageReady) {
      new Notice("\u4EFB\u52A1\u6587\u4EF6\u4ECD\u5728\u52A0\u8F7D\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5\u3002");
      return false;
    }
    if (this.storageMode !== "markdown") {
      new Notice("\u65E7\u6570\u636E\u8FC1\u79FB\u5C1A\u672A\u5B8C\u6210\uFF0C\u5F53\u524D\u4E0D\u80FD\u79FB\u52A8\u4EFB\u52A1 Markdown \u6587\u4EF6\u3002", 1e4);
      return false;
    }
    let newPath;
    try {
      newPath = normalizeTaskFilePath(value);
    } catch (error) {
      new Notice(error.message);
      return false;
    }
    const oldPath = this.settings.taskFilePath;
    if (newPath === oldPath) {
      if (!this.settingsDirty) return true;
      try {
        await this.saveStorageSettings();
        this.settingsDirty = false;
        return true;
      } catch (error) {
        new Notice(`\u65E0\u6CD5\u4FDD\u5B58\u4EFB\u52A1\u6587\u4EF6\u8DEF\u5F84\uFF1A${error.message}`, 1e4);
        return false;
      }
    }
    await this.saveQueue.catch(() => void 0);
    try {
      const file = this.getTaskFile();
      if (this.app.vault.getAbstractFileByPath(newPath)) throw new Error("\u76EE\u6807\u8DEF\u5F84\u5DF2\u7ECF\u5B58\u5728\u6587\u4EF6\u6216\u6587\u4EF6\u5939");
      await this.ensureParentFolder(newPath);
      this.movingTaskFile = true;
      await this.app.vault.rename(file, newPath);
      this.settings.taskFilePath = newPath;
      try {
        await this.saveStorageSettings();
      } catch (error) {
        await this.app.vault.rename(file, oldPath);
        this.settings.taskFilePath = oldPath;
        throw error;
      }
      this.storageIssue = null;
      new Notice(`\u4EFB\u52A1\u6587\u4EF6\u5DF2\u79FB\u52A8\u5230 ${newPath}`);
      return true;
    } catch (error) {
      console.error("Quadrant Tasks could not move its Markdown file", error);
      new Notice(`\u65E0\u6CD5\u79FB\u52A8\u4EFB\u52A1\u6587\u4EF6\uFF1A${error.message}`, 1e4);
      return false;
    } finally {
      this.movingTaskFile = false;
    }
  }
  async activateView() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    const leaf = existing || this.app.workspace.getLeaf(true);
    if (!existing) await leaf.setViewState({ type: VIEW_TYPE, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }
  async openTaskFile() {
    try {
      if (!this.storageReady) throw new Error("\u4EFB\u52A1\u6587\u4EF6\u4ECD\u5728\u52A0\u8F7D\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5");
      if (this.storageMode !== "markdown") throw new Error("\u65E7\u6570\u636E\u8FC1\u79FB\u5C1A\u672A\u5B8C\u6210\uFF0C\u4EFB\u52A1 Markdown \u6587\u4EF6\u6682\u4E0D\u53EF\u7528");
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(this.getTaskFile());
      await this.app.workspace.revealLeaf(leaf);
    } catch (error) {
      new Notice(error.message);
    }
  }
  renderViews() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      if (leaf.view instanceof QuadrantTasksView) leaf.view.render();
    }
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
