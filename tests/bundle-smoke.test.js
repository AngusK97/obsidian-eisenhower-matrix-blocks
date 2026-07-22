"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const { addTask, createEmptyData } = require("../src/core");
const { parseTaskMarkdown, updateMarkdownDocument } = require("../src/markdown-store");

class Component {}
class Plugin extends Component {}
class ItemView extends Component {}
class Modal extends Component {}
class Notice {
	constructor() {}
}
class Menu {}
class PluginSettingTab {}
class TFile {
	constructor(path) {
		this.path = path;
	}
}
class Setting {
	setName() { return this; }
	setDesc() { return this; }
	addText() { return this; }
	addButton() { return this; }
}

function normalizePath(path) {
	return path.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/{2,}/g, "/");
}

function loadBuiltPlugin() {
	const originalLoad = Module._load;
	Module._load = function mockObsidian(request, parent, isMain) {
		if (request === "obsidian") {
			return {
				Plugin,
				ItemView,
				Modal,
				Notice,
				Menu,
				PluginSettingTab,
				Setting,
				TFile,
				normalizePath,
				setIcon() {},
			};
		}
		return originalLoad.call(this, request, parent, isMain);
	};
	try {
		delete require.cache[require.resolve("../main.js")];
		return require("../main.js");
	} finally {
		Module._load = originalLoad;
	}
}

function createMarkdownHarness(PluginClass, initialContent) {
	const file = new TFile("Quadrant Tasks.md");
	let content = initialContent;
	let failProcess = false;
	const plugin = new PluginClass();
	plugin.data = createEmptyData();
	plugin.settings = { taskFilePath: file.path, migration: null };
	plugin.storageMode = "markdown";
	plugin.storageReady = true;
	plugin.saveQueue = Promise.resolve();
	plugin.renderViews = () => {};
	plugin.app = {
		vault: {
			getAbstractFileByPath(path) {
				return path === file.path ? file : null;
			},
			async process(target, callback) {
				assert.equal(target, file);
				if (failProcess) throw new Error("disk full");
				content = callback(content);
			},
			async read(target) {
				assert.equal(target, file);
				return content;
			},
		},
	};
	return {
		plugin,
		getContent: () => content,
		setContent: (value) => { content = value; },
		setFailProcess: (value) => { failProcess = value; },
	};
}

test("plugin startup defers storage initialization until the workspace layout is ready", async () => {
	const PluginClass = loadBuiltPlugin();
	const plugin = new PluginClass();
	let layoutReadyCallback = null;
	let initializationCalls = 0;
	plugin.app = {
		workspace: {
			onLayoutReady(callback) { layoutReadyCallback = callback; },
		},
	};
	plugin.registerView = () => {};
	plugin.addRibbonIcon = () => {};
	plugin.addCommand = () => {};
	plugin.addSettingTab = () => {};
	plugin.finishStorageInitialization = async () => { initializationCalls += 1; };

	await plugin.onload();
	assert.equal(initializationCalls, 0);
	assert.equal(typeof layoutReadyCallback, "function");
	layoutReadyCallback();
	assert.equal(initializationCalls, 1);
});

test("built plugin bundle loads and rolls back a failed Markdown write", async () => {
	const PluginClass = loadBuiltPlugin();
	assert.equal(Object.getPrototypeOf(PluginClass.prototype), Plugin.prototype);
	const harness = createMarkdownHarness(
		PluginClass,
		updateMarkdownDocument("", createEmptyData()),
	);
	harness.setFailProcess(true);
	const originalConsoleError = console.error;
	console.error = () => {};
	try {
		const result = await harness.plugin.mutate((data) => addTask(data, "Unsaved task", "do"));
		assert.equal(result, null);
		assert.deepEqual(harness.plugin.data.tasks, []);
	} finally {
		console.error = originalConsoleError;
	}
});

test("a mutation rebases on the latest externally edited Markdown", async () => {
	const PluginClass = loadBuiltPlugin();
	const external = createEmptyData();
	addTask(external, "External task", "schedule", { idFactory: () => "external" });
	const harness = createMarkdownHarness(PluginClass, updateMarkdownDocument("", external));

	const result = await harness.plugin.mutate((data) =>
		addTask(data, "Local task", "do", { idFactory: () => "local" }),
	);
	assert.equal(result.id, "local");
	assert.deepEqual(
		parseTaskMarkdown(harness.getContent()).data.tasks.map((task) => task.id).sort(),
		["external", "local"],
	);
});

