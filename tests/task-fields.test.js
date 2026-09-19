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
	return originalLoad.call(this, request, parent, isMain);
};
let TaskEditorModal, createDueDateControl;
try { ({ TaskEditorModal, createDueDateControl } = require("../src/task-fields")); }
finally { Module._load = originalLoad; }
const plugin = { app: {}, t: key => key };
const flush = () => new Promise(resolve => setImmediate(resolve));

test("task editor initializes title separately from the modal heading and preserves all fields", async () => {
	let saved;
	const modal = new TaskEditorModal(plugin, { title: "Original", dueDate: "2026-09-20", notes: "Line one\nLine two" }, async (...args) => { saved = args; });
	modal.onOpen();
	assert.equal(modal.contentEl.querySelector(".qt-task-name-input").value, "Original");
	assert.equal(modal.contentEl.querySelector(".qt-task-notes-input").value, "Line one\nLine two");
	modal.contentEl.querySelector(".mod-cta").dispatch("click"); await flush();
	assert.deepEqual(saved, ["Original", { dueDate: "2026-09-20", notes: "Line one\nLine two" }]);
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

test("date picker changes and clears optional dates, closes and restores trigger focus", () => {
	const localDoc = createDocument(); const parent = localDoc.body.createDiv(); const changes = [];
	const picker = createDueDateControl(parent, plugin, "2026-09-20", value => changes.push(value));
	const trigger = parent.querySelector(".qt-due-picker"); trigger.dispatch("click");
	const input = localDoc.body.querySelector(".qt-date-input"); assert.equal(input.value, "2026-09-20");
	input.value = "2026-10-01"; input.dispatch("change");
	localDoc.body.querySelector(".qt-date-apply").dispatch("click");
	assert.equal(picker.getValue(), "2026-10-01"); assert.deepEqual(changes, ["2026-10-01"]);
	assert.equal(localDoc.body.querySelector(".qt-date-popover"), null); assert.equal(localDoc.activeElement, trigger);
	trigger.dispatch("click"); localDoc.body.querySelector(".qt-date-clear").dispatch("click");
	assert.equal(picker.getValue(), null); assert.deepEqual(changes, ["2026-10-01", null]);
	picker.destroy();
});

test("segmented date edits stay pending until explicit confirmation and Escape discards them", () => {
	const localDoc = createDocument(); const parent = localDoc.body.createDiv(); const changes = [];
	const picker = createDueDateControl(parent, plugin, "2026-09-20", value => changes.push(value));
	const trigger = parent.querySelector(".qt-due-picker"); trigger.dispatch("click");
	const input = localDoc.body.querySelector(".qt-date-input");
	input.value = "0002-09-20"; input.dispatch("change");
	assert.equal(picker.getValue(), "2026-09-20"); assert.deepEqual(changes, []);
	assert.ok(localDoc.body.querySelector(".qt-date-popover"));
	localDoc.dispatch("keydown", { key: "Escape" });
	trigger.dispatch("click");
	const reopened = localDoc.body.querySelector(".qt-date-input"); assert.equal(reopened.value, "2026-09-20");
	reopened.value = "2027-09-20";
	reopened.dispatch("keydown", { key: "Enter", isComposing: true }); assert.deepEqual(changes, []);
	reopened.dispatch("keydown", { key: "Enter" });
	assert.equal(picker.getValue(), "2027-09-20"); assert.deepEqual(changes, ["2027-09-20"]);
	assert.equal(localDoc.body.querySelector(".qt-date-popover"), null);
	picker.destroy();
});

test("Escape and outside pointer close popup, destroy cleans document listeners", () => {
	const localDoc = createDocument(); const parent = localDoc.body.createDiv();
	const picker = createDueDateControl(parent, plugin, null, () => {}); const trigger = parent.querySelector(".qt-due-picker");
	trigger.dispatch("click"); localDoc.dispatch("keydown", { key: "Escape" });
	assert.equal(localDoc.body.querySelector(".qt-date-popover"), null);
	trigger.dispatch("click"); localDoc.dispatch("pointerdown", { target: localDoc.body });
	assert.equal(localDoc.body.querySelector(".qt-date-popover"), null);
	trigger.dispatch("click"); picker.destroy();
	assert.equal(localDoc.body.querySelector(".qt-date-popover"), null);
	assert.equal(localDoc.listeners.get("keydown").size, 0);
	assert.equal(localDoc.listeners.get("pointerdown").size, 0);
});

test("relative shortcuts use local calendar dates and popup fits a narrow viewport", () => {
	const localDoc = createDocument(); const parent = localDoc.body.createDiv();
	const picker = createDueDateControl(parent, plugin, null, () => {});
	const trigger = parent.querySelector(".qt-due-picker");
	const format = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
	const today = new Date(); const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
	trigger.dispatch("click");
	const popup = localDoc.body.querySelector(".qt-date-popover");
	assert.equal(popup.style.left, "32px");
	localDoc.body.querySelector(".qt-date-today").dispatch("click"); assert.equal(picker.getValue(), format(today));
	trigger.dispatch("click"); localDoc.body.querySelector(".qt-date-tomorrow").dispatch("click");
	assert.equal(picker.getValue(), format(tomorrow));
	picker.destroy();
});

test("popup stays inside modal focus scope and adapts to keyboard viewport resizing", () => {
	const localDoc = createDocument(); const modal = localDoc.body.createDiv({ cls: "modal" }); const parent = modal.createDiv();
	localDoc.defaultView.visualViewport = new Element("viewport", localDoc);
	Object.assign(localDoc.defaultView.visualViewport, { width: 320, height: 600, offsetLeft: 0, offsetTop: 0 });
	const picker = createDueDateControl(parent, plugin, null, () => {});
	parent.querySelector(".qt-due-picker").dispatch("click");
	assert.equal(modal.querySelector(".qt-date-popover").parentElement, modal);
	localDoc.defaultView.visualViewport.height = 140;
	localDoc.defaultView.visualViewport.dispatch("resize");
	const popup = modal.querySelector(".qt-date-popover");
	assert.ok(popup, "opening the keyboard must not dismiss the date picker");
	assert.equal(popup.style.maxHeight, "124px");
	assert.equal(popup.style.top, "8px");
	picker.destroy();
});
