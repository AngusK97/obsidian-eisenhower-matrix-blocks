"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createEditorScrollGuards } = require("../src/editor-scroll-guard");

class Events {
	constructor() { this.listeners = new Map(); }
	addEventListener(type, listener) {
		if (!this.listeners.has(type)) this.listeners.set(type, new Set());
		this.listeners.get(type).add(listener);
	}
	removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
	emit(type, target = this) { for (const listener of [...(this.listeners.get(type) || [])]) listener({ type, target }); }
	count() { return [...this.listeners.values()].reduce((total, listeners) => total + listeners.size, 0); }
}

function fixture(t) {
	t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
	const document = new Events(); document.hidden = false;
	const window = new Events(); window.visualViewport = new Events(); document.defaultView = window;
	const root = new Events(); root.ownerDocument = document; root.isConnected = true;
	root.getBoundingClientRect = () => ({ width: 640, height: 800, top: 0, bottom: 800 });
	const frames = new Map(); let frameId = 0;
	window.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId; };
	window.cancelAnimationFrame = id => frames.delete(id);
	const state = { text: "before", top: 600, left: 20, mode: "source", writes: [], clamp: null };
	const editor = {
		getValue: () => state.text,
		getScrollInfo: () => ({ top: state.top, left: state.left }),
		scrollTo(left, top) {
			state.writes.push({ left, top });
			state.left = left; state.top = state.clamp === null ? top : Math.min(top, state.clamp);
			root.emit("scroll");
		},
	};
	const view = { containerEl: root, editor, file: { path: "Note.md" }, getMode: () => state.mode };
	const guards = createEditorScrollGuards(); t.after(() => guards.dispose());
	const frame = () => {
		const scheduled = [...frames]; frames.clear();
		for (const [, callback] of scheduled) callback();
	};
	const listenerCount = () => [root, document, window, window.visualViewport].reduce((total, target) => total + target.count(), 0);
	return { document, window, root, frames, state, editor, view, guards, frame, listenerCount };
}

test("first frame repairs a synchronous jump and scroll events repair later jumps without polling", t => {
	const f = fixture(t);
	f.guards.arm(f.view, "after"); f.state.text = "after"; f.state.top = 0;
	f.frame(); assert.deepEqual(f.state.writes, [{ left: 20, top: 600 }]);
	assert.equal(f.frames.size, 0, "no permanent RAF loop");
	t.mock.timers.tick(200); f.state.top = 30; f.root.emit("scroll");
	assert.equal(f.frames.size, 1); f.frame(); assert.equal(f.state.top, 600);
	assert.equal(f.state.writes.length, 2);
});

test("internal scrolling and subpixel drift do not request corrections", t => {
	const f = fixture(t); f.guards.arm(f.view, "after"); f.state.text = "after"; f.frame();
	let measurements = 0;
	f.root.getBoundingClientRect = () => { measurements++; return { width: 640, height: 800, top: 0, bottom: 800 }; };
	f.root.emit("scroll"); assert.equal(f.frames.size, 0);
	f.state.top = 600.8; f.state.left = 20.5; f.root.emit("scroll");
	assert.equal(f.frames.size, 0); assert.equal(f.state.writes.length, 0);
	assert.equal(measurements, 0, "nested scroll must not force pane geometry work");
});

test("user intent cancels pending work immediately including iOS composition", t => {
	const f = fixture(t);
	for (const type of ["pointerdown", "touchstart", "wheel", "keydown", "beforeinput", "compositionstart"]) {
		f.state.top = 600; f.state.text = "before";
		f.guards.arm(f.view, "after"); f.state.text = "after"; f.state.top = 0;
		f.document.emit(type); assert.equal(f.frames.size, 0, type); assert.equal(f.listenerCount(), 0, type);
		f.frame(); assert.equal(f.state.writes.length, 0, type);
	}
});

test("viewport resize, window blur and hidden documents cancel the guard", t => {
	const f = fixture(t);
	for (const cancel of [() => f.window.visualViewport.emit("resize"), () => f.window.emit("blur"), () => { f.document.hidden = true; f.document.emit("visibilitychange"); }]) {
		f.document.hidden = false; f.guards.arm(f.view, "after"); f.state.text = "after"; f.state.top = 0;
		cancel(); assert.equal(f.frames.size, 0); assert.equal(f.listenerCount(), 0);
	}
	assert.equal(f.state.writes.length, 0);
});

