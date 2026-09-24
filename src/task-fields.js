"use strict";

const { Modal, setIcon } = require("obsidian");
const { normalizeDueDate, normalizeDueTime } = require("./task-details");
const { createTagInput } = require("./tag-input");

function autoSize(textarea) {
	textarea.style.height = "auto";
	textarea.style.height = `${textarea.scrollHeight}px`;
}

function validateNativeField(input, normalize) {
	const valid = !input.validity?.badInput && input.validity?.valid !== false && (!input.value || Boolean(normalize(input.value)));
	if (!valid) { input.reportValidity?.(); input.focus(); }
	return valid;
}

/** Use the host's real calendar, preserving a visible input on every platform. */
function createDueDateControl(parent, plugin, initialValue, onChange) {
	const wrapper = parent.createDiv({ cls: "qt-date-control" });
	const input = wrapper.createEl("input", {
		cls: "qt-native-date", attr: { type: "date", "aria-label": plugin.t("task.dueDate"), title: plugin.t("task.dueDate"), min: "0001-01-01", max: "9999-12-31" },
	});
	const getValue = () => normalizeDueDate(input.value);
	const setValue = value => { input.value = normalizeDueDate(value) || ""; };
	const change = () => {
		if (!input.validity?.badInput) onChange(getValue());
	};
	input.addEventListener("change", change);
	setValue(initialValue);
	return {
		getValue, setValue,
		validate: () => validateNativeField(input, normalizeDueDate),
		setDisabled(disabled) { input.disabled = disabled; },
		destroy() { input.removeEventListener("change", change); },
	};
}

/** A calendar deadline can optionally include local wall-clock time. */
function createDeadlineFields(parent, plugin, initialValue = {}, onChange = () => {}) {
	const wrapper = parent.createDiv({ cls: "qt-deadline-fields" });
	let disabled = false;
	const date = createDueDateControl(wrapper, plugin, initialValue.dueDate, value => {
		if (!value) time.value = "";
		updateDisabled(); onChange(getValue());
	});
	const timeWrapper = wrapper.createDiv({ cls: "qt-time-control" });
	const time = timeWrapper.createEl("input", {
		cls: "qt-due-time", attr: { type: "time", step: "60", "aria-label": plugin.t("task.dueTime"), title: plugin.t("task.timeOptional") },
	});
	const clear = timeWrapper.createEl("button", {
		cls: "clickable-icon qt-icon-button qt-clear-time", attr: { type: "button", "aria-label": plugin.t("task.clearTime"), title: plugin.t("task.clearTime") },
	});
	setIcon(clear, "x");
	const getValue = () => ({ dueDate: date.getValue(), dueTime: date.getValue() ? normalizeDueTime(time.value) : null });
	const updateDisabled = () => {
		date.setDisabled(disabled);
		time.disabled = disabled || !date.getValue();
		// Native partial input can have an empty value but still needs a way to clear it.
		clear.hidden = !date.getValue() || (!time.value && !time.validity?.badInput);
		clear.disabled = disabled || clear.hidden;
	};
	const setValue = (value = {}) => {
		date.setValue(value.dueDate);
		time.value = date.getValue() ? normalizeDueTime(value.dueTime) || "" : "";
		updateDisabled();
	};
	const change = () => { updateDisabled(); if (!time.validity?.badInput) onChange(getValue()); };
	const clearTime = () => { time.value = ""; updateDisabled(); onChange(getValue()); time.focus(); };
	// Segmented native editors can change badInput without emitting input/change.
	const stateEvents = ["input", "keyup", "pointerup", "blur"];
	for (const event of stateEvents) time.addEventListener(event, updateDisabled);
	time.addEventListener("change", change);
	clear.addEventListener("click", clearTime);
	setValue(initialValue);
	return {
		getValue, setValue,
		validate: () => date.validate() && (!date.getValue() || validateNativeField(time, normalizeDueTime)),
		setDisabled(value) { disabled = value; updateDisabled(); },
		destroy() {
			date.destroy();
			for (const event of stateEvents) time.removeEventListener(event, updateDisabled);
			time.removeEventListener("change", change); clear.removeEventListener("click", clearTime);
		},
	};
}

