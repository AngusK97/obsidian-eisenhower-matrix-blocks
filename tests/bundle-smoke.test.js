"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

test("built plugin bundle loads and rolls back a failed persistence attempt", async () => {
	const originalLoad = Module._load;
	class Component {}
	class Plugin extends Component {}
	class ItemView extends Component {}
	class Modal extends Component {}
	class Notice {}
	class Menu {}

	Module._load = function mockObsidian(request, parent, isMain) {
		if (request === "obsidian") {
			return { Plugin, ItemView, Modal, Notice, Menu, setIcon() {} };
		}
		return originalLoad.call(this, request, parent, isMain);
	};

	try {
		const PluginClass = require("../main.js");
		assert.equal(typeof PluginClass, "function");
		assert.equal(Object.getPrototypeOf(PluginClass.prototype), Plugin.prototype);

		const plugin = new PluginClass();
		plugin.data = {
			version: 1,
			tasks: [
				{
					id: "unsaved",
					title: "Unsaved task",
					quadrant: "do",
					createdAt: new Date(2026, 6, 22, 12, 0).toISOString(),
					completedAt: null,
					order: 0,
				},
			],
		};
		plugin.saveQueue = Promise.resolve();
		plugin.renderViews = () => {};
		plugin.saveData = async () => {
			throw new Error("disk full");
		};
		plugin.loadData = async () => ({ version: 1, tasks: [] });
		const originalConsoleError = console.error;
		console.error = () => {};
		try {
			assert.equal(await plugin.commit(), false);
			assert.deepEqual(plugin.data.tasks, []);
		} finally {
			console.error = originalConsoleError;
		}
	} finally {
		Module._load = originalLoad;
	}
});
