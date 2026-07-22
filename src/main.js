"use strict";

const {
	MarkdownRenderChild,
	MarkdownView,
	Menu,
	Modal,
	Notice,
	Plugin,
	TFile,
	normalizePath,
	setIcon,
} = require("obsidian");
const {
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
	restoreTask,
} = require("./core");
const {
	BOARD_LANGUAGE,
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
} = require("./board-store");
const { parseTaskMarkdown } = require("./markdown-store");

const SETTINGS_VERSION = 2;
const DEFAULT_MIGRATION_PATH = "Quadrant Tasks.md";
const LEGACY_BOARD_ID = "board-migrated-global";
const LEGACY_JSON_BACKUP = "data-backup-1.0.0.json";
const LEGACY_NOTE_BACKUP = "global-note-backup-1.1.0.md";
const LEGACY_VIEW_TYPE = "quadrant-tasks-view";

const QUADRANT_META = {
	do: { action: "立即做", description: "重要且紧急", icon: "zap" },
	schedule: { action: "安排", description: "重要不紧急", icon: "calendar-clock" },
	delegate: { action: "委派", description: "紧急不重要", icon: "users" },
	eliminate: { action: "舍弃", description: "不重要不紧急", icon: "archive" },
};

const PERIODS = [
	{ id: "all", label: "全部" },
	{ id: "today", label: "今天" },
	{ id: "7d", label: "近 7 天" },
	{ id: "30d", label: "近 30 天" },
	{ id: "custom", label: "自定义" },
];

function cloneData(data) {
	return normalizeData(JSON.parse(JSON.stringify(data)));
}

function createIconButton(parent, icon, label, onClick, className = "") {
	const button = parent.createEl("button", {
		cls: `clickable-icon qt-icon-button ${className}`.trim(),
		attr: { "aria-label": label, title: label, type: "button" },
	});
	setIcon(button, icon);
	button.addEventListener("click", onClick);
	return button;
}

function formatCompletedAt(value) {
	return new Intl.DateTimeFormat(undefined, {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	}).format(new Date(value));
}

class TextInputModal extends Modal {
	constructor(app, title, onSave, options = {}) {
		super(app);
		this.title = title;
		this.onSave = onSave;
		this.modalTitle = options.modalTitle || "编辑任务";
		this.inputLabel = options.inputLabel || "任务内容";
		this.maxLength = options.maxLength || null;
	}

