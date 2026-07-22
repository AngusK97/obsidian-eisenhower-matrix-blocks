"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const { addTask, createEmptyData } = require("../src/core");
const {
	findBoardCodeBlocks,
	readBoardFromDocument,
	renderBoardCodeBlock,
} = require("../src/board-store");
const { updateMarkdownDocument } = require("../src/markdown-store");

class Component {}
class Plugin extends Component {}
class MarkdownRenderChild extends Component {
	constructor(containerEl) {
		super();
		this.containerEl = containerEl;
	}
}
class MarkdownView {}
class Modal extends Component {}
class Notice { constructor() {} }
class Menu {}
class TFile {
	constructor(path) {
		this.path = path;
	}
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
				MarkdownRenderChild,
				MarkdownView,
				Modal,
				Notice,
				Menu,
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

function createPluginHarness(PluginClass, initialContent) {
	const file = new TFile("Projects.md");
	let content = initialContent;
	let failProcess = false;
	const plugin = new PluginClass();
	plugin.boardRenderers = new Set();
	plugin.fileQueues = new Map();
	plugin.app = {
		vault: {
			getAbstractFileByPath(path) { return path === file.path ? file : null; },
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
		file,
		plugin,
		getContent: () => content,
		setContent: (value) => { content = value; },
		setFailProcess: (value) => { failProcess = value; },
	};
}

test("plugin registers an inline processor and insert command without a global view", async () => {
	const PluginClass = loadBuiltPlugin();
	assert.equal(Object.getPrototypeOf(PluginClass.prototype), Plugin.prototype);
	const plugin = new PluginClass();
	let processorLanguage = null;
	let command = null;
	let layoutReadyCallback = null;
	let registerViewCalls = 0;
	plugin.app = {
		workspace: { onLayoutReady(callback) { layoutReadyCallback = callback; } },
		vault: { on() { return {}; } },
	};
	plugin.registerMarkdownCodeBlockProcessor = (language) => { processorLanguage = language; };
	plugin.addCommand = (value) => { command = value; };
	plugin.addRibbonIcon = () => {};
	plugin.registerEvent = () => {};
	plugin.registerView = () => { registerViewCalls += 1; };
	await plugin.onload();

	assert.equal(processorLanguage, "quadrant-tasks");
	assert.equal(command.id, "insert-quadrant-board");
	assert.equal(typeof layoutReadyCallback, "function");
	assert.equal(registerViewCalls, 0);
});

test("insert command writes a complete independent board at the cursor", () => {
	const PluginClass = loadBuiltPlugin();
	const plugin = new PluginClass();
	let inserted = null;
	const editor = {
		getCursor: () => ({ line: 0, ch: 0 }),
		getLine: () => "",
		replaceRange: (text, cursor) => { inserted = { text, cursor }; },
	};
	plugin.insertBoard(editor);
	assert.equal(inserted.cursor.line, 0);
	assert.equal(findBoardCodeBlocks(inserted.text).length, 1);
	assert.deepEqual(findBoardCodeBlocks(inserted.text)[0].data.tasks, []);
});

test("a local mutation rebases on the latest note and only changes its board", async () => {
	const PluginClass = loadBuiltPlugin();
	const boardA = createEmptyData();
	addTask(boardA, "External", "schedule", { idFactory: () => "external" });
	const document = `${renderBoardCodeBlock("board-alpha", boardA)}\n\n${renderBoardCodeBlock("board-beta", createEmptyData())}`;
	const harness = createPluginHarness(PluginClass, document);
	harness.setContent(`# externally added heading\n\n${document}`);

	const outcome = await harness.plugin.mutateBoard("Projects.md", "board-beta", (data) =>
		addTask(data, "Local", "do", { idFactory: () => "local" }),
	);
	assert.equal(outcome.result.id, "local");
	assert.ok(harness.getContent().startsWith("# externally added heading\n\n"));
	assert.deepEqual(readBoardFromDocument(harness.getContent(), "board-alpha").data.tasks.map((task) => task.id), ["external"]);
	assert.deepEqual(readBoardFromDocument(harness.getContent(), "board-beta").data.tasks.map((task) => task.id), ["local"]);
});

test("renaming a board persists its title and refreshes the matching renderer", async () => {
	const PluginClass = loadBuiltPlugin();
	const original = renderBoardCodeBlock("board-alpha", createEmptyData());
	const harness = createPluginHarness(PluginClass, original);
	let renderedTitle = null;
	harness.plugin.boardRenderers.add({
		sourcePath: "Projects.md",
		boardId: "board-alpha",
		setBoardData(data, title) {
			assert.deepEqual(data.tasks, []);
			renderedTitle = title;
		},
	});

	const outcome = await harness.plugin.renameBoard("Projects.md", "board-alpha", "个人计划");
	assert.equal(outcome.result, "个人计划");
	assert.equal(readBoardFromDocument(harness.getContent(), "board-alpha").title, "个人计划");
	assert.equal(renderedTitle, "个人计划");
});

test("a failed local write leaves the note unchanged", async () => {
	const PluginClass = loadBuiltPlugin();
	const original = renderBoardCodeBlock("board-alpha", createEmptyData());
	const harness = createPluginHarness(PluginClass, original);
	harness.setFailProcess(true);
	const originalConsoleError = console.error;
	console.error = () => {};
	try {
		const outcome = await harness.plugin.mutateBoard("Projects.md", "board-alpha", (data) => addTask(data, "Unsaved", "do"));
		assert.equal(outcome, null);
		assert.equal(harness.getContent(), original);
	} finally {
		console.error = originalConsoleError;
	}
});

test("1.1 global Markdown migrates in place to one local board", async () => {
	const PluginClass = loadBuiltPlugin();
	const legacy = createEmptyData();
	addTask(legacy, "Migrated", "delegate", { idFactory: () => "legacy-task" });
	const file = new TFile("Quadrant Tasks.md");
	let content = `Preface\n\n${updateMarkdownDocument("", legacy)}\nTail`;
	let settings = null;
	let backup = null;
	const plugin = new PluginClass();
	plugin.manifest = { dir: ".obsidian/plugins/quadrant-tasks" };
	plugin.loadData = async () => ({ settingsVersion: 1, taskFilePath: file.path });
	plugin.saveData = async (value) => { settings = value; };
	plugin.app = {
		vault: {
			adapter: {
				exists: async () => false,
				write: async (path, value) => { backup = { path, value }; },
			},
			getAbstractFileByPath: () => file,
			read: async () => content,
			process: async (target, callback) => { content = callback(content); },
		},
	};
	await plugin.migrateLegacyStorage();

	assert.equal(settings.settingsVersion, 2);
	assert.match(backup.path, /global-note-backup-1\.1\.0\.md$/);
	assert.ok(content.startsWith("Preface\n\n# Quadrant Tasks\n\n```quadrant-tasks"));
	assert.ok(content.endsWith("\nTail"));
	assert.equal(readBoardFromDocument(content, "board-migrated-global").data.tasks[0].id, "legacy-task");
	const migratedOnce = content;
	await plugin.migrateLegacyStorage();
	assert.equal(content, migratedOnce);
});

test("1.0 JSON migrates directly to a local board with a backup", async () => {
	const PluginClass = loadBuiltPlugin();
	const legacy = createEmptyData();
	addTask(legacy, "JSON task", "eliminate", { idFactory: () => "json-task" });
	let file = null;
	let content = null;
	let settings = null;
	let backup = null;
	const plugin = new PluginClass();
	plugin.manifest = { dir: ".obsidian/plugins/quadrant-tasks" };
	plugin.loadData = async () => legacy;
	plugin.saveData = async (value) => { settings = value; };
	plugin.app = {
		vault: {
			adapter: {
				exists: async () => false,
				write: async (path, value) => { backup = { path, value }; },
			},
			getAbstractFileByPath: () => file,
			create: async (path, value) => {
				file = new TFile(path);
				content = value;
				return file;
			},
			read: async () => content,
		},
	};
	await plugin.migrateLegacyStorage();

	assert.equal(settings.settingsVersion, 2);
	assert.match(backup.path, /data-backup-1\.0\.0\.json$/);
	assert.match(backup.value, /json-task/);
	assert.equal(readBoardFromDocument(content, "board-migrated-global").data.tasks[0].id, "json-task");
});
