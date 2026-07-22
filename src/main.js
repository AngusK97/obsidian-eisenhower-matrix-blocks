"use strict";

const {
	ItemView,
	Menu,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	normalizePath,
	setIcon,
} = require("obsidian");
const {
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
	restoreTask,
} = require("./core");
const {
	mergeTaskData,
	parseTaskMarkdown,
	updateMarkdownDocument,
} = require("./markdown-store");

const VIEW_TYPE = "quadrant-tasks-view";
const DEFAULT_TASK_FILE_PATH = "Quadrant Tasks.md";
const SETTINGS_VERSION = 1;
const LEGACY_BACKUP_NAME = "data-backup-1.0.0.json";

const QUADRANT_META = {
	do: {
		action: "立即做",
		description: "重要且紧急",
		icon: "zap",
	},
	schedule: {
		action: "安排",
		description: "重要不紧急",
		icon: "calendar-clock",
	},
	delegate: {
		action: "委派",
		description: "紧急不重要",
		icon: "users",
	},
	eliminate: {
		action: "舍弃",
		description: "不重要不紧急",
		icon: "archive",
	},
};

const PERIODS = [
	{ id: "all", label: "全部" },
	{ id: "today", label: "今天" },
	{ id: "7d", label: "近 7 天" },
	{ id: "30d", label: "近 30 天" },
	{ id: "custom", label: "自定义" },
];

function createIconButton(parent, icon, label, onClick, className = "") {
	const button = parent.createEl("button", {
		cls: `clickable-icon qt-icon-button ${className}`.trim(),
		attr: { "aria-label": label, type: "button" },
	});
	setIcon(button, icon);
	button.addEventListener("click", onClick);
	return button;
}

function formatCompletedAt(value) {
	const date = new Date(value);
	return new Intl.DateTimeFormat(undefined, {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	}).format(date);
}

class TaskTitleModal extends Modal {
	constructor(app, title, onSave) {
		super(app);
		this.title = title;
		this.onSave = onSave;
	}