test("captured control blur keeps the guard while genuine window blur cancels it", t => {
	const f = fixture(t);
	f.guards.arm(f.view, "after"); f.state.text = "after"; f.state.top = 0;
	f.window.emit("blur", { tagName: "INPUT" });
	assert.equal(f.frames.size, 1, "removing a focused task control must not cancel compensation");
	f.frame(); assert.equal(f.state.top, 600);
	f.state.top = 0; f.root.emit("scroll");
	f.window.emit("blur");
	assert.equal(f.frames.size, 0); assert.equal(f.listenerCount(), 0);
	f.frame(); assert.equal(f.state.writes.length, 1);
});

test("normal subsequent edits and changed view identity never restore stale positions", t => {
	const f = fixture(t);
	const mutations = [
		() => { f.state.text = "another edit"; },
		() => { f.view.file.path = "Other.md"; },
		() => { f.state.mode = "preview"; },
		() => { f.view.editor = { ...f.editor }; },
		() => { f.root.isConnected = false; },
	];
	for (const mutate of mutations) {
		f.state.text = "before"; f.state.mode = "source"; f.view.editor = f.editor;
		f.view.file.path = "Note.md"; f.root.isConnected = true; f.state.top = 600;
		f.guards.arm(f.view, "after"); f.state.text = "after"; f.state.top = 0;
		mutate(); f.frame(); assert.equal(f.state.writes.length, 0); assert.equal(f.listenerCount(), 0);
	}
});

test("deadline removes every resource and stale frames cannot revive expired guards", t => {
	const f = fixture(t); f.guards.arm(f.view, "after"); f.state.text = "after"; f.state.top = 0;
	t.mock.timers.tick(751); assert.equal(f.frames.size, 0); assert.equal(f.listenerCount(), 0);
	f.guards.arm(f.view, "after"); f.state.top = 200;
	t.mock.timers.setTime(Date.now() + 751); f.frame();
	assert.equal(f.state.writes.length, 0); assert.equal(f.listenerCount(), 0);
});

test("new guards replace old ones and an old cancel cannot cancel a newer guard", t => {
	const f = fixture(t);
	const cancelOld = f.guards.arm(f.view, "first");
	f.state.top = 300;
	f.guards.arm(f.view, "second"); cancelOld();
	assert.equal(f.frames.size, 1);
	f.state.text = "second"; f.state.top = 0; f.frame();
	assert.deepEqual(f.state.writes, [{ left: 20, top: 300 }]);
});

test("unreachable scroll positions stop after four corrections instead of fighting forever", t => {
	const f = fixture(t); f.guards.arm(f.view, "after"); f.state.text = "after"; f.state.top = 0; f.state.clamp = 100;
	for (let index = 0; index < 8; index++) f.frame();
	assert.equal(f.state.writes.length, 4); assert.equal(f.frames.size, 0); assert.equal(f.listenerCount(), 0);
});

test("missing browser APIs are a no-op and disposal is idempotent", t => {
	const f = fixture(t);
	assert.doesNotThrow(() => f.guards.arm({}, "after")());
	f.guards.arm(f.view, "after"); f.guards.dispose(); f.guards.dispose();
	assert.equal(f.listenerCount(), 0); assert.equal(f.frames.size, 0);
	f.guards.arm(f.view, "after"); assert.equal(f.frames.size, 0);
});

test("hidden panes never arm and a pane becoming hidden cancels before correction", t => {
	const f = fixture(t);
	f.root.getBoundingClientRect = () => ({ width: 0, height: 0 });
	f.guards.arm(f.view, "after"); assert.equal(f.frames.size, 0); assert.equal(f.listenerCount(), 0);
	f.root.getBoundingClientRect = () => ({ width: 640, height: 800, top: 0, bottom: 800 });
	f.guards.arm(f.view, "after"); f.state.text = "after"; f.state.top = 0;
	f.root.getBoundingClientRect = () => ({ width: 0, height: 0 });
	f.frame(); assert.equal(f.state.writes.length, 0); assert.equal(f.listenerCount(), 0);
});

test("window input cancels too and editor exceptions cannot leave active listeners", t => {
	const f = fixture(t); f.guards.arm(f.view, "after");
	f.window.emit("touchstart"); assert.equal(f.listenerCount(), 0); assert.equal(f.frames.size, 0);
	f.guards.arm(f.view, "after"); f.state.text = "after"; f.state.top = 0;
	f.editor.scrollTo = () => { throw new Error("Editor is closing"); };
	assert.doesNotThrow(() => f.frame()); assert.equal(f.listenerCount(), 0); assert.equal(f.frames.size, 0);
	f.editor.getScrollInfo = () => { throw new Error("Editor is unavailable"); };
	assert.doesNotThrow(() => f.guards.arm(f.view, "after")()); assert.equal(f.listenerCount(), 0);
});
