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

test("quick-add boundary has a fixed theme divider and balanced breathing room", () => {
	const divider = declarationsFor(".qt-root .qt-task-divider");
	assert.match(divider, /border-top:\s*1px solid var\(--background-modifier-border\)/);
	assert.match(divider, /margin:\s*0 12px 12px/);
	assert.match(divider, /flex:\s*0 0 auto/);
	assert.match(declarationsFor(".qt-quick-add"), /padding:\s*0 12px 12px/);
});

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

test("task cards preserve their surface and padding against host list styles", () => {
	const rowRule = stylesheet.match(/\.qt-root \.qt-task-row,\s*\.qt-root \.qt-completed-row\s*\{([^}]*)\}/);
	assert.ok(rowRule, "Missing shared task-row CSS rule");
	const row = rowRule[1];
	const title = declarationsFor(".qt-task-row .qt-task-title");

	assert.match(row, /border-radius:\s*6px\s*;/);
	assert.match(row, /padding:\s*10px\s*;/);
	assert.match(row, /border:\s*0\s*;/);
	assert.match(row, /background:\s*color-mix/);
	assert.match(row, /align-items:\s*flex-start\s*;/);
	assert.match(row, /overflow:\s*hidden\s*;/);
	assert.match(title, /max-width:\s*100%\s*;/);
});

test("task textareas grow on mobile before becoming internally scrollable", () => {
	const editor = declarationsFor(".qt-task-textarea");

	assert.match(editor, /min-height:\s*[^;]+;/);
	assert.match(editor, /max-height:\s*(?:min\([^;]+\)|[^;]+(?:vh|dvh))\s*;/);
	assert.match(editor, /overflow-y:\s*auto\s*;/);
	assert.match(editor, /resize:\s*none\s*;/);
});

test("completed scroll mode has a bounded focusable list", () => {
	const list = declarationsFor(".qt-completed-list.is-scrollable");

	assert.match(list, /max-height:\s*[^;]+;/);
	assert.match(list, /overflow-y:\s*auto\s*;/);
	assert.match(list, /overscroll-behavior:\s*contain\s*;/);
});

test("deadline units wrap as whole pieces and task buttons resist host theme decoration", () => {
	assert.match(stylesheet, /@container qt-board \(max-width: 620px\)/);
	assert.match(declarationsFor(".qt-task-due"), /flex-wrap:\s*wrap/);
	assert.match(declarationsFor(".qt-due-clock, .qt-due-relative"), /white-space:\s*nowrap/);
	const button = declarationsFor(".qt-root button.qt-task-title");
	assert.match(button, /text-align:\s*left/);
	assert.match(button, /background:\s*transparent/);
	assert.match(button, /border:\s*0/);
	assert.match(button, /min-height:\s*0/);
});

test("all stable tag palette pairs exceed normal-text contrast requirements", () => {
	const luminance = hex => {
		const rgb = hex.match(/[a-f\d]{2}/gi).map(pair => parseInt(pair, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
		return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
	};
	const pairs = [...stylesheet.matchAll(/--qt-tag-fg:\s*(#[a-f\d]{6});\s*--qt-tag-bg:\s*(#[a-f\d]{6})/gi)];
	assert.equal(pairs.length, 16);
	for (const [, foreground, background] of pairs) {
		const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
		assert.ok((values[0] + .05) / (values[1] + .05) >= 4.5, `${foreground} on ${background}`);
	}
});
