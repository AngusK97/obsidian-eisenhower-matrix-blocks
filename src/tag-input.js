"use strict";

const { normalizeTags, getTagColorIndex } = require("./task-tags");

function createTagChip(parent, tag) {
	const chip = parent.createSpan({ cls: `qt-tag qt-tag-color-${getTagColorIndex(tag)}`, attr: { title: tag } });
	chip.createSpan({ cls: "qt-tag-label", text: `#${tag}` });
	return chip;
}

function createTagInput(parent, plugin, initialTags, onChange) {
	let tags = normalizeTags(initialTags);
	let disabled = false;
	const root = parent.createDiv({ cls: "qt-tag-field" });
	const chips = root.createDiv({ cls: "qt-tag-chips" });
	const input = root.createEl("textarea", {
		cls: "qt-tag-input", attr: { rows: "1", "aria-label": plugin.t("task.tags"), placeholder: plugin.t("task.tagsPlaceholder") },
	});
	const split = value => value.split(/[,，\r\n]+/);
	const getValue = () => normalizeTags([...tags, ...split(input.value)]);
	const render = () => {
		chips.empty();
		for (const tag of tags) {
			const chip = createTagChip(chips, tag);
			const remove = chip.createEl("button", {
				cls: "qt-tag-remove", text: "×", attr: { type: "button", "aria-label": plugin.t("task.removeTag", { tag }) },
			});
			remove.disabled = disabled;
			remove.addEventListener("click", () => {
				if (disabled) return;
				tags = tags.filter(value => value !== tag);
				render(); onChange(getValue()); input.focus();
			});
		}
	};
	const commit = () => {
		if (disabled) return;
		tags = getValue(); input.value = ""; render(); onChange(getValue());
	};
	const onInput = event => {
		if (disabled || event.isComposing) return;
		if (/[,，\r\n]/.test(input.value)) {
			const parts = split(input.value);
			input.value = parts.pop();
			tags = normalizeTags([...tags, ...parts]); render();
		}
		onChange(getValue());
	};
	const onKey = event => {
		if (event.key !== "Enter" || event.isComposing || event.keyCode === 229) return;
		event.preventDefault(); event.stopPropagation(); commit();
	};
	input.addEventListener("input", onInput);
	input.addEventListener("compositionend", onInput);
	input.addEventListener("keydown", onKey);
	render();
	return {
		getValue,
		setValue(value) { tags = normalizeTags(value); input.value = ""; render(); },
		setDisabled(value) { disabled = value; input.disabled = value; render(); },
		destroy() {
			input.removeEventListener("input", onInput);
			input.removeEventListener("compositionend", onInput);
			input.removeEventListener("keydown", onKey);
		},
	};
}

module.exports = { createTagInput, createTagChip };
