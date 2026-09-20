"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const { readFileSync } = require("node:fs");
const { dirname, join } = require("node:path");
const { addTask, completeTask, createEmptyData } = require("../src/core");
const { renderBoardSource } = require("../src/board-store");
const { translate } = require("../src/i18n");

class FakeElement {
	constructor(tagName = "div", options = {}) {
		this.tagName = tagName.toUpperCase();
		this.children = [];
		this.parentElement = null;
		this.attributes = {};
		this.classes = new Set();
		this.listeners = new Map();
		this.text = options.text || "";
		this.value = "";
		this.checked = false;
		this.hidden = false;
		this.scrollHeight = 160;
		this.style = {};
		if (options.cls) this.addClass(...options.cls.split(/\s+/).filter(Boolean));
		for (const [name, value] of Object.entries(options.attr || {})) this.setAttribute(name, value);
	}

	createEl(tagName, options) {
		return this.appendChild(new FakeElement(tagName, options));
	}

	createDiv(options) {
		return this.createEl("div", options);
	}

	createSpan(options) {
		return this.createEl("span", options);
	}

	appendChild(child) {
		child.parentElement = this;
		this.children.push(child);
		return child;
	}

	empty() {
		this.children = [];
		this.text = "";
	}

	addClass(...names) {
		for (const name of names) this.classes.add(name);
	}

	removeClass(...names) {
		for (const name of names) this.classes.delete(name);
	}

	hasClass(name) {
		return this.classes.has(name);
	}

	setAttribute(name, value) {
		this.attributes[name] = String(value);
		if (name === "value") this.value = String(value);
		if (name === "hidden") this.hidden = true;
	}

	getAttribute(name) {
		return this.attributes[name] ?? null;
	}

	addEventListener(type, listener) {
		const listeners = this.listeners.get(type) || [];
		listeners.push(listener);
		this.listeners.set(type, listeners);
	}

	removeEventListener(type, listener) {
		this.listeners.set(type, (this.listeners.get(type) || []).filter((item) => item !== listener));
	}

	dispatch(type, event = {}) {
		const dispatched = {
			preventDefault() { this.defaultPrevented = true; },
			stopPropagation() { this.propagationStopped = true; },
			...event,
		};
		for (const listener of this.listeners.get(type) || []) listener(dispatched);
		return dispatched;
	}

	contains(candidate) {
		return candidate === this || this.children.some((child) => child.contains(candidate));
	}

	querySelectorAll(selector) {
		const selectors = selector.split(",").map((part) => part.trim());
		return this.descendants().filter((element) => selectors.some((part) => element.matches(part)));
	}

	querySelector(selector) {
		return this.querySelectorAll(selector)[0] || null;
	}

	descendants() {
		return this.children.flatMap((child) => [child, ...child.descendants()]);
	}

	matches(selector) {
		if (selector.startsWith(".")) return this.hasClass(selector.slice(1));
		const attribute = selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
		if (attribute) {
			const value = this.getAttribute(attribute[1]);
			return value !== null && (attribute[2] === undefined || value === attribute[2]);
		}
		return this.tagName === selector.toUpperCase();
	}

	closest(selector) {
		for (let element = this; element; element = element.parentElement) {
			if (element.matches(selector)) return element;
		}
		return null;
	}

	get textContent() {
		return this.text + this.children.map((child) => child.textContent).join("");
	}

	set textContent(value) {
		this.children = [];
		this.text = value;
	}

	focus() {}
	select() {}
	getBoundingClientRect() { return { top: 0, height: 44 }; }
}

class Component {}
class MarkdownRenderChild extends Component {
	constructor(containerEl) {
		super();
		this.containerEl = containerEl;
	}
}
class Modal extends Component {
	constructor() {
		super();
		this.contentEl = new FakeElement();
		this.closed = false;
		Modal.latest = this;
	}

	setTitle(title) { this.title = title; }
	open() { this.onOpen(); }
	close() { this.closed = true; this.onClose(); }
}
class Plugin extends Component {}
class MarkdownView {}
class Notice { constructor() {} }
class Menu {}
class PluginSettingTab extends Component {}
class Setting {}
class TFile {}