test("legacy JSON migration creates a backup and verifies Markdown task ids", async () => {
	const PluginClass = loadBuiltPlugin();
	const legacy = createEmptyData();
	addTask(legacy, "Private legacy task", "delegate", { idFactory: () => "legacy-id" });
	let file = null;
	let content = null;
	let backup = null;
	let savedSettings = null;
	const plugin = new PluginClass();
	plugin.manifest = { dir: ".obsidian/plugins/quadrant-tasks" };
	plugin.loadData = async () => legacy;
	plugin.saveData = async (value) => { savedSettings = value; };
	plugin.app = {
		vault: {
			adapter: {
				exists: async () => false,
				write: async (path, value) => { backup = { path, value }; },
			},
			getAbstractFileByPath(path) {
				return file?.path === path ? file : null;
			},
			async create(path, value) {
				file = new TFile(path);
				content = value;
				return file;
			},
			async process(target, callback) {
				assert.equal(target, file);
				content = callback(content);
			},
			async read(target) {
				assert.equal(target, file);
				return content;
			},
		},
	};
	await plugin.initializeStorage();

	assert.match(backup.path, /data-backup-1\.0\.0\.json$/);
	assert.match(backup.value, /legacy-id/);
	assert.equal(savedSettings.settingsVersion, 1);
	assert.equal(savedSettings.tasks, undefined);
	assert.equal(parseTaskMarkdown(content).data.tasks[0].id, "legacy-id");
});

test("legacy migration refuses same-id content conflicts", async () => {
	const PluginClass = loadBuiltPlugin();
	const markdownData = createEmptyData();
	addTask(markdownData, "Markdown version", "do", { idFactory: () => "same-id" });
	const legacyData = createEmptyData();
	addTask(legacyData, "Legacy version", "schedule", { idFactory: () => "same-id" });
	const originalContent = updateMarkdownDocument("", markdownData);
	const harness = createMarkdownHarness(PluginClass, originalContent);

	await assert.rejects(
		harness.plugin.migrateLegacyData(legacyData),
		/迁移冲突/,
	);
	assert.equal(harness.getContent(), originalContent);
});

test("an unavailable external task file rerenders into an error state", async () => {
	const PluginClass = loadBuiltPlugin();
	const harness = createMarkdownHarness(PluginClass, updateMarkdownDocument("", createEmptyData()));
	let renderCount = 0;
	harness.plugin.renderViews = () => { renderCount += 1; };
	harness.setContent("<!-- quadrant-tasks:start -->\nmissing end marker");
	const originalConsoleError = console.error;
	console.error = () => {};
	try {
		await harness.plugin.reloadFromTaskFile();
	} finally {
		console.error = originalConsoleError;
	}
	assert.ok(harness.plugin.storageIssue instanceof Error);
	assert.equal(renderCount, 1);
});

test("an invalid external rename is handled without an unhandled rejection", async () => {
	const PluginClass = loadBuiltPlugin();
	const harness = createMarkdownHarness(PluginClass, updateMarkdownDocument("", createEmptyData()));
	let renderCount = 0;
	harness.plugin.renderViews = () => { renderCount += 1; };
	const originalConsoleError = console.error;
	console.error = () => {};
	try {
		assert.equal(await harness.plugin.followRenamedTaskFile("Quadrant Tasks.txt"), false);
	} finally {
		console.error = originalConsoleError;
	}
	assert.ok(harness.plugin.storageIssue instanceof Error);
	assert.equal(renderCount, 1);
});

test("a missing post-migration Markdown file remains unavailable", async () => {
	const PluginClass = loadBuiltPlugin();
	let createCalls = 0;
	const plugin = new PluginClass();
	plugin.loadData = async () => ({ settingsVersion: 1, taskFilePath: "Quadrant Tasks.md" });
	plugin.app = {
		vault: {
			getAbstractFileByPath: () => null,
			create: async () => { createCalls += 1; },
		},
	};
	const originalConsoleError = console.error;
	console.error = () => {};
	try {
		await plugin.initializeStorage();
	} finally {
		console.error = originalConsoleError;
	}
	assert.equal(createCalls, 0);
	assert.ok(plugin.storageIssue instanceof Error);
});
