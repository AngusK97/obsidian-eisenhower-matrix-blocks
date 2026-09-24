"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

class Element {
	constructor(tag, doc) {
		this.tagName = tag; this.ownerDocument = doc; this.children = []; this.listeners = new Map();
		this.attributes = {}; this.style = {}; this.value = ""; this.textContent = ""; this.scrollHeight = 80;
	}
	createEl(tag, options = {}) {
		const child = new Element(tag, this.ownerDocument);
		child.className = options.cls || ""; child.textContent = options.text || "";
		for (const [key, value] of Object.entries(options.attr || {})) child.setAttribute(key, value);
		this.appendChild(child); return child;
	}
	createDiv(options) { return this.createEl("div", options); }
	createSpan(options) { return this.createEl("span", options); }
	appendChild(child) { this.children.push(child); child.parentElement = this; }
	setAttribute(key, value) { this.attributes[key] = value; if (key === "value") this.value = value; }
	getAttribute(key) { return this.attributes[key]; }
	addClass(name) { this.className += ` ${name}`; }
	removeClass(name) { this.className = this.className.replace(name, ""); }
	addEventListener(type, listener) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(listener); }
	removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
	dispatch(type, values = {}) {
		const event = { target: this, key: "", preventDefault() { this.prevented = true; }, stopPropagation() {}, ...values };
		for (const listener of this.listeners.get(type) || []) listener(event);
		return event;
	}
	contains(node) { return node === this || this.children.some(child => child.contains(node)); }
	closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
	matches(selector) { return selector.startsWith(".") ? this.className?.split(" ").includes(selector.slice(1)) : this.tagName === selector; }
	querySelector(selector) { return this.children.find(child => child.matches(selector)) || this.children.map(child => child.querySelector(selector)).find(Boolean) || null; }
	querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
	remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this); }
	empty() { this.children = []; }
	focus() { if (this.ownerDocument) this.ownerDocument.activeElement = this; }
	select() {}
	getBoundingClientRect() { return { left: 250, top: 150, bottom: 190, width: 280, height: 180 }; }
}

function createDocument() {
	const doc = new Element("document", null);
	doc.ownerDocument = doc;
	doc.body = new Element("body", doc);
	doc.defaultView = new Element("window", doc);
	doc.defaultView.innerWidth = 320; doc.defaultView.innerHeight = 600;
	doc.defaultView.requestAnimationFrame = callback => callback();
	return doc;
}

const doc = createDocument();
class Modal {
	constructor() { this.contentEl = new Element("div", doc); this.contentEl.className = "modal"; this.closed = false; }
	setTitle(value) { this.title = value; }
	close() { this.closed = true; this.onClose(); }
}
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
	if (request === "obsidian") return { Modal, setIcon: (el, name) => { el.icon = name; } };
	if (request === "./tag-input") return { createTagInput(parent, plugin, initialTags) {
		const input = parent.createEl("input", { cls: "qt-tags-test-input" });
		input.value = (initialTags || []).join(",");
		return { getValue: () => input.value.split(",").map(value => value.trim()).filter(Boolean),
			setDisabled: disabled => { input.disabled = disabled; }, destroy() {} };
	} };
	return originalLoad.call(this, request, parent, isMain);
};
let TaskEditorModal, createDueDateControl, createDeadlineFields;
try { ({ TaskEditorModal, createDueDateControl, createDeadlineFields } = require("../src/task-fields")); }
finally { Module._load = originalLoad; }
const plugin = { app: {}, t: key => key };
const flush = () => new Promise(resolve => setImmediate(resolve));

test("task editor initializes title separately from the modal heading and preserves all fields", async () => {
	let saved;
	const modal = new TaskEditorModal(plugin, { title: "Original", dueDate: "2026-09-20", dueTime: "00:00", notes: "Line one\nLine two", tags: ["Work"] }, async (...args) => { saved = args; });
	modal.onOpen();
	assert.equal(modal.contentEl.querySelector(".qt-task-name-input").value, "Original");
	assert.equal(modal.contentEl.querySelector(".qt-task-notes-input").value, "Line one\nLine two");
	modal.contentEl.querySelector(".mod-cta").dispatch("click"); await flush();
	assert.deepEqual(saved, ["Original", { dueDate: "2026-09-20", dueTime: "00:00", notes: "Line one\nLine two", tags: ["Work"] }]);
	assert.equal(modal.closed, true);
});