function loadUiClasses() {
	const filename = join(__dirname, "..", "src", "main.js");
	const source = readFileSync(filename, "utf8").replace(
		/module\.exports = EisenhowerMatrixBlocksPlugin;\s*$/,
		"module.exports = { MatrixBoardRenderChild, TextInputModal };",
	);
	const originalLoad = Module._load;
	Module._load = function mockObsidian(request, parent, isMain) {
		if (request === "obsidian") {
			return {
				MarkdownRenderChild,
				MarkdownView,
				Menu,
				Modal,
				Notice,
				Plugin,
				PluginSettingTab,
				Setting,
				TFile,
				getLanguage: () => "en",
				normalizePath: (path) => path.replaceAll("\\", "/"),
				setIcon() {},
			};
		}
		return originalLoad.call(this, request, parent, isMain);
	};
	try {
		const injected = new Module(filename, module);
		injected.filename = filename;
		injected.paths = Module._nodeModulePaths(dirname(filename));
		injected._compile(source, filename);
		return injected.exports;
	} finally {
		Module._load = originalLoad;
	}
}

function createRenderer(data) {
	const { MatrixBoardRenderChild } = loadUiClasses();
	const container = new FakeElement();
	const plugin = {
		boardRenderers: new Set(),
		language: "en",
		t: (key, variables) => translate("en", key, variables),
		getQuadrantMeta(quadrant) {
			return {
				icon: "circle",
				action: translate("en", `quadrant.${quadrant}.action`),
				description: translate("en", `quadrant.${quadrant}.description`),
			};
		},
	};
	const renderer = new MatrixBoardRenderChild(container, plugin, "Projects.md", renderBoardSource("board-alpha", data));
	renderer.onload();
	return { container, renderer };
}

function findByLabel(container, label) {
	return container.descendants().find((element) => element.getAttribute("aria-label") === label) || null;
}

test("task editing uses a growing multiline control and Enter saves, prevents default, and closes", async () => {
	const { TextInputModal } = loadUiClasses();
	let saved = null;
	const plugin = { app: {}, t: (key) => translate("en", key) };
	const originalAnimationFrame = global.requestAnimationFrame;
	global.requestAnimationFrame = (callback) => callback();
	try {
		const modal = new TextInputModal(plugin, "Before", async (value) => { saved = value; });
		modal.open();
		const editor = modal.contentEl.querySelector("textarea");
		assert.ok(editor, "task content should use a textarea so wrapped text can grow vertically");
		editor.value = "A much longer replacement task";
		editor.dispatch("input");
		assert.equal(editor.style.height, "160px", "the editor should grow to its wrapped content height");
		const event = editor.dispatch("keydown", { key: "Enter", isComposing: false });
		await new Promise((resolve) => setImmediate(resolve));

		assert.equal(event.defaultPrevented, true);
		assert.equal(saved, "A much longer replacement task");
		assert.equal(modal.closed, true);
	} finally {
		global.requestAnimationFrame = originalAnimationFrame;
	}
});

test("task textareas preserve the existing single-line Markdown title format", async () => {
	const { TextInputModal } = loadUiClasses();
	let saved = null;
	const plugin = { app: {}, t: (key) => translate("en", key) };
	const originalAnimationFrame = global.requestAnimationFrame;
	global.requestAnimationFrame = (callback) => callback();
	try {
		const modal = new TextInputModal(plugin, "Before", async (value) => { saved = value; });
		modal.open();
		const editor = modal.contentEl.querySelector("textarea");
		editor.value = "First line\nSecond line\r\nThird line";
		editor.dispatch("keydown", { key: "Enter", isComposing: false });
		await new Promise((resolve) => setImmediate(resolve));

		assert.equal(saved, "First line Second line Third line");
	} finally {
		global.requestAnimationFrame = originalAnimationFrame;
	}
});

