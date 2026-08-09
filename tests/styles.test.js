"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const stylesheet = readFileSync(join(__dirname, "..", "styles.css"), "utf8");

function declarationsFor(selector) {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = stylesheet.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
	assert.ok(match, `Missing CSS rule for ${selector}`);
	return match[1];
}

test("active task titles wrap and grow with long content", () => {
	const declarations = declarationsFor(".qt-task-row .qt-task-title");

	assert.match(declarations, /height:\s*auto\s*;/);
	assert.match(declarations, /white-space:\s*normal\s*;/);
	assert.match(declarations, /line-height:\s*1\.4\s*;/);
	assert.match(declarations, /overflow-wrap:\s*anywhere\s*;/);
	assert.match(declarations, /word-break:\s*break-word\s*;/);
});

test("editable quadrant labels wrap without displacing their action", () => {
	const heading = declarationsFor(".qt-quadrant-heading");
	const labels = declarationsFor(".qt-quadrant-labels");
	const editButton = declarationsFor(".qt-quadrant-edit");

	assert.match(heading, /flex:\s*1\s*;/);
	assert.match(labels, /min-width:\s*0\s*;/);
	assert.match(labels, /overflow-wrap:\s*anywhere\s*;/);
	assert.match(editButton, /flex:\s*0\s+0\s+28px\s*;/);
});