	onOpen() {
		this.setTitle(this.modalTitle);
		const input = this.contentEl.createEl("input", {
			cls: "qt-modal-input",
			attr: { type: "text", value: this.title, "aria-label": this.inputLabel },
		});
		if (this.maxLength) input.maxLength = this.maxLength;
		const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
		const cancel = actions.createEl("button", { text: "取消" });
		const save = actions.createEl("button", { text: "保存", cls: "mod-cta" });
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
}

class QuadrantBoardRenderChild extends MarkdownRenderChild {
	constructor(containerEl, plugin, sourcePath, source) {
		super(containerEl);
		this.plugin = plugin;
		this.sourcePath = sourcePath;
		const parsed = parseBoardSource(source);
		this.boardId = parsed.boardId;
		this.boardTitle = parsed.title;
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

	setBoardData(data, title = this.boardTitle) {
		this.data = cloneData(data);
		this.boardTitle = title || DEFAULT_BOARD_TITLE;
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
		return outcome?.result || null;
	}

	render() {
		const container = this.containerEl;
		container.empty();
		container.addClass("qt-root", "qt-embed");
		if (!this.boardId || this.issues.length) {
			container.createDiv({
				cls: "qt-storage-error",
				text: this.issues.join("；") || "四象限代码块缺少 board-id",
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
		const titleRow = titleGroup.createDiv({ cls: "qt-title-row" });
		titleRow.createEl("h3", { text: this.boardTitle });
		createIconButton(titleRow, "pencil", "编辑四象限标题", () => this.openBoardTitleEditor(), "qt-title-edit");
		const stats = titleGroup.createDiv({ cls: "qt-stats", attr: { "aria-live": "polite" } });
		stats.createSpan({ text: `${getActiveTasks(this.data).length} 项进行中` });
		stats.createSpan({ text: `${getCompletedTasks(this.data).length} 项已完成` });
	}

	renderQuadrant(matrix, quadrant) {
		const meta = QUADRANT_META[quadrant];
		const tasks = getActiveTasks(this.data, quadrant);
		const section = matrix.createEl("section", {
			cls: `qt-quadrant qt-quadrant-${quadrant}`,
			attr: { "data-quadrant": quadrant, "aria-label": `${meta.action}，${meta.description}` },
		});
		const header = section.createEl("header", { cls: "qt-quadrant-header" });
		const heading = header.createDiv({ cls: "qt-quadrant-heading" });
		const icon = heading.createSpan({ cls: "qt-quadrant-icon", attr: { "aria-hidden": "true" } });
		setIcon(icon, meta.icon);
		const labels = heading.createDiv();
		const title = labels.createEl("h3", { text: meta.description });
		title.createSpan({ text: String(tasks.length), cls: "qt-count" });
		labels.createDiv({ text: meta.action, cls: "qt-quadrant-description" });

		const quickAdd = section.createDiv({ cls: "qt-quick-add" });
		const input = quickAdd.createEl("input", {
			attr: { type: "text", placeholder: "添加任务", "aria-label": `添加到${meta.action}` },
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
		createIconButton(quickAdd, "plus", `添加到${meta.action}`, () => void submit(), "qt-add-button");

		const list = section.createEl("ul", { cls: "qt-task-list" });
		if (tasks.length === 0) list.createEl("li", { text: "暂无任务", cls: "qt-empty" });
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
			event.preventDefault();
			section.removeClass("qt-drop-target");
			const taskId = event.dataTransfer?.getData("text/plain") || this.draggedTaskId;
			this.draggedTaskId = null;
			if (taskId) void this.mutate((data) => moveTask(data, taskId, quadrant));
		});
	}

	renderActiveTask(list, task) {
		const row = list.createEl("li", {
			cls: "qt-task-row",
			attr: { draggable: "true", "data-task-id": task.id },
		});
		const checkbox = row.createEl("input", {
			cls: "qt-task-checkbox",
			attr: { type: "checkbox", "aria-label": `完成任务：${task.title}` },
		});
		checkbox.addEventListener("change", () => void this.complete(task.id));
		const title = row.createEl("button", {
			text: task.title,
			cls: "qt-task-title",
			attr: { type: "button", title: "编辑任务" },
		});
		title.addEventListener("click", () => this.openEditor(task));
		createIconButton(row, "more-horizontal", "更多操作", (event) => this.openTaskMenu(event, task));
		row.addEventListener("dragstart", (event) => {
			this.draggedTaskId = task.id;
			row.addClass("qt-dragging");
			event.dataTransfer?.setData("text/plain", task.id);
		});
		row.addEventListener("dragend", () => {
			this.draggedTaskId = null;
			row.removeClass("qt-dragging");
			this.containerEl.querySelectorAll(".qt-drop-target").forEach((element) => element.removeClass("qt-drop-target"));
		});
	}

	openEditor(task) {
		new TextInputModal(this.plugin.app, task.title, (title) => {
			void this.mutate((data) => editTask(data, task.id, title));
		}).open();
	}

	openBoardTitleEditor() {
		new TextInputModal(this.plugin.app, this.boardTitle, (title) => {
			void this.plugin.renameBoard(this.sourcePath, this.boardId, title);
		}, {
			modalTitle: "编辑四象限标题",
			inputLabel: "四象限标题",
			maxLength: 120,
		}).open();
	}

	openTaskMenu(event, task) {
		const menu = new Menu();
		menu.addItem((item) => item.setTitle("编辑").setIcon("pencil").onClick(() => this.openEditor(task)));
		for (const quadrant of QUADRANTS) {
			const meta = QUADRANT_META[quadrant];
			menu.addItem((item) => {
				item.setTitle(`移至：${meta.action}`).setIcon(meta.icon).setDisabled(task.quadrant === quadrant);
				item.onClick(() => void this.mutate((data) => moveTask(data, task.id, quadrant)));
			});
		}
		menu.addSeparator();
		menu.addItem((item) =>
			item.setTitle("删除").setIcon("trash-2").setWarning(true).onClick(() => void this.remove(task.id)),
		);
		menu.showAtMouseEvent(event);
	}

	async complete(taskId) {
		const task = await this.mutate((data) => completeTask(data, taskId));
		if (!task) return;
		this.plugin.showUndo("任务已完成", () => this.mutate((data) => restoreTask(data, taskId)));
	}

	async restore(taskId) {
		const task = await this.mutate((data) => restoreTask(data, taskId));
		if (!task) return;
		this.plugin.showUndo("任务已恢复", () => this.mutate((data) => completeTask(data, taskId)));
	}

	async remove(taskId) {
		const deleted = await this.mutate((data) => deleteTask(data, taskId));
		if (!deleted) return;
		this.plugin.showUndo("任务已删除", () => this.mutate((data) => restoreDeletedTask(data, deleted)));
	}

	renderCompleted(container) {
		const section = container.createEl("section", { cls: "qt-completed-section" });
		const header = section.createEl("header", { cls: "qt-completed-header" });
		const titleGroup = header.createDiv();
		titleGroup.createEl("h3", { text: "已完成" });
		const allCompleted = getCompletedTasks(this.data);
		const bounds = completionBounds(this.filters);
		const tasks = getCompletedTasks(this.data, this.filters);
		titleGroup.createSpan({
			text: `${tasks.length} / ${allCompleted.length}`,
			cls: "qt-completed-count",
			attr: { "aria-live": "polite" },
		});

		const controls = section.createDiv({ cls: "qt-filters" });
		const quadrantSelect = controls.createEl("select", { attr: { "aria-label": "按来源象限筛选" } });
		quadrantSelect.createEl("option", { text: "全部象限", value: "all" });
		for (const quadrant of QUADRANTS) {
			quadrantSelect.createEl("option", { text: QUADRANT_META[quadrant].action, value: quadrant });
		}
		quadrantSelect.value = this.filters.quadrant;
		quadrantSelect.addEventListener("change", () => {
			this.filters.quadrant = quadrantSelect.value;
			this.render();
		});

		const periods = controls.createDiv({ cls: "qt-periods", attr: { role: "group", "aria-label": "完成时间" } });
		for (const period of PERIODS) {
			const button = periods.createEl("button", {
				text: period.label,
				cls: this.filters.period === period.id ? "is-active" : "",
				attr: { type: "button", "aria-pressed": String(this.filters.period === period.id) },
			});
			button.addEventListener("click", () => {
				this.filters.period = period.id;
				this.render();
			});
		}
		if (this.filters.period === "custom") this.renderCustomRange(controls);

		const list = section.createEl("ul", { cls: "qt-completed-list" });
		if (!bounds.valid) {
			list.createEl("li", { text: "开始日期不能晚于结束日期", cls: "qt-empty qt-filter-error" });
		} else if (tasks.length === 0) {
			list.createEl("li", {
				text: allCompleted.length === 0 ? "还没有已完成的任务" : "没有符合筛选条件的任务",
				cls: "qt-empty",
			});
		} else {
			for (const task of tasks) this.renderCompletedTask(list, task);
		}
	}

	renderCustomRange(controls) {
		const range = controls.createDiv({ cls: "qt-custom-range" });
		const start = range.createEl("input", { attr: { type: "date", "aria-label": "完成时间起始日期" } });
		start.value = this.filters.startDate;
		range.createSpan({ text: "至" });
		const end = range.createEl("input", { attr: { type: "date", "aria-label": "完成时间结束日期" } });
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
			attr: { type: "checkbox", "aria-label": `恢复任务：${task.title}` },
		});
		checkbox.checked = true;
		checkbox.addEventListener("change", () => void this.restore(task.id));
		const content = row.createDiv({ cls: "qt-completed-content" });
		content.createDiv({ text: task.title, cls: "qt-completed-title" });
		const metadata = content.createDiv({ cls: "qt-completed-meta" });
		metadata.createSpan({ text: QUADRANT_META[task.quadrant].action, cls: `qt-badge qt-badge-${task.quadrant}` });
		metadata.createEl("time", { text: formatCompletedAt(task.completedAt), attr: { datetime: task.completedAt } });
		createIconButton(row, "trash-2", "删除任务", () => void this.remove(task.id));
	}
}

class QuadrantTasksPlugin extends Plugin {
	async onload() {
		this.boardRenderers = new Set();
		this.fileQueues = new Map();
		this.refreshTimers = new Map();

		this.registerMarkdownCodeBlockProcessor(BOARD_LANGUAGE, (source, element, context) => {
			context.addChild(new QuadrantBoardRenderChild(element, this, context.sourcePath, source));
		});
		this.addCommand({
			id: "insert-quadrant-board",
			name: "在当前光标处插入四象限",
			editorCallback: (editor) => this.insertBoard(editor),
		});
		this.addRibbonIcon("layout-grid", "插入四象限", () => this.insertBoardIntoActiveNote());
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
				ch: insertedLines[insertedLines.length - 1].length,
			});
		}
		new Notice("已插入独立四象限");
	}