test("task editing ignores IME Enter and submits only once while save is pending", async () => {
	const { TextInputModal } = loadUiClasses();
	let saveCount = 0;
	let resolveSave;
	const savePending = new Promise((resolve) => { resolveSave = resolve; });
	const plugin = { app: {}, t: (key) => translate("en", key) };
	const originalAnimationFrame = global.requestAnimationFrame;
	global.requestAnimationFrame = (callback) => callback();
	try {
		const modal = new TextInputModal(plugin, "Before", async () => {
			saveCount += 1;
			await savePending;
		});
		modal.open();
		const editor = modal.contentEl.querySelector("textarea");
		editor.value = "After";
		editor.dispatch("keydown", { key: "Enter", isComposing: true });
		assert.equal(saveCount, 0, "IME confirmation must not submit the task");

		editor.dispatch("keydown", { key: "Enter", isComposing: false });
		editor.dispatch("keydown", { key: "Enter", isComposing: false });
		await new Promise((resolve) => setImmediate(resolve));
		assert.equal(saveCount, 1, "repeated Enter must not start concurrent saves");
		assert.equal(modal.closed, false, "the editor remains visible until persistence succeeds");

		resolveSave();
		await new Promise((resolve) => setImmediate(resolve));
		assert.equal(modal.closed, true);
	} finally {
		global.requestAnimationFrame = originalAnimationFrame;
	}
});

test("quick add uses a growing multiline control for long mobile task text", () => {
	const { container } = createRenderer(createEmptyData());
	const quickAdd = container.querySelector(".qt-quick-add");
	const editor = quickAdd.querySelector("textarea");

	assert.ok(editor, "quick add should expose the whole wrapped task instead of a one-line tail");
	editor.dispatch("input");
	assert.equal(editor.style.height, "160px", "quick add should grow to its wrapped content height");
});

test("matrix collapse keeps a compact summary and its state survives a data refresh", () => {
	const data = createEmptyData();
	addTask(data, "Do now", "do", { idFactory: () => "active" });
	const completed = addTask(data, "Finished", "schedule", { idFactory: () => "completed" });
	completeTask(data, completed.id, new Date("2026-08-20T08:00:00.000Z"));
	const { container, renderer } = createRenderer(data);
	const collapse = container.querySelector('[aria-expanded="true"]');
	assert.ok(collapse, "the expanded matrix should expose a collapse control");
	collapse.dispatch("click");

	assert.ok(container.querySelector('[aria-expanded="false"]'));
	assert.equal(container.querySelector(".qt-matrix"), null);
	assert.equal(container.querySelector(".qt-completed-section"), null);
	for (const text of ["Matrix", "Important and urgent", "1", "Important, not urgent", "0", "Urgent, not important", "Neither important nor urgent", "1 completed"]) {
		assert.match(container.textContent, new RegExp(text));
	}

	renderer.setBoardData(data);
	assert.ok(container.querySelector('[aria-expanded="false"]'), "refreshing note data should not expand a matrix the user collapsed");
});

test("completed list toggles a keyboard-scrollable bounded mode and keeps it after refresh", () => {
	const data = createEmptyData();
	const completed = addTask(data, "Finished", "do", { idFactory: () => "completed" });
	completeTask(data, completed.id, new Date("2026-08-20T08:00:00.000Z"));
	const { container, renderer } = createRenderer(data);
	const toggle = container
		.querySelectorAll('[aria-pressed="true"]')
		.find((element) => !element.parentElement?.hasClass("qt-periods"));
	assert.ok(toggle, "the completed section should expose a scroll-mode toggle");
	assert.equal(container.querySelector(".qt-completed-list").getAttribute("tabindex"), "0");
	toggle.dispatch("click");
	assert.equal(container.querySelector(".qt-completed-list").getAttribute("tabindex"), null);
	container.querySelector(".qt-completed-scroll-toggle").dispatch("click");

	assert.ok(container.querySelector('[aria-pressed="true"]'));
	assert.equal(container.querySelector(".qt-completed-list").getAttribute("tabindex"), "0");
	renderer.setBoardData(data);
	assert.ok(container.querySelector('[aria-pressed="true"]'), "refreshing note data should preserve completed-list scroll mode");
});