test("title Enter waits for single-flight save, ignores IME, and closes only on success", async () => {
	let finish, calls = 0;
	const modal = new TaskEditorModal(plugin, { title: "Original" }, () => { calls++; return new Promise(resolve => { finish = resolve; }); });
	modal.onOpen();
	const title = modal.contentEl.querySelector(".qt-task-name-input");
	title.value = "New\n title";
	title.dispatch("keydown", { key: "Enter", isComposing: true }); assert.equal(calls, 0);
	title.dispatch("keydown", { key: "Enter" }); title.dispatch("keydown", { key: "Enter" });
	assert.equal(calls, 1); assert.equal(modal.closed, false);
	finish(); await flush(); assert.equal(modal.closed, true);
});

test("notes Enter inserts newlines while Ctrl/Cmd Enter saves", async () => {
	let calls = 0;
	const modal = new TaskEditorModal(plugin, { title: "Original" }, async () => { calls++; });
	modal.onOpen();
	const notes = modal.contentEl.querySelector(".qt-task-notes-input");
	assert.equal(notes.dispatch("keydown", { key: "Enter" }).prevented, undefined);
	assert.equal(calls, 0);
	notes.dispatch("keydown", { key: "Enter", ctrlKey: true }); await flush();
	assert.equal(calls, 1);
});

test("save failure retains draft, exposes retryable error, and empty titles do not save", async () => {
	let calls = 0;
	const modal = new TaskEditorModal(plugin, { title: "Draft", notes: "Keep this" }, async () => { calls++; throw new Error("disk full"); });
	modal.onOpen();
	const title = modal.contentEl.querySelector(".qt-task-name-input");
	title.value = " "; title.dispatch("keydown", { key: "Enter" }); assert.equal(calls, 0);
	title.value = "Retry draft"; title.dispatch("keydown", { key: "Enter" }); await flush();
	assert.equal(modal.closed, false); assert.equal(title.value, "Retry draft");
	assert.equal(modal.contentEl.querySelector(".qt-task-notes-input").value, "Keep this");
	assert.equal(modal.contentEl.querySelector(".qt-task-save-error").textContent, "task.saveFailed");
	assert.equal(modal.contentEl.querySelector(".mod-cta").disabled, false);
	modal.close();
});

test("one labeled native date field replaces the duplicate calendar button and preserves edits", () => {
	const localDoc = createDocument(); const parent = localDoc.body.createDiv(); const changes = [];
	const picker = createDueDateControl(parent, plugin, "2026-09-20", value => changes.push(value));
	const input = parent.querySelector(".qt-native-date");
	assert.equal(input.getAttribute("type"), "date"); assert.equal(input.value, "2026-09-20");
	assert.equal(parent.querySelectorAll("button").length, 0);
	assert.equal(input.getAttribute("aria-label"), "task.dueDate");
	assert.equal(input.getAttribute("title"), "task.dueDate");
	assert.equal(localDoc.body.querySelector(".qt-date-popover"), null);
	input.value = "2026-10-01"; input.dispatch("change");
	assert.equal(picker.getValue(), "2026-10-01"); assert.deepEqual(changes, ["2026-10-01"]);
	input.value = ""; input.dispatch("change"); assert.equal(picker.getValue(), null);
	picker.destroy(); assert.equal(input.listeners.get("change").size, 0);
});

test("native date field stays keyboard accessible without a showPicker API", () => {
	const localDoc = createDocument(); const parent = localDoc.body.createDiv();
	const picker = createDueDateControl(parent, plugin, null, () => {});
	const input = parent.querySelector(".qt-native-date");
	input.focus(); assert.equal(localDoc.activeElement, input);
	assert.equal(input.showPicker, undefined);
	picker.setDisabled(true); assert.equal(input.disabled, true);
	picker.setDisabled(false); assert.equal(input.disabled, false);
	assert.notEqual(input.getAttribute("tabindex"), "-1"); assert.equal(input.getAttribute("aria-label"), "task.dueDate");
	picker.destroy();
});

test("deadline time is optional, accepts midnight and end-of-day, and clears with date", () => {
	const parent = createDocument().body.createDiv(); const changes = [];
	const fields = createDeadlineFields(parent, plugin, {}, value => changes.push(value));
	const date = parent.querySelector(".qt-native-date"); const time = parent.querySelector(".qt-due-time");
	assert.deepEqual(fields.getValue(), { dueDate: null, dueTime: null }); assert.equal(time.disabled, true);
	date.value = "2026-09-20"; date.dispatch("change"); assert.equal(time.disabled, false);
	time.value = "00:00"; time.dispatch("change"); assert.equal(fields.getValue().dueTime, "00:00");
	time.value = "23:59"; time.dispatch("change"); assert.equal(fields.getValue().dueTime, "23:59");
	parent.querySelector(".qt-clear-time").dispatch("click"); assert.equal(fields.getValue().dueTime, null);
	fields.setValue({ dueDate: "2026-09-21", dueTime: "12:34" }); assert.equal(time.value, "12:34");
	date.value = ""; date.dispatch("change"); assert.equal(time.value, ""); assert.equal(time.disabled, true);
	assert.deepEqual(changes.at(-1), { dueDate: null, dueTime: null }); fields.destroy();
});