	insertBoardIntoActiveNote() {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view?.editor) {
			new Notice("请先打开一个可编辑的 Markdown 文件");
			return;
		}
		this.insertBoard(view.editor);
	}

	async updateBoard(sourcePath, boardId, updater) {
		const file = this.app.vault.getAbstractFileByPath(sourcePath);
		if (!(file instanceof TFile)) {
			new Notice("找不到这张四象限所在的 Markdown 文件");
			return null;
		}

		let outcome = null;
		const previous = this.fileQueues.get(file) || Promise.resolve();
		const pending = previous.catch(() => undefined).then(() =>
			this.app.vault.process(file, (content) => {
				outcome = updater(content, boardId);
				return outcome.content;
			}),
		);
		this.fileQueues.set(file, pending);
		try {
			await pending;
			if (this.fileQueues.get(file) === pending) this.fileQueues.delete(file);
			if (outcome) this.refreshBoardRenderers(sourcePath, boardId, outcome.data, outcome.title);
			return outcome;
		} catch (error) {
			if (this.fileQueues.get(file) === pending) this.fileQueues.delete(file);
			console.error("Quadrant Tasks failed to update a local board", error);
			new Notice(`四象限保存失败：${error.message}`, 10000);
			await this.refreshFileRenderers(sourcePath);
			return null;
		}
	}

	mutateBoard(sourcePath, boardId, mutator) {
		return this.updateBoard(sourcePath, boardId, (content, targetBoardId) =>
			mutateBoardDocument(content, targetBoardId, mutator),
		);
	}

	renameBoard(sourcePath, boardId, title) {
		return this.updateBoard(sourcePath, boardId, (content, targetBoardId) =>
			renameBoardDocument(content, targetBoardId, title),
		);
	}

	refreshBoardRenderers(sourcePath, boardId, data, title) {
		for (const renderer of this.boardRenderers) {
			if (renderer.sourcePath === sourcePath && renderer.boardId === boardId) renderer.setBoardData(data, title);
		}
	}

	async refreshFileRenderers(sourcePath) {
		const renderers = [...this.boardRenderers].filter((renderer) => renderer.sourcePath === sourcePath);
		if (!renderers.length) return;
		const file = this.app.vault.getAbstractFileByPath(sourcePath);
		if (!(file instanceof TFile)) {
			for (const renderer of renderers) renderer.setBoardError(new Error("所在的 Markdown 文件不可用"));
			return;
		}
		await (this.fileQueues.get(file) || Promise.resolve()).catch(() => undefined);
		try {
			const content = await this.app.vault.read(file);
			for (const renderer of renderers) {
				try {
					const board = readBoardFromDocument(content, renderer.boardId);
					renderer.setBoardData(board.data, board.title);
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
		const raw = await this.loadData();
		if (raw?.settingsVersion === SETTINGS_VERSION) return;
		if (!raw) {
			await this.saveData({ settingsVersion: SETTINGS_VERSION });
			return;
		}

		try {
			const legacyJson = Array.isArray(raw.tasks) ? normalizeData(raw) : null;
			let expectedData = legacyJson;
			const sourcePath = normalizePath(raw.taskFilePath || DEFAULT_MIGRATION_PATH);
			let jsonBackup = raw.migration?.backupFile || null;
			if (legacyJson) jsonBackup = await this.backupLegacyJson(raw);
			let file = this.app.vault.getAbstractFileByPath(sourcePath);
			if (!(file instanceof TFile)) {
				if (!legacyJson) throw new Error(`找不到旧任务文件：${sourcePath}`);
				file = await this.app.vault.create(
					sourcePath,
					`# Quadrant Tasks\n\n${renderBoardCodeBlock(LEGACY_BOARD_ID, legacyJson)}\n`,
				);
			} else {
				const before = await this.app.vault.read(file);
				const legacyParsed = parseTaskMarkdown(before);
				if (legacyParsed.hasManagedBlock) await this.backupLegacyNote(before);
				await this.app.vault.process(file, (content) => {
					const parsed = parseTaskMarkdown(content);
					if (parsed.issues.length) throw new Error(`旧任务内容异常：${parsed.issues.join("；")}`);
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
					if (existing.length > 1) throw new Error(`同一文件中存在重复的 board-id：${LEGACY_BOARD_ID}`);
					if (legacyJson) {
						expectedData = legacyJson;
						return appendBoardCodeBlock(content, LEGACY_BOARD_ID, legacyJson);
					}
					if (findBoardCodeBlocks(content).length) return content;
					throw new Error("旧任务文件中没有可迁移的数据");
				});
			}

			const verifiedContent = await this.app.vault.read(file);
			const migrated = readBoardFromDocument(verifiedContent, LEGACY_BOARD_ID).data;
			if (!expectedData) throw new Error("迁移校验失败：缺少预期任务数据");
			if (expectedData.tasks.length !== migrated.tasks.length) throw new Error("迁移校验失败：任务数量不一致");
			const migratedById = new Map(migrated.tasks.map((task) => [task.id, task]));
			if (expectedData.tasks.some((task) => JSON.stringify(migratedById.get(task.id)) !== JSON.stringify(task))) {
				throw new Error("迁移校验失败：任务内容不一致");
			}
			await this.saveData({
				settingsVersion: SETTINGS_VERSION,
				migration: {
					fromVersion: Array.isArray(raw.tasks) ? "1.0.0" : "1.1.0",
					completedAt: new Date().toISOString(),
					sourcePath,
					boardId: LEGACY_BOARD_ID,
					jsonBackup,
				},
			});
			new Notice("旧的全局任务已迁移为 Markdown 文件中的独立四象限", 10000);
		} catch (error) {
			console.error("Quadrant Tasks could not migrate global storage", error);
			new Notice(`旧任务迁移失败：${error.message}`, 12000);
		}
	}

	async backupLegacyJson(raw) {
		if (!this.manifest.dir) throw new Error("插件目录不可用，无法备份旧数据");
		return this.writeVersionedBackup(LEGACY_JSON_BACKUP, `${JSON.stringify(raw, null, 2)}\n`);
	}

	async backupLegacyNote(content) {
		if (!this.manifest.dir) throw new Error("插件目录不可用，无法备份旧任务文件");
		return this.writeVersionedBackup(LEGACY_NOTE_BACKUP, content);
	}

	async writeVersionedBackup(fileName, content) {
		const adapter = this.app.vault.adapter;
		let candidate = fileName;
		let path = normalizePath(`${this.manifest.dir}/${candidate}`);
		if (await adapter.exists(path)) {
			if ((await adapter.read(path)) === content) return candidate;
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
		button.textContent = "撤销";
		fragment.append(button);
		const notice = new Notice(fragment, 6000);
		button.addEventListener("click", async () => {
			if (await onUndo()) notice.hide();
		});
	}
}

module.exports = QuadrantTasksPlugin;