test("completed defaults to today and excludes older completions", () => {
	const data = createEmptyData();
	const today = addTask(data, "Today task", "do");
	const old = addTask(data, "Old task", "do");
	completeTask(data, today.id, new Date());
	completeTask(data, old.id, new Date(2020, 0, 1));
	const { container, renderer } = createRenderer(data);
	assert.equal(renderer.filters.period, "today");
	assert.match(container.querySelector(".qt-completed-list").textContent, /Today task/);
	assert.doesNotMatch(container.querySelector(".qt-completed-list").textContent, /Old task/);
});

test("task cards display deadline, relative days, urgent state and plaintext notes", () => {
	const data = createEmptyData();
	const task = addTask(data, "Details", "do");
	const { container, renderer } = createRenderer(data);
	renderer.data.tasks[0].dueDate = "2020-01-01";
	renderer.data.tasks[0].notes = "<b>plain text</b>\nsecond line";
	renderer.render();
	assert.match(container.querySelector(".qt-task-due").textContent, /2020-01-01.*overdue/);
	assert.ok(container.querySelector(".is-urgent"));
	assert.equal(container.querySelector(".qt-task-notes").textContent, "<b>plain text</b> second line");
	assert.equal(container.querySelector("b"), null);
	assert.equal(task.title, "Details");
});

test("deadline separates full date/weekday, optional time, and relative label into unbroken units", () => {
	const { container, renderer } = createRenderer(createEmptyData());
	renderer.data.tasks = [{ id: "details", title: "Deadline", quadrant: "do", dueDate: "2026-09-22", dueTime: "18:30", tags: ["旅行", "Work"], notes: "", completedAt: null, order: 0 }];
	renderer.render();
	assert.equal(container.querySelector(".qt-due-date").textContent, "2026-09-22");
	assert.equal(container.querySelector(".qt-due-weekday").textContent, "Tue");
	assert.equal(container.querySelector(".qt-due-clock").textContent, "18:30");
	assert.ok(container.querySelector(".qt-due-relative"));
	assert.equal(container.querySelectorAll(".qt-tag").length, 2);
	renderer.data.tasks[0].dueTime = null; renderer.render();
	assert.equal(container.querySelector(".qt-due-clock"), null);
});

test("quick add persists time and all tags including pending input across failed saves", async () => {
	const { container, renderer } = createRenderer(createEmptyData());
	const form = container.querySelector(".qt-quick-add");
	const title = form.querySelector("textarea"); title.value = "Tagged"; title.dispatch("input");
	const date = form.querySelector(".qt-native-date"); date.value = "2026-09-22"; date.dispatch("change");
	const time = form.querySelector(".qt-due-time"); time.value = "00:00"; time.dispatch("change");
	const tags = form.querySelector(".qt-tag-input"); tags.value = "旅行,第二项"; tags.dispatch("input");
	renderer.mutate = async () => null;
	form.querySelector(".qt-add-button").dispatch("click");
	await new Promise(resolve => setImmediate(resolve));
	assert.equal(container.querySelector(".qt-due-time").value, "00:00");
	assert.equal(container.querySelectorAll(".qt-tag").length, 2);
	let result;
	renderer.mutate = async fn => { result = fn(renderer.data); return result; };
	container.querySelector(".qt-add-button").dispatch("click");
	await new Promise(resolve => setImmediate(resolve));
	assert.equal(result.dueTime, "00:00");
	assert.deepEqual(result.tags, ["旅行", "第二项"]);
	assert.equal(container.querySelector(".qt-due-time").value, "");
});

test("editing only time during a pending quick-add save preserves its date as a pair", async () => {
	const { container, renderer } = createRenderer(createEmptyData());
	const form = container.querySelector(".qt-quick-add");
	const title = form.querySelector("textarea"); title.value = "First"; title.dispatch("input");
	const date = form.querySelector(".qt-native-date"); date.value = "2026-09-22"; date.dispatch("change");
	const time = form.querySelector(".qt-due-time"); time.value = "10:00"; time.dispatch("change");
	let finish;
	renderer.mutate = async fn => { const task = fn(renderer.data); await new Promise(resolve => { finish = resolve; }); return task; };
	form.querySelector(".qt-add-button").dispatch("click");
	time.value = "18:30"; time.dispatch("change");
	finish(); await new Promise(resolve => setImmediate(resolve));
	assert.equal(container.querySelector(".qt-native-date").value, "2026-09-22");
	assert.equal(container.querySelector(".qt-due-time").value, "18:30");
});

