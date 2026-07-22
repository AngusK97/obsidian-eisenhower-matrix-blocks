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

// src/main.js
var { ItemView, Menu, Modal, Notice, Plugin, setIcon } = require("obsidian");
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
var VIEW_TYPE = "quadrant-tasks-view";
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
    const matrix = container.createDiv({ cls: "qt-matrix" });
    for (const quadrant of QUADRANTS) this.renderQuadrant(matrix, quadrant);
    this.renderCompleted(container);
  }
  renderHeader(container) {
    const header = container.createEl("header", { cls: "qt-page-header" });
    const titleGroup = header.createDiv({ cls: "qt-title-group" });
    titleGroup.createEl("h2", { text: "\u56DB\u8C61\u9650\u4EFB\u52A1" });
    const activeCount = getActiveTasks(this.plugin.data).length;
    const completedCount = getCompletedTasks(this.plugin.data).length;
    const stats = titleGroup.createDiv({ cls: "qt-stats", attr: { "aria-live": "polite" } });
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
    const submit = () => {
      const titleText = input.value.trim();
      if (!titleText) {
        input.addClass("qt-input-error");
        return;
      }
      addTask(this.plugin.data, titleText, quadrant);
      input.value = "";
      void this.plugin.commit();
    };
    input.addEventListener("input", () => input.removeClass("qt-input-error"));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.isComposing) submit();
    });
    createIconButton(quickAdd, "plus", `\u6DFB\u52A0\u5230${meta.action}`, submit, "qt-add-button");
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
      if (taskId && moveTask(this.plugin.data, taskId, quadrant)) void this.plugin.commit();
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
      if (editTask(this.plugin.data, task.id, title)) void this.plugin.commit();
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
          if (moveTask(this.plugin.data, task.id, quadrant)) void this.plugin.commit();
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
    const task = completeTask(this.plugin.data, taskId);
    if (!task) return;
    if (!await this.plugin.commit()) return;
    this.plugin.showUndo("\u4EFB\u52A1\u5DF2\u5B8C\u6210", async () => {
      restoreTask(this.plugin.data, taskId);
      await this.plugin.commit();
    });
  }
  async restore(taskId) {
    const task = restoreTask(this.plugin.data, taskId);
    if (!task) return;
    if (!await this.plugin.commit()) return;
    this.plugin.showUndo("\u4EFB\u52A1\u5DF2\u6062\u590D", async () => {
      completeTask(this.plugin.data, taskId);
      await this.plugin.commit();
    });
  }
  async remove(taskId) {
    const deleted = deleteTask(this.plugin.data, taskId);
    if (!deleted) return;
    if (!await this.plugin.commit()) return;
    this.plugin.showUndo("\u4EFB\u52A1\u5DF2\u5220\u9664", async () => {
      restoreDeletedTask(this.plugin.data, deleted);
      await this.plugin.commit();
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
var QuadrantTasksPlugin = class extends Plugin {
  async onload() {
    this.data = normalizeData(await this.loadData());
    this.saveQueue = Promise.resolve();
    this.registerView(VIEW_TYPE, (leaf) => new QuadrantTasksView(leaf, this));
    this.addRibbonIcon("layout-grid", "\u6253\u5F00\u56DB\u8C61\u9650\u4EFB\u52A1", () => void this.activateView());
    this.addCommand({
      id: "open-quadrant-tasks",
      name: "\u6253\u5F00\u56DB\u8C61\u9650\u4EFB\u52A1",
      callback: () => void this.activateView()
    });
  }
  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }
  async activateView() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    const leaf = existing || this.app.workspace.getLeaf(true);
    if (!existing) await leaf.setViewState({ type: VIEW_TYPE, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }
  async commit() {
    const snapshot = JSON.parse(JSON.stringify(this.data));
    const pendingSave = this.saveQueue.catch(() => void 0).then(() => this.saveData(snapshot));
    this.saveQueue = pendingSave;
    this.renderViews();
    try {
      await pendingSave;
      return true;
    } catch (error) {
      if (this.saveQueue !== pendingSave) await this.saveQueue.catch(() => void 0);
      this.data = normalizeData(await this.loadData());
      this.renderViews();
      console.error("Quadrant Tasks failed to save plugin data", error);
      new Notice("\u4EFB\u52A1\u4FDD\u5B58\u5931\u8D25\uFF0C\u5DF2\u6062\u590D\u5230\u4E0A\u6B21\u4FDD\u5B58\u7684\u72B6\u6001");
      return false;
    }
  }
  renderViews() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      if (leaf.view instanceof QuadrantTasksView) leaf.view.render();
    }
  }
  async onExternalSettingsChange() {
    await this.saveQueue.catch(() => void 0);
    this.data = normalizeData(await this.loadData());
    this.renderViews();
  }
  showUndo(message, onUndo) {
    const fragment = document.createDocumentFragment();
    fragment.append(document.createTextNode(`${message} `));
    const button = document.createElement("button");
    button.className = "qt-undo-button";
    button.textContent = "\u64A4\u9500";
    fragment.append(button);
    const notice = new Notice(fragment, 6e3);
    button.addEventListener("click", () => {
      void onUndo();
      notice.hide();
    });
  }
};
module.exports = QuadrantTasksPlugin;
