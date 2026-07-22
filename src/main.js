"use strict";

const { ItemView, Menu, Modal, Notice, Plugin, setIcon } = require("obsidian");
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

const VIEW_TYPE = "quadrant-tasks-view";

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
		const matrix = container.createDiv({ cls: "qt-matrix" });
		for (const quadrant of QUADRANTS) this.renderQuadrant(matrix, quadrant);
		this.renderCompleted(container);
	}

	renderHeader(container) {
		const header = container.createEl("header", { cls: "qt-page-header" });
		const titleGroup = header.createDiv({ cls: "qt-title-group" });
		titleGroup.createEl("h2", { text: "四象限任务" });

		const activeCount = getActiveTasks(this.plugin.data).length;
		const completedCount = getCompletedTasks(this.plugin.data).length;
		const stats = titleGroup.createDiv({ cls: "qt-stats", attr: { "aria-live": "polite" } });
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
		createIconButton(quickAdd, "plus", `添加到${meta.action}`, submit, "qt-add-button");

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
			if (taskId && moveTask(this.plugin.data, taskId, quadrant)) void this.plugin.commit();
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
			if (editTask(this.plugin.data, task.id, title)) void this.plugin.commit();
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
					if (moveTask(this.plugin.data, task.id, quadrant)) void this.plugin.commit();
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
		const task = completeTask(this.plugin.data, taskId);
		if (!task) return;
		if (!(await this.plugin.commit())) return;
		this.plugin.showUndo("任务已完成", async () => {
			restoreTask(this.plugin.data, taskId);
			await this.plugin.commit();
		});
	}

	async restore(taskId) {
		const task = restoreTask(this.plugin.data, taskId);
		if (!task) return;
		if (!(await this.plugin.commit())) return;
		this.plugin.showUndo("任务已恢复", async () => {
			completeTask(this.plugin.data, taskId);
			await this.plugin.commit();
		});
	}

	async remove(taskId) {
		const deleted = deleteTask(this.plugin.data, taskId);
		if (!deleted) return;
		if (!(await this.plugin.commit())) return;
		this.plugin.showUndo("任务已删除", async () => {
			restoreDeletedTask(this.plugin.data, deleted);
			await this.plugin.commit();
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

class QuadrantTasksPlugin extends Plugin {
	async onload() {
		this.data = normalizeData(await this.loadData());
		this.saveQueue = Promise.resolve();

		this.registerView(VIEW_TYPE, (leaf) => new QuadrantTasksView(leaf, this));
		this.addRibbonIcon("layout-grid", "打开四象限任务", () => void this.activateView());
		this.addCommand({
			id: "open-quadrant-tasks",
			name: "打开四象限任务",
			callback: () => void this.activateView(),
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
		const pendingSave = this.saveQueue.catch(() => undefined).then(() => this.saveData(snapshot));
		this.saveQueue = pendingSave;
		this.renderViews();
		try {
			await pendingSave;
			return true;
		} catch (error) {
			// A later queued save may already contain this mutation, so settle it before reloading disk state.
			if (this.saveQueue !== pendingSave) await this.saveQueue.catch(() => undefined);
			this.data = normalizeData(await this.loadData());
			this.renderViews();
			console.error("Quadrant Tasks failed to save plugin data", error);
			new Notice("任务保存失败，已恢复到上次保存的状态");
			return false;
		}
	}

	renderViews() {
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
			if (leaf.view instanceof QuadrantTasksView) leaf.view.render();
		}
	}

	async onExternalSettingsChange() {
		await this.saveQueue.catch(() => undefined);
		this.data = normalizeData(await this.loadData());
		this.renderViews();
	}

	showUndo(message, onUndo) {
		const fragment = document.createDocumentFragment();
		fragment.append(document.createTextNode(`${message} `));
		const button = document.createElement("button");
		button.className = "qt-undo-button";
		button.textContent = "撤销";
		fragment.append(button);
		const notice = new Notice(fragment, 6000);
		button.addEventListener("click", () => {
			void onUndo();
			notice.hide();
		});
	}
}

module.exports = QuadrantTasksPlugin;
