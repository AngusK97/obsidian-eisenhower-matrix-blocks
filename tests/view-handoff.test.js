"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createViewHandoff } = require("../src/view-handoff");

class Element {
	constructor(document, parent = null) {
		this.ownerDocument = document; this.parentElement = parent;
		this.isConnected = true; this.listeners = new Map();
		this.scrollTop = 0; this.scrollLeft = 0; this.scrollHeight = 800; this.clientHeight = 200;
		this.viewport = { scrollLeft: 0 };
	}
	contains(node) { for (; node; node = node.parentElement) if (node === this) return true; return false; }
	querySelectorAll() { return []; }
	querySelector(selector) { return selector === ".qt-matrix-viewport" ? this.viewport : null; }
	getBoundingClientRect() { return { top: 40, bottom: 240 }; }
	addEventListener(type, callback) {
		if (!this.listeners.has(type)) this.listeners.set(type, new Set());
		this.listeners.get(type).add(callback);
	}
	removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
	emit(type, target = this, details = {}) { for (const callback of [...(this.listeners.get(type) || [])]) callback({ type, target, ...details }); }
}

function fixture() {
	const document = { defaultView: { getComputedStyle: () => ({ overflowY: "auto" }) }, activeElement: null };
	const pane = new Element(document);
	const view = { containerEl: pane, file: { path: "Note.md" } };
	const leaves = [{ view }];
	const events = new Map();
	const plugin = {
		boardRenderers: new Set(),
		app: { workspace: {
			iterateAllLeaves: callback => leaves.forEach(callback),
			on(name, callback) { events.set(name, callback); return { name, callback }; },
			offref(ref) { events.delete(ref.name); },
		} },
	};
	const renderer = (parent = pane, path = "Note.md", boardId = "alpha") => {
		const next = {
			containerEl: new Element(parent.ownerDocument, parent), sourcePath: path, boardId,
			quickAddDrafts: new Map([["do", { title: "Live draft", submitting: true }]]),
			filters: { period: "all", quadrant: "do" }, isCollapsed: true, isCompletedScrollable: false,
		};
		plugin.boardRenderers.add(next); return next;
	};
	const handoff = createViewHandoff(plugin);
	return { document, pane, view, leaves, events, plugin, renderer, handoff };
}

test("handoff restores only a replacement in the same pane and shares in-flight drafts", t => {
	const f = fixture(); t.after(() => f.handoff.dispose());
	const old = f.renderer(); old.containerEl.viewport.scrollLeft = 130;
	const finish = f.handoff.armForFile("Note.md");
	old.containerEl.isConnected = false;
	const next = f.renderer(); next.filters = {};
	const state = f.handoff.adopt(next);
	assert.equal(state.x, 130);
	assert.equal(next.quickAddDrafts, old.quickAddDrafts);
	assert.deepEqual(next.filters, { period: "all", quadrant: "do" });
	assert.notEqual(next.filters, old.filters);
	assert.equal(next.isCollapsed, true); assert.equal(next.isCompletedScrollable, false);
	old.quickAddDrafts.get("do").submitting = false;
	assert.equal(next.quickAddDrafts.get("do").submitting, false);
	assert.equal(f.handoff.adopt(next), null, "consume only once");
	finish();
});

test("handoff does not cross panes or transfer from a live root", t => {
	const f = fixture(); t.after(() => f.handoff.dispose());
	const old = f.renderer(); f.handoff.armForFile("Note.md");
	const replacement = f.renderer();
	assert.equal(f.handoff.adopt(replacement), null);
	replacement.containerEl.isConnected = false;
	old.containerEl.isConnected = false;
	const otherPane = new Element(f.document); f.leaves.push({ view: { containerEl: otherPane, file: { path: "Note.md" } } });
	assert.equal(f.handoff.adopt(f.renderer(otherPane)), null);
	assert.ok(f.handoff.adopt(f.renderer()), "the correct pane still owns the snapshot");
});

test("ambiguous duplicate embeds never arm a shared snapshot", t => {
	const f = fixture(); t.after(() => f.handoff.dispose());
	const a = f.renderer(); const b = f.renderer();
	f.handoff.armForFile("Note.md");
	a.containerEl.isConnected = false; b.containerEl.isConnected = false;
	assert.equal(f.handoff.adopt(f.renderer()), null);
});

