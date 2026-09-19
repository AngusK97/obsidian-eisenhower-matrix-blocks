"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createTagInput } = require("../src/tag-input");

class Element {
	constructor(options = {}) { this.children = []; this.value = ""; this.attrs = options.attr || {}; this.cls = options.cls || ""; this.text = options.text || ""; this.events = {}; }
	createEl(_tag, options) { const child = new Element(options); this.children.push(child); return child; }
	createDiv(options) { return this.createEl("div", options); }
	createSpan(options) { return this.createEl("span", options); }
	setAttribute(name, value) { this.attrs[name] = value; }
	addEventListener(name, callback) { this.events[name] = callback; }
	removeEventListener(name) { delete this.events[name]; }
	empty() { this.children = []; }
	focus() { this.focused = true; }
	all(cls) { return this.children.flatMap(child => [...(child.cls.split(" ").includes(cls) ? [child] : []), ...child.all(cls)]); }
	fire(name, extra = {}) { const event = { preventDefault() {}, stopPropagation() {}, ...extra }; this.events[name]?.(event); return event; }
}
const plugin = { t: (key, variables) => key + (variables?.tag || "") };

test("tag field commits separators, deduplicates, and includes the unconfirmed final tag", () => {
	const root = new Element(); let changed;
	const control = createTagInput(root, plugin, ["Work"], value => { changed = value; });
	const input = root.all("qt-tag-input")[0];
	input.value = "#Work，生活,旅行"; input.fire("input");
	assert.deepEqual(control.getValue(), ["Work", "生活", "旅行"]);
	assert.deepEqual(changed, control.getValue());
	input.fire("keydown", { key: "Enter" });
	assert.equal(input.value, "");
	assert.equal(root.all("qt-tag").length, 3);
	control.destroy();
});

test("IME Enter is ignored, tag removal is explicit, and disabled controls cannot change tags", () => {
	const root = new Element(); const control = createTagInput(root, plugin, ["Keep"], () => {});
	const input = root.all("qt-tag-input")[0];
	input.value = "候选"; input.fire("keydown", { key: "Enter", keyCode: 229 });
	assert.equal(input.value, "候选");
	control.setDisabled(true); assert.equal(input.disabled, true);
	root.all("qt-tag-remove")[0].fire("click");
	assert.deepEqual(control.getValue(), ["Keep", "候选"]);
	control.setDisabled(false); root.all("qt-tag-remove")[0].fire("click");
	assert.deepEqual(control.getValue(), ["候选"]);
	control.setValue(["One", "Two"]); assert.deepEqual(control.getValue(), ["One", "Two"]);
});

test("tag field has no count cap and preserves spaces, Unicode and literal markup", () => {
	const root = new Element(); const tags = Array.from({ length: 120 }, (_, index) => `tag ${index}`);
	const control = createTagInput(root, plugin, tags, () => {});
	const input = root.all("qt-tag-input")[0];
	input.value = "<script>literal</script>\ne\u0301"; input.fire("input"); input.fire("keydown", { key: "Enter" });
	assert.equal(control.getValue().length, 122);
	assert.ok(control.getValue().includes("é"));
	assert.equal(root.all("qt-tag").length, 122);
});