test("quick add accepts title only and preserves all draft fields on save failure", async () => {
	const { container, renderer } = createRenderer(createEmptyData());
	const form = container.querySelector(".qt-quick-add");
	const title = form.querySelector("textarea");
	const notes = form.querySelector(".qt-quick-notes");
	assert.ok(form.querySelector(".qt-due-picker"));
	assert.ok(notes);
	title.value = "A new task";
	title.dispatch("input");
	notes.value = "Keep this draft";
	notes.dispatch("input");
	renderer.mutate = async () => null;
	form.querySelector(".qt-add-button").dispatch("click");
	await new Promise((resolve) => setImmediate(resolve));
	renderer.render();
	assert.equal(container.querySelector("textarea").value, "A new task");
	assert.equal(container.querySelector(".qt-quick-notes").value, "Keep this draft");
	let result;
	renderer.mutate = async (mutator) => { result = mutator(renderer.data); return result; };
	container.querySelector(".qt-quick-notes").value = "";
	container.querySelector(".qt-quick-notes").dispatch("input");
	container.querySelector(".qt-add-button").dispatch("click");
	await new Promise((resolve) => setImmediate(resolve));
	assert.equal(result.title, "A new task");
	assert.equal(result.dueDate, null);
	assert.equal(result.notes, "");
	assert.equal(container.querySelector("textarea").value, "");
});

test("completed task details remain editable without urgent styling", () => {
	const data = createEmptyData();
	const task = addTask(data, "Done", "do", { dueDate: "2020-01-01", notes: "Details" });
	completeTask(data, task.id);
	const { container, renderer } = createRenderer(data);
	assert.equal(container.querySelector(".is-urgent"), null);
	let opened = null;
	renderer.openEditor = (value) => { opened = value; };
	container.querySelector(".qt-completed-edit").dispatch("click");
	assert.equal(opened.id, task.id);
	assert.equal(opened.notes, "Details");
});

test("calendar rollover refreshes once and keeps quick-add drafts", () => {
	const { container, renderer } = createRenderer(createEmptyData());
	const title = container.querySelector("textarea");
	title.value = "Keep draft at midnight";
	title.dispatch("input");
	renderer.calendarDay = new Date(2020, 0, 1).toDateString();
	renderer.refreshCalendarDay(new Date(2020, 0, 2));
	const refreshed = container.querySelector("textarea");
	assert.notEqual(refreshed, title);
	assert.equal(refreshed.value, "Keep draft at midnight");
	renderer.refreshCalendarDay(new Date(2020, 0, 2));
	assert.equal(container.querySelector("textarea"), refreshed);
});

test("quick-add remains single-flight across a renderer refresh and preserves newer typing", async () => {
	const { container, renderer } = createRenderer(createEmptyData());
	let resolveSave;
	let count = 0;
	renderer.mutate = async (mutator) => {
		count += 1;
		const task = mutator(renderer.data);
		renderer.setBoardData(renderer.data);
		await new Promise((resolve) => { resolveSave = resolve; });
		return task;
	};
	let title = container.querySelector("textarea");
	title.value = "First";
	title.dispatch("input");
	title.dispatch("keydown", { key: "Enter" });
	title = container.querySelector("textarea");
	title.value = "Second draft";
	title.dispatch("input");
	title.dispatch("keydown", { key: "Enter" });
	assert.equal(count, 1);
	resolveSave();
	await new Promise((resolve) => setImmediate(resolve));
	assert.equal(container.querySelector("textarea").value, "Second draft");
});

test("quick-add ignores the IME keyCode fallback used by Safari", () => {
	const { container, renderer } = createRenderer(createEmptyData());
	let count = 0;
	renderer.mutate = async () => { count += 1; return null; };
	const title = container.querySelector("textarea");
	title.value = "中文候选词";
	title.dispatch("input");
	title.dispatch("keydown", { key: "Enter", isComposing: false, keyCode: 229 });
	assert.equal(count, 0);
});