test("live scroll updates the snapshot and user intent after detach cancels restoration", t => {
	for (const intent of ["wheel", "pointerdown", "keydown"]) {
		const f = fixture(); t.after(() => f.handoff.dispose());
		const old = f.renderer(); f.handoff.armForFile("Note.md");
		old.containerEl.viewport.scrollLeft = 220;
		f.pane.emit("scroll", old.containerEl);
		old.containerEl.isConnected = false;
		if (intent === "wheel") {
			const next = f.renderer(); assert.equal(f.handoff.adopt(next).x, 220);
			f.handoff.armForFile("Note.md"); next.containerEl.isConnected = false;
		}
		f.pane.emit(intent);
		assert.equal(f.handoff.adopt(f.renderer()), null, intent);
	}
});

test("file navigation invalidates an old pane snapshot even when returning quickly", t => {
	const f = fixture(); t.after(() => f.handoff.dispose());
	const old = f.renderer(); f.handoff.armForFile("Note.md"); old.containerEl.isConnected = false;
	f.view.file = { path: "Other.md" }; f.events.get("file-open")?.();
	f.view.file = { path: "Note.md" };
	assert.equal(f.handoff.adopt(f.renderer()), null);
});

test("moving focus away before replacement does not revive the earlier input focus", async t => {
	const f = fixture(); t.after(() => f.handoff.dispose());
	const old = f.renderer();
	f.document.activeElement = { parentElement: old.containerEl, closest: () => null, getAttribute: () => null, className: "draft" };
	f.handoff.armForFile("Note.md");
	f.document.activeElement = null; f.pane.emit("focusout", old.containerEl);
	await Promise.resolve();
	old.containerEl.isConnected = false;
	assert.equal(f.handoff.adopt(f.renderer()).focus, null);
});

test("host removal focusout preserves the old focus until the replacement consumes it", async t => {
	const f = fixture(); t.after(() => f.handoff.dispose());
	const old = f.renderer();
	const input = { parentElement: old.containerEl, closest: () => null, getAttribute: () => null, className: "draft" };
	f.document.activeElement = input; f.handoff.armForFile("Note.md");
	f.document.activeElement = null; f.pane.emit("focusout", old.containerEl, { relatedTarget: null });
	old.containerEl.isConnected = false;
	await Promise.resolve();
	assert.equal(f.handoff.adopt(f.renderer()).focus.node, input);
});

test("an explicit focus destination updates immediately rather than reviving the old focus", t => {
	const f = fixture(); t.after(() => f.handoff.dispose());
	const old = f.renderer();
	f.document.activeElement = { parentElement: old.containerEl, closest: () => null, getAttribute: () => null, className: "draft" };
	f.handoff.armForFile("Note.md");
	f.document.activeElement = f.pane;
	f.pane.emit("focusout", old.containerEl, { relatedTarget: f.pane });
	old.containerEl.isConnected = false;
	assert.equal(f.handoff.adopt(f.renderer()).focus, null);
});

test("one visible board owns outer restoration even when boards are adopted in reverse order", t => {
	const f = fixture(); t.after(() => f.handoff.dispose());
	const first = f.renderer(f.pane, "Note.md", "first");
	const second = f.renderer(f.pane, "Note.md", "second");
	first.containerEl.getBoundingClientRect = () => ({ top: -100, bottom: 120 });
	second.containerEl.getBoundingClientRect = () => ({ top: 130, bottom: 800 });
	first.containerEl.viewport.scrollLeft = 70; second.containerEl.viewport.scrollLeft = 140;
	f.handoff.armForFile("Note.md");
	// Refreshing while alive must not reintroduce a second pane restoration.
	f.pane.scrollTop = 60; f.pane.emit("scroll");
	first.containerEl.isConnected = false; second.containerEl.isConnected = false;
	const secondState = f.handoff.adopt(f.renderer(f.pane, "Note.md", "second"));
	const firstState = f.handoff.adopt(f.renderer(f.pane, "Note.md", "first"));
	assert.equal(secondState.x, 140); assert.equal(firstState.x, 70);
	assert.deepEqual(secondState.outer, []);
	assert.equal(firstState.outer.length, 1); assert.equal(firstState.outer[0].top, 60);
});

