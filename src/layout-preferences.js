"use strict";

const STORAGE_KEY = "eisenhower-matrix-blocks:layouts";
const LAYOUT_MODES = Object.freeze(["auto", "grid", "vertical"]);

function legacyKey(app) {
	// The adapter URI distinguishes even vaults with the same display name (Obsidian <1.8.7).
	return `${STORAGE_KEY}:${app.vault.adapter.getResourcePath("")}`;
}

function readPreferences(app) {
	let value;
	if (typeof app.loadLocalStorage === "function") {
		value = app.loadLocalStorage(STORAGE_KEY);
		// Keep preferences when upgrading from a host without the vault-local API.
		if (value == null && app.vault?.adapter && globalThis.localStorage) {
			value = JSON.parse(globalThis.localStorage.getItem(legacyKey(app)) || "null");
		}
	} else value = JSON.parse(globalThis.localStorage.getItem(legacyKey(app)) || "null");
	const entries = new Map();
	if (!Array.isArray(value)) return entries;
	for (const entry of value) {
		if (!Array.isArray(entry) || entry.length !== 3) continue;
		const [path, boardId, mode] = entry;
		if (typeof path === "string" && typeof boardId === "string" && ["grid", "vertical"].includes(mode)) {
			entries.set(JSON.stringify([path, boardId]), mode);
		}
	}
	return entries;
}

function writePreferences(app, entries) {
	const value = [...entries].map(([key, mode]) => [...JSON.parse(key), mode]);
	// An empty array marks an explicit reset; null would revive legacy preferences.
	if (typeof app.saveLocalStorage === "function") app.saveLocalStorage(STORAGE_KEY, value);
	else if (value.length) globalThis.localStorage.setItem(legacyKey(app), JSON.stringify(value));
	else globalThis.localStorage.removeItem(legacyKey(app));
}

function getBoardLayout(app, path, boardId) {
	try {
		return readPreferences(app).get(JSON.stringify([path, boardId])) || "auto";
	} catch (error) {
		console.warn("Eisenhower Matrix Blocks could not read local layout preferences", error);
		return "auto";
	}
}

function saveBoardLayout(app, path, boardId, mode) {
	if (!LAYOUT_MODES.includes(mode)) throw new Error("Invalid matrix layout");
	const entries = readPreferences(app);
	const key = JSON.stringify([path, boardId]);
	if (mode === "auto") entries.delete(key);
	else entries.set(key, mode);
	writePreferences(app, entries);
}

function moveBoardLayouts(app, oldPath, newPath) {
	const entries = readPreferences(app);
	let changed = false;
	for (const [key, mode] of [...entries]) {
		const [path, boardId] = JSON.parse(key);
		if (path !== oldPath && !path.startsWith(`${oldPath}/`)) continue;
		entries.delete(key);
		entries.set(JSON.stringify([newPath + path.slice(oldPath.length), boardId]), mode);
		changed = true;
	}
	if (changed) writePreferences(app, entries);
}

module.exports = { LAYOUT_MODES, getBoardLayout, saveBoardLayout, moveBoardLayouts };