test("deadline fields disable every control and retain optional-time disabled state on unlock", () => {
	const parent = createDocument().body.createDiv(); const fields = createDeadlineFields(parent, plugin, {}, () => {});
	fields.setDisabled(true);
	for (const control of [...parent.querySelectorAll("input"), ...parent.querySelectorAll("button")]) assert.equal(control.disabled, true);
	fields.setDisabled(false); assert.equal(parent.querySelector(".qt-native-date").disabled, false);
	assert.equal(parent.querySelector(".qt-due-time").disabled, true); fields.destroy();
});

test("time clear hides when empty, follows live input, preserves date and returns focus", () => {
	const localDoc = createDocument(); const parent = localDoc.body.createDiv(); const changes = [];
	const fields = createDeadlineFields(parent, plugin, {}, value => changes.push(value));
	const time = parent.querySelector(".qt-due-time"), clear = parent.querySelector(".qt-clear-time");
	assert.equal(clear.hidden, true, "an unset time must not reserve a clear-button slot");
	fields.setValue({ dueDate: "2026-09-24" });
	assert.equal(clear.hidden, true);
	for (const value of ["00:00", "23:59"]) {
		time.value = value; time.dispatch("input");
		assert.equal(clear.hidden, false); assert.equal(clear.disabled, false);
		clear.dispatch("click");
		assert.equal(clear.hidden, true);
		assert.deepEqual(fields.getValue(), { dueDate: "2026-09-24", dueTime: null });
		assert.equal(localDoc.activeElement, time);
	}
	fields.setValue({ dueDate: "2026-09-24", dueTime: "12:34" });
	assert.equal(clear.hidden, false);
	fields.setDisabled(true); assert.equal(clear.disabled, true);
	fields.setDisabled(false); assert.equal(clear.disabled, false);
	time.value = ""; time.dispatch("input"); assert.equal(clear.hidden, true);
	fields.setValue({ dueDate: "2026-09-24", dueTime: "12:34" });
	const date = parent.querySelector(".qt-native-date"); date.value = ""; date.dispatch("change");
	assert.equal(clear.hidden, true); assert.equal(time.disabled, true);
	fields.destroy();
	for (const event of ["input", "keyup", "pointerup", "blur"]) assert.equal(time.listeners.get(event).size, 0);
});

test("an incomplete native time keeps an enabled clear action", () => {
	const parent = createDocument().body.createDiv();
	const fields = createDeadlineFields(parent, plugin, { dueDate: "2026-09-24" });
	const time = parent.querySelector(".qt-due-time"), clear = parent.querySelector(".qt-clear-time");
	// Native segmented editors may change badInput without an input/change event.
	time.value = ""; time.validity = { badInput: true, valid: false }; time.dispatch("keyup");
	assert.equal(clear.hidden, false); assert.equal(clear.disabled, false);
	assert.equal(fields.validate(), false, "a partial time must not be silently saved as empty");
	fields.destroy();
});

test("editor saves pending tags and disables date time and tags during submission", async () => {
	let saved, finish;
	const modal = new TaskEditorModal(plugin, { title: "Task", dueDate: "2026-09-20", dueTime: "23:59" }, (...args) => {
		saved = args; return new Promise(resolve => { finish = resolve; });
	});
	modal.onOpen(); modal.contentEl.querySelector(".qt-tags-test-input").value = "Work, Pending";
	modal.contentEl.querySelector(".mod-cta").dispatch("click");
	assert.deepEqual(saved[1].tags, ["Work", "Pending"]); assert.equal(saved[1].dueTime, "23:59");
	for (const selector of [".qt-native-date", ".qt-due-time", ".qt-tags-test-input"]) assert.equal(modal.contentEl.querySelector(selector).disabled, true);
	finish(); await flush(); assert.equal(modal.closed, true);
});

test("incomplete native date or time fields block save instead of silently discarding the deadline", () => {
	let calls = 0;
	const modal = new TaskEditorModal(plugin, { title: "Task", dueDate: "2026-09-20" }, () => { calls++; });
	modal.onOpen();
	const date = modal.contentEl.querySelector(".qt-native-date");
	const time = modal.contentEl.querySelector(".qt-due-time");
	date.validity = { badInput: true, valid: false };
	modal.contentEl.querySelector(".mod-cta").dispatch("click"); assert.equal(calls, 0);
	date.validity = { valid: true }; time.validity = { badInput: true, valid: false };
	modal.contentEl.querySelector(".mod-cta").dispatch("click"); assert.equal(calls, 0);
	assert.equal(doc.activeElement, time); modal.close();
});