class TaskEditorModal extends Modal {
	constructor(plugin, task, onSave) {
		super(plugin.app);
		this.plugin = plugin;
		this.task = { ...task };
		this.onSave = onSave;
	}

	onOpen() {
		const t = key => this.plugin.t(key);
		this.setTitle(t("modal.editTask"));
		this.contentEl.addClass("qt-task-editor");
		const createTextarea = (labelKey, className, value, rows) => {
			const label = this.contentEl.createEl("label", { cls: "qt-modal-field" });
			label.createSpan({ cls: "qt-field-label", text: t(labelKey) });
			const input = label.createEl("textarea", { cls: `qt-modal-input qt-task-textarea ${className}`, attr: { rows: String(rows), "aria-label": t(labelKey) } });
			input.value = value || "";
			input.addEventListener("input", () => { input.removeClass("qt-input-error"); input.setAttribute("aria-invalid", "false"); autoSize(input); });
			return input;
		};
		const title = createTextarea("modal.taskContent", "qt-task-name-input", this.task.title, 1);
		const dueField = this.contentEl.createDiv({ cls: "qt-modal-field" });
		dueField.createSpan({ cls: "qt-field-label", text: t("task.dueDate") });
		this.dueControl = createDeadlineFields(dueField, this.plugin, this.task);
		const tagsField = this.contentEl.createDiv({ cls: "qt-modal-field" });
		tagsField.createSpan({ cls: "qt-field-label", text: t("task.tags") });
		this.tagControl = createTagInput(tagsField, this.plugin, this.task.tags || [], () => {});
		const notes = createTextarea("task.notes", "qt-task-notes-input", this.task.notes, 3);
		notes.setAttribute("placeholder", t("task.notesPlaceholder"));
		const error = this.contentEl.createDiv({ cls: "qt-task-save-error", attr: { role: "alert" } });
		const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
		const cancel = actions.createEl("button", { text: t("common.cancel"), attr: { type: "button" } });
		const save = actions.createEl("button", { cls: "mod-cta", text: t("common.save"), attr: { type: "button" } });
		let submitting = false;
		const submit = async () => {
			if (submitting) return;
			const taskTitle = title.value.replace(/\s*[\r\n]+\s*/g, " ").trim();
			if (!taskTitle) { title.addClass("qt-input-error"); title.setAttribute("aria-invalid", "true"); title.focus(); return; }
			if (!this.dueControl.validate()) return;
			submitting = true;
			error.textContent = "";
			const details = { ...this.dueControl.getValue(), notes: notes.value, tags: this.tagControl.getValue() };
			const fields = [title, notes, save];
			for (const field of fields) field.disabled = true;
			this.dueControl.setDisabled(true); this.tagControl.setDisabled(true);
			try {
				const result = await this.onSave(taskTitle, details);
				if (result === false) throw new Error("Task save rejected");
				this.close();
			} catch {
				error.textContent = t("task.saveFailed");
			} finally {
				submitting = false;
				for (const field of fields) field.disabled = false;
				this.dueControl.setDisabled(false); this.tagControl.setDisabled(false);
			}
		};
		for (const input of [title, notes]) {
			input.addEventListener("keydown", event => {
				if (event.key !== "Enter" || event.isComposing || event.keyCode === 229) return;
				if (input === notes && !event.ctrlKey && !event.metaKey) return;
				event.preventDefault(); event.stopPropagation(); void submit();
			});
		}
		cancel.addEventListener("click", () => this.close());
		save.addEventListener("click", () => void submit());
		const schedule = this.contentEl.ownerDocument?.defaultView?.requestAnimationFrame?.bind(this.contentEl.ownerDocument.defaultView) || (callback => callback());
		schedule(() => { autoSize(title); autoSize(notes); title.focus(); title.select(); });
	}

	onClose() {
		this.dueControl?.destroy();
		this.tagControl?.destroy();
		this.contentEl.empty();
	}
}

module.exports = { TaskEditorModal, createDueDateControl, createDeadlineFields };
