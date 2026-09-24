"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { getBoardLayout, saveBoardLayout, moveBoardLayouts } = require("../src/layout-preferences");

function localApp(initial = null) {
	let value = initial;
	return {
		loadLocalStorage: () => structuredClone(value),
		saveLocalStorage: (_key, next) => { value = structuredClone(next); },
	};
}

test("preferences validate stored entries and isolate unusual note paths and board IDs", () => {
	const app = localApp([["a.md", "board-a", "grid"], ["b.md", "board-b", "bad"], null, [1, "x", "grid"]]);
	assert.equal(getBoardLayout(app, "a.md", "board-a"), "grid");
	assert.equal(getBoardLayout(app, "b.md", "board-b"), "auto");
	saveBoardLayout(app, "__proto__", "constructor", "vertical");
	assert.equal(getBoardLayout(app, "__proto__", "constructor"), "vertical");
	assert.equal(getBoardLayout(app, "a.md", "board-a"), "grid");
	assert.throws(() => saveBoardLayout(app, "a.md", "board-a", "bad"), /Invalid/);
	assert.equal(getBoardLayout(localApp({ unexpected: true }), "a.md", "board-a"), "auto");
});

test("renaming a note or folder migrates all boards including closed notes without prefix collisions", () => {
	const app = localApp();
	saveBoardLayout(app, "Work/a.md", "board-a", "grid");
	saveBoardLayout(app, "Work/a.md", "board-b", "vertical");
	saveBoardLayout(app, "Work/sub/b.md", "board-c", "grid");
	saveBoardLayout(app, "Workspace/a.md", "board-a", "vertical");
	moveBoardLayouts(app, "Work/a.md", "Work/renamed.md");
	assert.equal(getBoardLayout(app, "Work/a.md", "board-a"), "auto");
	assert.equal(getBoardLayout(app, "Work/renamed.md", "board-b"), "vertical");
	moveBoardLayouts(app, "Work", "Archive");
	assert.equal(getBoardLayout(app, "Archive/renamed.md", "board-a"), "grid");
	assert.equal(getBoardLayout(app, "Archive/sub/b.md", "board-c"), "grid");
	assert.equal(getBoardLayout(app, "Workspace/a.md", "board-a"), "vertical");
});

test("unavailable storage does not break rendering and failed writes preserve previous data", () => {
	const app = localApp([["a.md", "board-a", "grid"]]);
	app.saveLocalStorage = () => { throw new Error("quota"); };
	assert.throws(() => saveBoardLayout(app, "a.md", "board-a", "vertical"), /quota/);
	assert.equal(getBoardLayout(app, "a.md", "board-a"), "grid");
	app.loadLocalStorage = () => { throw new Error("unavailable"); };
	const warn = console.warn;
	console.warn = () => {};
	try { assert.equal(getBoardLayout(app, "a.md", "board-a"), "auto"); }
	finally { console.warn = warn; }
	assert.throws(() => saveBoardLayout(app, "a.md", "board-a", "grid"), /unavailable/);
});

test("older Obsidian uses vault-scoped localStorage, restores after restart and clears auto", () => {
	const original = globalThis.localStorage;
	const values = new Map();
	globalThis.localStorage = {
		getItem: key => values.get(key) ?? null,
		setItem: (key, value) => values.set(key, value),
		removeItem: key => values.delete(key),
	};
	const app = vault => ({ vault: { adapter: { getResourcePath: () => `app://local/${vault}/` } } });
	try {
		saveBoardLayout(app("one"), "a.md", "board-a", "grid");
		assert.equal(getBoardLayout(app("one"), "a.md", "board-a"), "grid");
		assert.equal(getBoardLayout(app("two"), "a.md", "board-a"), "auto");
		const upgraded = Object.assign(app("one"), localApp());
		assert.equal(getBoardLayout(upgraded, "a.md", "board-a"), "grid", "host upgrade must retain old preferences");
		saveBoardLayout(upgraded, "a.md", "board-a", "auto");
		assert.equal(getBoardLayout(upgraded, "a.md", "board-a"), "auto", "old values must not revive after resetting");
		saveBoardLayout(app("one"), "a.md", "board-a", "auto");
		assert.equal(getBoardLayout(app("one"), "a.md", "board-a"), "auto");
		assert.equal(values.size, 0);
	} finally {
		if (original === undefined) delete globalThis.localStorage;
		else globalThis.localStorage = original;
	}
});