test("empty quadrants keep a decorative boundary outside the task list", () => {
	const { container } = createRenderer(createEmptyData());
	const dividers = container.querySelectorAll(".qt-task-divider");
	assert.equal(dividers.length, 4);
	for (const divider of dividers) {
		const siblings = divider.parentElement.children;
		const index = siblings.indexOf(divider);
		assert.equal(siblings[index - 1].hasClass("qt-quick-add"), true);
		assert.equal(siblings[index + 1].hasClass("qt-task-list"), true);
		assert.equal(divider.getAttribute("aria-hidden"), "true");
	}
});

test("pointer drag clears its last target after leaving the matrix", () => {
	const data = createEmptyData();
	addTask(data, "Move me", "do", { idFactory: () => "active" });
	const { container, renderer } = createRenderer(data);
	const row = container.querySelector(".qt-task-row");
	row.addClass("qt-drop-after");
	container.ownerDocument = { elementFromPoint: () => null };
	const target = { quadrant: "do", taskId: "active", placement: "after", element: row };
	renderer.dragPoint = { x: -10, y: -10 };
	renderer.dragTarget = target;

	renderer.refreshDragTargetAtPoint();

	assert.equal(renderer.dragTarget, null);
	assert.equal(row.hasClass("qt-drop-after"), false);
});

test("dropping a task back on itself does not move it to the quadrant end", () => {
	const data = createEmptyData();
	addTask(data, "Move me", "do", { idFactory: () => "active" });
	const { container, renderer } = createRenderer(data);
	const row = container.querySelector(".qt-task-row");
	const previousTarget = { quadrant: "schedule", taskId: null, placement: "after", element: row };
	row.addClass("qt-drop-after");
	container.ownerDocument = { elementFromPoint: () => row };
	renderer.draggedTaskId = "active";
	renderer.dragPoint = { x: 10, y: 10 };
	renderer.dragTarget = previousTarget;

	renderer.refreshDragTargetAtPoint();

	assert.equal(renderer.dragTarget, null);
	assert.equal(row.hasClass("qt-drop-after"), false);
});

test("dragging into a card gap targets the next card, not the quadrant end", () => {
	const data = createEmptyData();
	for (const id of ["last", "middle", "first"]) addTask(data, id, "do", { idFactory: () => id });
	const { container, renderer } = createRenderer(data);
	const list = container.querySelector(".qt-task-list");
	const rows = list.querySelectorAll(".qt-task-row");
	rows.forEach((row, index) => { row.getBoundingClientRect = () => ({ left: 0, right: 200, top: index * 60, bottom: index * 60 + 50, height: 50 }); });
	container.ownerDocument = { elementFromPoint: () => list };
	renderer.draggedTaskId = "last";
	renderer.dragPoint = { x: 100, y: 55 };
	renderer.refreshDragTargetAtPoint();
	assert.equal(renderer.dragTarget.taskId, "middle");
	assert.equal(renderer.dragTarget.placement, "before");
	assert.equal(rows[1].hasClass("qt-drop-before"), true);
	// Dropping directly before the dragged card remains a no-op.
	renderer.draggedTaskId = "middle";
	renderer.refreshDragTargetAtPoint();
	assert.equal(renderer.dragTarget, null);
	// Blank space below the final card still means append.
	renderer.dragPoint = { x: 100, y: 190 };
	renderer.refreshDragTargetAtPoint();
	assert.equal(renderer.dragTarget.taskId, null);
});

test("touch drag suppresses its synthetic click while a normal handle tap opens actions", () => {
	const data = createEmptyData();
	addTask(data, "Move me", "do", { idFactory: () => "active" });
	const { container, renderer } = createRenderer(data);
	const dragHandle = container.querySelector(".qt-drag-handle");
	let menuOpenCount = 0;
	renderer.openTaskMenu = () => { menuOpenCount += 1; };

	dragHandle.dispatch("pointerdown", { pointerType: "touch", pointerId: 7, button: 0, clientX: 10, clientY: 10 });
	dragHandle.dispatch("pointermove", { pointerType: "touch", pointerId: 7, clientX: 10, clientY: 24 });
	dragHandle.dispatch("pointerup", { pointerType: "touch", pointerId: 7, clientX: 10, clientY: 24 });
	const syntheticClick = dragHandle.dispatch("click");
	assert.equal(menuOpenCount, 0, "finishing a drag must not also open the task menu");
	assert.equal(syntheticClick.defaultPrevented, true);

	dragHandle.dispatch("click");
	assert.equal(menuOpenCount, 1, "the suppression is one-shot so a regular tap remains useful");
});