test("offscreen boards preserve inner state without owning the pane scroll", t => {
	const f = fixture(); t.after(() => f.handoff.dispose());
	const old = f.renderer(); old.containerEl.viewport.scrollLeft = 90;
	old.containerEl.getBoundingClientRect = () => ({ top: 300, bottom: 600 });
	f.handoff.armForFile("Note.md"); f.pane.emit("scroll"); old.containerEl.isConnected = false;
	const snapshot = f.handoff.adopt(f.renderer());
	assert.equal(snapshot.x, 90); assert.deepEqual(snapshot.outer, []);
});

test("scroll and input bursts capture once per frame and disposal cancels pending work", t => {
	const f = fixture(); t.after(() => f.handoff.dispose());
	const callbacks = new Map(); let frameId = 0;
	f.document.defaultView.requestAnimationFrame = callback => { callbacks.set(++frameId, callback); return frameId; };
	f.document.defaultView.cancelAnimationFrame = id => callbacks.delete(id);
	const old = f.renderer(); let geometryReads = 0;
	old.containerEl.getBoundingClientRect = () => { geometryReads++; return { top: 40, bottom: 240 }; };
	f.handoff.armForFile("Note.md"); const baseline = geometryReads;
	old.containerEl.viewport.scrollLeft = 190;
	for (let index = 0; index < 20; index++) { f.pane.emit("scroll"); f.pane.emit("input"); }
	assert.equal(geometryReads, baseline, "no synchronous geometry work on event bursts");
	assert.equal(callbacks.size, 1);
	const [[id, callback]] = callbacks; callbacks.delete(id); callback();
	assert.ok(geometryReads > baseline);
	f.pane.emit("scroll"); assert.equal(callbacks.size, 1);
	old.containerEl.isConnected = false;
	assert.equal(f.handoff.adopt(f.renderer()).x, 190);
	assert.equal(callbacks.size, 0, "consuming cancels stale scheduled capture");
	f.handoff.armForFile("Note.md"); f.pane.emit("scroll");
	assert.equal(callbacks.size, 1); f.handoff.dispose(); assert.equal(callbacks.size, 0);
});

test("settled and abandoned snapshots expire and disposal removes listeners", t => {
	t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
	const f = fixture(); t.after(() => f.handoff.dispose());
	let old = f.renderer();
	let finish = f.handoff.armForFile("Note.md");
	finish(); old.containerEl.isConnected = false;
	t.mock.timers.tick(2000);
	assert.equal(f.handoff.adopt(f.renderer()), null);
	for (const renderer of f.plugin.boardRenderers) renderer.containerEl.isConnected = false;
	old = f.renderer(); f.handoff.armForFile("Note.md"); old.containerEl.isConnected = false;
	t.mock.timers.tick(11000);
	assert.equal(f.handoff.adopt(f.renderer()), null);
	f.handoff.dispose();
	assert.ok([...f.pane.listeners.values()].every(callbacks => callbacks.size === 0));
	assert.equal(f.events.size, 0);
});

test("a newer write replaces older snapshots and an older finish cannot expire it", t => {
	t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
	const f = fixture(); t.after(() => f.handoff.dispose());
	const old = f.renderer();
	const oldFinish = f.handoff.armForFile("Note.md");
	old.containerEl.viewport.scrollLeft = 90;
	f.handoff.armForFile("Note.md"); oldFinish();
	t.mock.timers.tick(2000); old.containerEl.isConnected = false;
	assert.equal(f.handoff.adopt(f.renderer()).x, 90);
});

test("elapsed TTL is enforced even if a background window delays its timeout callback", t => {
	t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
	const f = fixture(); t.after(() => f.handoff.dispose());
	const old = f.renderer(); const finish = f.handoff.armForFile("Note.md");
	finish(); old.containerEl.isConnected = false;
	t.mock.timers.setTime(Date.now() + 2000);
	assert.equal(f.handoff.adopt(f.renderer()), null);
});