	onOpen() {
		this.setTitle("编辑任务");
		const input = this.contentEl.createEl("input", {
			cls: "qt-modal-input",
			attr: { type: "text", value: this.title, "aria-label": "任务内容" },
		});
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

class QuadrantTasksView extends ItemView {
	constructor(leaf, plugin) {
		super(leaf);
		this.plugin = plugin;
		this.filters = {
			quadrant: "all",
			period: "all",
			startDate: "",
			endDate: "",
		};
		this.draggedTaskId = null;
	}

	getViewType() {
		return VIEW_TYPE;
	}

	getDisplayText() {
		return "四象限任务";
	}

	getIcon() {
		return "layout-grid";
	}

	async onOpen() {
		this.render();
	}

	async onClose() {}

	render() {
		const container = this.contentEl;
		container.empty();
		container.addClass("qt-root");

		this.renderHeader(container);
		if (!this.plugin.storageReady) {
			container.createDiv({ cls: "qt-storage-loading", text: "正在加载任务 Markdown 文件…" });
			return;
		}
		if (this.plugin.storageMode === "markdown" && this.plugin.storageIssue) {
			container.createDiv({
				cls: "qt-storage-error",
				text: "任务 Markdown 文件不可用。请恢复文件或修正插件管理区后再继续操作。",
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
		titleGroup.createEl("h2", { text: "四象限任务" });

		const stats = titleGroup.createDiv({ cls: "qt-stats", attr: { "aria-live": "polite" } });
		if (!this.plugin.storageReady) {
			stats.createSpan({ text: "正在加载" });
			return;
		}
		if (this.plugin.storageMode === "markdown" && this.plugin.storageIssue) {
			stats.createSpan({ text: "数据源不可用" });
			return;
		}
		const activeCount = getActiveTasks(this.plugin.data).length;
		const completedCount = getCompletedTasks(this.plugin.data).length;
		stats.createSpan({ text: `${activeCount} 项进行中` });
		stats.createSpan({ text: `${completedCount} 项已完成` });
	}

	renderQuadrant(matrix, quadrant) {
		const meta = QUADRANT_META[quadrant];
		const tasks = getActiveTasks(this.plugin.data, quadrant);
		const section = matrix.createEl("section", {
			cls: `qt-quadrant qt-quadrant-${quadrant}`,
			attr: { "data-quadrant": quadrant, "aria-label": `${meta.action}，${meta.description}` },
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
			attr: { type: "text", placeholder: "添加任务", "aria-label": `添加到${meta.action}` },
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
		createIconButton(quickAdd, "plus", `添加到${meta.action}`, () => void submit(), "qt-add-button");

		const list = section.createEl("ul", { cls: "qt-task-list" });
		if (tasks.length === 0) {
			list.createEl("li", { text: "暂无任务", cls: "qt-empty" });
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
			event.preventDefault();
			section.removeClass("qt-drop-target");
			const taskId = event.dataTransfer?.getData("text/plain") || this.draggedTaskId;
			this.draggedTaskId = null;
			if (taskId) void this.plugin.mutate((data) => moveTask(data, taskId, quadrant));
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
		menu.addItem((item) => item.setTitle("编辑").setIcon("pencil").onClick(() => this.openEditor(task)));
		for (const quadrant of QUADRANTS) {
			const meta = QUADRANT_META[quadrant];
			menu.addItem((item) => {
				item.setTitle(`移至：${meta.action}`).setIcon(meta.icon).setDisabled(task.quadrant === quadrant);
				item.onClick(() => {
					void this.plugin.mutate((data) => moveTask(data, task.id, quadrant));
				});
			});
		}
		menu.addSeparator();
		menu.addItem((item) =>
			item
				.setTitle("删除")
				.setIcon("trash-2")
				.setWarning(true)
				.onClick(() => void this.remove(task.id)),
		);
		menu.showAtMouseEvent(event);
	}

	async complete(taskId) {
		const task = await this.plugin.mutate((data) => completeTask(data, taskId));
		if (!task) return;
		this.plugin.showUndo("任务已完成", async () => {
			return this.plugin.mutate((data) => restoreTask(data, taskId));
		});
	}

	async restore(taskId) {
		const task = await this.plugin.mutate((data) => restoreTask(data, taskId));
		if (!task) return;
		this.plugin.showUndo("任务已恢复", async () => {
			return this.plugin.mutate((data) => completeTask(data, taskId));
		});
	}

	async remove(taskId) {
		const deleted = await this.plugin.mutate((data) => deleteTask(data, taskId));
		if (!deleted) return;
		this.plugin.showUndo("任务已删除", async () => {
			return this.plugin.mutate((data) => restoreDeletedTask(data, deleted));
		});
	}

	renderCompleted(container) {
		const section = container.createEl("section", { cls: "qt-completed-section" });
		const header = section.createEl("header", { cls: "qt-completed-header" });
		const titleGroup = header.createDiv();
		titleGroup.createEl("h3", { text: "已完成" });

		const allCompleted = getCompletedTasks(this.plugin.data);
		const bounds = completionBounds(this.filters);
		const tasks = getCompletedTasks(this.plugin.data, this.filters);
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
		const start = range.createEl("input", {
			attr: { type: "date", "aria-label": "完成时间起始日期" },
		});
		start.value = this.filters.startDate;
		range.createSpan({ text: "至" });
		const end = range.createEl("input", {
			attr: { type: "date", "aria-label": "完成时间结束日期" },
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
			attr: { type: "checkbox", "aria-label": `恢复任务：${task.title}` },
		});
		checkbox.checked = true;
		checkbox.addEventListener("change", () => void this.restore(task.id));

		const content = row.createDiv({ cls: "qt-completed-content" });
		content.createDiv({ text: task.title, cls: "qt-completed-title" });
		const metadata = content.createDiv({ cls: "qt-completed-meta" });
		metadata.createSpan({ text: meta.action, cls: `qt-badge qt-badge-${task.quadrant}` });
		metadata.createEl("time", { text: formatCompletedAt(task.completedAt), attr: { datetime: task.completedAt } });

		createIconButton(row, "trash-2", "删除任务", () => void this.remove(task.id));
	}
}

function cloneData(data) {
	return normalizeData(JSON.parse(JSON.stringify(data)));
}

function isLegacyData(raw) {
	return Boolean(raw && Array.isArray(raw.tasks));
}

function normalizeTaskFilePath(value) {
	const raw = typeof value === "string" ? value.trim() : "";
	if (raw && (/^[\\/]/.test(raw) || /^[a-z]:/i.test(raw) || raw.split(/[\\/]/).includes(".."))) {
		throw new Error("任务文件路径必须是笔记库内的相对路径");
	}
	const path = normalizePath(raw || DEFAULT_TASK_FILE_PATH);
	if (!path || !path.toLowerCase().endsWith(".md")) throw new Error("任务文件路径必须以 .md 结尾");
	if (path === ".obsidian" || path.startsWith(".obsidian/")) {
		throw new Error("任务文件必须位于笔记库中，不能放在 .obsidian 目录");
	}
	return path;
}

function storageSettings(raw) {
	let taskFilePath = DEFAULT_TASK_FILE_PATH;
	try {
		taskFilePath = normalizeTaskFilePath(raw?.taskFilePath);
	} catch {
		taskFilePath = DEFAULT_TASK_FILE_PATH;
	}
	return {
		taskFilePath,
		migration: raw?.migration && typeof raw.migration === "object" ? raw.migration : null,
	};
}

class QuadrantTasksSettingTab extends PluginSettingTab {
	constructor(app, plugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.pendingPath = plugin.settings.taskFilePath;
	}

	display() {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "四象限任务" });

		new Setting(containerEl)
			.setName("任务 Markdown 文件")
			.setDesc("四象限和已完成任务都保存在这个普通 Markdown 文件中。移动文件后，插件会继续跟随它。")
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_TASK_FILE_PATH)
					.setValue(this.plugin.settings.taskFilePath)
					.onChange((value) => {
						this.pendingPath = value;
					}),
			)
			.addButton((button) =>
				button.setButtonText("移动并使用").setCta().onClick(async () => {
					if (await this.plugin.moveTaskFile(this.pendingPath)) this.display();
				}),
			);

		new Setting(containerEl)
			.setName("打开任务文件")
			.setDesc("直接查看或手动编辑插件管理的 Markdown 任务列表。")
			.addButton((button) => button.setButtonText("打开").onClick(() => void this.plugin.openTaskFile()));
	}
}

class QuadrantTasksPlugin extends Plugin {
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
		this.addRibbonIcon("layout-grid", "打开四象限任务", () => void this.activateView());
		this.addCommand({
			id: "open-quadrant-tasks",
			name: "打开四象限任务",
			callback: () => void this.activateView(),
		});
		this.addCommand({
			id: "open-quadrant-task-file",
			name: "打开任务 Markdown 文件",
			callback: () => void this.openTaskFile(),
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
			new Notice("四象限任务存储初始化失败，请查看控制台。", 10000);
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
					completedAt: new Date().toISOString(),
					backupFile,
				};
				await this.saveStorageSettings();
				return;
			} catch (error) {
				this.storageMode = "legacy";
				this.data = normalizeData(raw);
				this.storageIssue = error;
				console.error("Quadrant Tasks could not migrate legacy data", error);
				new Notice("任务迁移到 Markdown 失败，插件已继续使用原有数据。请查看控制台。", 10000);
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
			new Notice("任务 Markdown 文件暂时不可用。插件不会覆盖或重建已有数据。", 10000);
		}
	}

	async backupLegacyData(raw) {
		if (!this.manifest.dir) throw new Error("插件目录不可用，无法备份旧数据");
		const adapter = this.app.vault.adapter;
		let backupFile = LEGACY_BACKUP_NAME;
		let backupPath = normalizePath(`${this.manifest.dir}/${backupFile}`);
		if (await adapter.exists(backupPath)) {
			try {
				const previous = JSON.parse(await adapter.read(backupPath));
				if (JSON.stringify(normalizeData(previous)) === JSON.stringify(normalizeData(raw))) return backupFile;
			} catch {
				// Keep an unreadable or different previous backup untouched.
			}
			backupFile = `data-backup-1.0.0-${Date.now()}.json`;
			backupPath = normalizePath(`${this.manifest.dir}/${backupFile}`);
		}
		await adapter.write(backupPath, `${JSON.stringify(raw, null, 2)}\n`);
		return backupFile;
	}

	async migrateLegacyData(legacyData) {
		await this.ensureTaskFile();
		const file = this.getTaskFile();
		let expectedData = null;
		await this.app.vault.process(file, (content) => {
			const parsed = parseTaskMarkdown(content);
			if (parsed.issues.length) throw new Error(`任务 Markdown 内容异常：${parsed.issues.join("；")}`);
			const existingById = new Map(parsed.data.tasks.map((task) => [task.id, task]));
			for (const legacyTask of legacyData.tasks) {
				const existing = existingById.get(legacyTask.id);
				if (existing && JSON.stringify(existing) !== JSON.stringify(legacyTask)) {
					throw new Error(`迁移冲突：任务 ${legacyTask.id} 在 Markdown 与旧数据中的内容不同`);
				}
			}
			expectedData = mergeTaskData(parsed.data, legacyData);
			return updateMarkdownDocument(content, expectedData);
		});

		const migrated = await this.readTaskData();
		const migratedById = new Map(migrated.tasks.map((task) => [task.id, task]));
		if (
			migrated.tasks.length !== expectedData.tasks.length
			|| expectedData.tasks.some((task) => JSON.stringify(migratedById.get(task.id)) !== JSON.stringify(task))
		) {
			throw new Error("迁移校验失败：Markdown 与预期任务内容不一致");
		}
		this.data = migrated;
	}

	async ensureTaskFile() {
		const existing = this.app.vault.getAbstractFileByPath(this.settings.taskFilePath);
		if (existing instanceof TFile) return existing;
		if (existing) throw new Error("任务文件路径已被文件夹占用");
		await this.ensureParentFolder(this.settings.taskFilePath);
		try {
			return await this.app.vault.create(
				this.settings.taskFilePath,
				updateMarkdownDocument("", normalizeData(null)),
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
		if (!(file instanceof TFile)) throw new Error(`找不到任务文件：${this.settings.taskFilePath}`);
		return file;
	}

	async readTaskData() {
		const content = await this.app.vault.read(this.getTaskFile());
		const parsed = parseTaskMarkdown(content);
		if (parsed.issues.length) throw new Error(`任务 Markdown 内容异常：${parsed.issues.join("；")}`);
		if (!parsed.hasManagedBlock) throw new Error("任务 Markdown 中缺少插件管理区");
		return parsed.data;
	}

	async saveStorageSettings() {
		await this.saveData({
			settingsVersion: SETTINGS_VERSION,
			taskFilePath: this.settings.taskFilePath,
			migration: this.settings.migration,
		});
	}

	async mutate(mutator) {
		if (!this.storageReady) {
			new Notice("任务文件仍在加载，请稍后再试。");
			return null;
		}
		let mutationResult = null;
		let committedData = null;
		const pendingSave = this.saveQueue.catch(() => undefined).then(async () => {
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
				if (parsed.issues.length) throw new Error(`任务 Markdown 内容异常：${parsed.issues.join("；")}`);
				if (!parsed.hasManagedBlock) throw new Error("任务 Markdown 中缺少插件管理区");
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
			if (this.saveQueue !== pendingSave) await this.saveQueue.catch(() => undefined);
			await this.reloadAfterFailure();
			console.error("Quadrant Tasks failed to save task data", error);
			new Notice("任务保存失败，磁盘内容未被覆盖。请检查任务 Markdown 文件。", 10000);
			return null;
		}
	}

	async reloadAfterFailure() {
		try {
			this.data = this.storageMode === "legacy"
				? normalizeData(await this.loadData())
				: await this.readTaskData();
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
		await this.saveQueue.catch(() => undefined);
		try {
			this.data = await this.readTaskData();
			this.storageIssue = null;
			this.renderViews();
		} catch (error) {
			this.storageIssue = error;
			console.error("Quadrant Tasks could not reload its Markdown file", error);
			if (notifyOnFailure) new Notice("任务 Markdown 文件已被删除或暂时不可用，写入已暂停。", 10000);
			this.renderViews();
		}
	}

	async followRenamedTaskFile(newPath) {
		try {
			await this.saveQueue.catch(() => undefined);
			this.settings.taskFilePath = normalizeTaskFilePath(newPath);
			try {
				await this.saveStorageSettings();
				this.settingsDirty = false;
			} catch (error) {
				this.settingsDirty = true;
				console.error("Quadrant Tasks could not save the renamed task path", error);
				new Notice("任务文件已重命名，但新路径暂时无法保存到插件设置。", 10000);
			}
			await this.reloadFromTaskFile();
			return true;
		} catch (error) {
			this.storageIssue = error;
			console.error("Quadrant Tasks could not follow its renamed Markdown file", error);
			new Notice(`无法继续跟随重命名后的任务文件：${error.message}`, 10000);
			this.renderViews();
			return false;
		}
	}

	async moveTaskFile(value) {
		if (!this.storageReady) {
			new Notice("任务文件仍在加载，请稍后再试。");
			return false;
		}
		if (this.storageMode !== "markdown") {
			new Notice("旧数据迁移尚未完成，当前不能移动任务 Markdown 文件。", 10000);
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
				new Notice(`无法保存任务文件路径：${error.message}`, 10000);
				return false;
			}
		}
		await this.saveQueue.catch(() => undefined);

		try {
			const file = this.getTaskFile();
			if (this.app.vault.getAbstractFileByPath(newPath)) throw new Error("目标路径已经存在文件或文件夹");
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
			new Notice(`任务文件已移动到 ${newPath}`);
			return true;
		} catch (error) {
			console.error("Quadrant Tasks could not move its Markdown file", error);
			new Notice(`无法移动任务文件：${error.message}`, 10000);
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
			if (!this.storageReady) throw new Error("任务文件仍在加载，请稍后再试");
			if (this.storageMode !== "markdown") throw new Error("旧数据迁移尚未完成，任务 Markdown 文件暂不可用");
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
		button.textContent = "撤销";
		fragment.append(button);
		const notice = new Notice(fragment, 6000);
		button.addEventListener("click", async () => {
			if (await onUndo()) notice.hide();
		});
	}
}

module.exports = QuadrantTasksPlugin;