test("a new handle tap resets drag-click suppression when no synthetic click was emitted", () => {
	const data = createEmptyData();
	addTask(data, "Move me", "do", { idFactory: () => "active" });
	const { container, renderer } = createRenderer(data);
	const dragHandle = container.querySelector(".qt-drag-handle");
	let menuOpenCount = 0;
	renderer.openTaskMenu = () => { menuOpenCount += 1; };

	dragHandle.dispatch("pointerdown", { pointerType: "touch", pointerId: 7, button: 0, clientX: 10, clientY: 10 });
	dragHandle.dispatch("pointermove", { pointerType: "touch", pointerId: 7, clientX: 10, clientY: 24 });
	dragHandle.dispatch("pointerup", { pointerType: "touch", pointerId: 7, clientX: 10, clientY: 24 });
	// This browser recognizes the drag gesture without emitting a click.
	dragHandle.dispatch("pointerdown", { pointerType: "touch", pointerId: 8, button: 0, clientX: 10, clientY: 10 });
	dragHandle.dispatch("pointerup", { pointerType: "touch", pointerId: 8, clientX: 10, clientY: 10 });
	dragHandle.dispatch("click");

	assert.equal(menuOpenCount, 1);
});

test("drag auto-scroll prefers the quadrant list and falls back to its containing note scroller", () => {
	const data = createEmptyData();
	addTask(data, "Move me", "do", { idFactory: () => "active" });
	const { container, renderer } = createRenderer(data);
	const list = container.querySelector(".qt-task-list");
	const noteScroller = new FakeElement();
	noteScroller.appendChild(container);
	list.scrollHeight = 300;
	list.clientHeight = 100;
	list.scrollTop = 0;
	list.getBoundingClientRect = () => ({ top: 0, bottom: 100, height: 100 });
	noteScroller.scrollHeight = 900;
	noteScroller.clientHeight = 400;
	noteScroller.scrollTop = 100;
	noteScroller.getBoundingClientRect = () => ({ top: 0, bottom: 400, height: 400 });
	const ownerDocument = {
		elementFromPoint: () => list,
		defaultView: {
			innerHeight: 400,
			getComputedStyle: (element) => ({ overflowY: element === noteScroller ? "auto" : "visible" }),
		},
		scrollingElement: null,
	};
	container.ownerDocument = ownerDocument;
	noteScroller.ownerDocument = ownerDocument;
	renderer.dragInputType = "pointer";
	renderer.dragPoint = { x: 10, y: 96 };

	assert.equal(renderer.resolveAutoScroll()?.element, list, "the inner list scrolls before the note");

	list.scrollTop = 200;
	ownerDocument.elementFromPoint = () => noteScroller;
	renderer.dragPoint = { x: 10, y: 395 };
	assert.equal(renderer.resolveAutoScroll()?.element, noteScroller, "a direct hit on the note scroller must still scroll it");
});

test("ending a drag cancels its scheduled animation frame and clears visual state", () => {
	const data = createEmptyData();
	addTask(data, "Move me", "do", { idFactory: () => "active" });
	const { container, renderer } = createRenderer(data);
	const row = container.querySelector(".qt-task-row");
	let cancelledFrame = null;
	container.ownerDocument = {
		defaultView: { cancelAnimationFrame: (frame) => { cancelledFrame = frame; } },
	};
	row.addClass("qt-dragging");
	renderer.draggedTaskId = "active";
	renderer.dragSourceRow = row;
	renderer.dragFrame = 42;
	renderer.dragPoint = { x: 10, y: 10 };

	renderer.finishDrag(false);

	assert.equal(cancelledFrame, 42);
	assert.equal(renderer.draggedTaskId, null);
	assert.equal(renderer.dragFrame, null);
	assert.equal(row.hasClass("qt-dragging"), false);
});
