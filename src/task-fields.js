"use strict";

const { Modal, setIcon } = require("obsidian");
const { normalizeDueDate } = require("./task-details");

function localDateString(date) {
	return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function autoSize(textarea) {
	textarea.style.height = "auto";
	textarea.style.height = `${textarea.scrollHeight}px`;
}

/** A native calendar field with explicit, cross-platform relative-date shortcuts. */
function createDueDateControl(parent, plugin, initialValue, onChange) {
	let value = normalizeDueDate(initialValue);
	let popup = null;
	let cleanup = () => {};
	const doc = parent.ownerDocument;
	const button = parent.createEl("button", {
		cls: "qt-due-picker", attr: { type: "button", "aria-haspopup": "dialog", "aria-expanded": "false" },
	});
	const icon = button.createSpan({ cls: "qt-date-icon" });
	setIcon(icon, "calendar-days");
	const label = button.createSpan({ cls: "qt-date-label" });
	const setValue = nextValue => {
		value = normalizeDueDate(nextValue);
		label.textContent = value || plugin.t("task.noDueDate");
		button.setAttribute("aria-label", `${plugin.t("task.dueDate")}: ${label.textContent}`);
		button.setAttribute("title", `${plugin.t("task.dueDate")}: ${label.textContent}`);
	};
	const close = (restoreFocus = false) => {
		if (!popup) return;
		cleanup();
		popup.remove();
		popup = null;
		button.setAttribute("aria-expanded", "false");
		if (restoreFocus) button.focus();
	};
	const choose = nextValue => {
		setValue(nextValue);
		close(true);
		onChange(value);
	};
	const open = () => {
		if (popup) { close(true); return; }
		if (!doc) return;
		// Keep the popup within Obsidian's modal focus scope when editing a task.
		const host = parent.closest(".modal") || doc.body;
		popup = host.createDiv({ cls: "qt-date-popover", attr: { role: "dialog", "aria-label": plugin.t("task.dueDate") } });
		popup.createDiv({ cls: "qt-date-heading", text: plugin.t("task.dueDate") });
		const input = popup.createEl("input", {
			cls: "qt-date-input", attr: { type: "date", "aria-label": plugin.t("task.dueDate"), min: "0001-01-01", max: "9999-12-31" },
		});
		input.value = value || "";
		// Native segmented inputs emit change while the year is still being typed.
		// Commit only on explicit confirmation, not on those intermediate values.
		const applyDate = () => {
			if (input.validity?.badInput || (input.value && !normalizeDueDate(input.value))) {
				input.setAttribute("aria-invalid", "true");
				input.reportValidity?.();
				return;
			}
			choose(input.value);
		};
		input.addEventListener("input", () => input.setAttribute("aria-invalid", "false"));
		input.addEventListener("keydown", event => {
			if (event.key !== "Enter" || event.isComposing || event.keyCode === 229) return;
			event.preventDefault(); event.stopPropagation(); applyDate();
		});
		const apply = popup.createEl("button", {
			cls: "qt-date-apply mod-cta", text: plugin.t("task.applyDate"), attr: { type: "button" },
		});
		apply.addEventListener("click", applyDate);
		const shortcuts = popup.createDiv({ cls: "qt-date-shortcuts" });
		for (const [key, offset] of [["today", 0], ["tomorrow", 1], ["clearDate", null]]) {
			const shortcut = shortcuts.createEl("button", {
				cls: offset === null ? "qt-date-clear" : `qt-date-${key}`,
				text: plugin.t(`task.${key}`), attr: { type: "button" },
			});
			shortcut.addEventListener("click", () => {
				if (offset === null) { choose(null); return; }
				const date = new Date(); date.setDate(date.getDate() + offset);
				choose(localDateString(date));
			});
		}
		button.setAttribute("aria-expanded", "true");
		const view = doc.defaultView;
		const viewport = view.visualViewport;
		const position = () => {
			if (!popup) return;
			const left = viewport?.offsetLeft || 0;
			const top = viewport?.offsetTop || 0;
			const width = viewport?.width || view.innerWidth;
			const height = viewport?.height || view.innerHeight;
			popup.style.maxWidth = `${Math.max(0, width - 16)}px`;
			popup.style.maxHeight = `${Math.max(0, height - 16)}px`;
			popup.style.overflowY = "auto";
			const anchor = button.getBoundingClientRect();
			const bounds = popup.getBoundingClientRect();
			popup.style.left = `${Math.max(left + 8, Math.min(anchor.left, left + width - bounds.width - 8))}px`;
			const preferredTop = anchor.bottom + 6 + bounds.height <= top + height - 8 ? anchor.bottom + 6 : anchor.top - bounds.height - 6;
			popup.style.top = `${Math.max(top + 8, Math.min(preferredTop, top + height - bounds.height - 8))}px`;
		};
		position();
		const onPointerDown = event => { if (!popup.contains(event.target) && !button.contains(event.target)) close(); };
		const onFocus = event => { if (!popup.contains(event.target) && !button.contains(event.target)) close(); };
		const onKeyDown = event => {
			if (event.key !== "Escape") return;
			event.preventDefault(); event.stopPropagation(); close(true);
		};
		doc.addEventListener("pointerdown", onPointerDown, true);
		doc.addEventListener("keydown", onKeyDown, true);
		doc.addEventListener("focusin", onFocus);
		doc.addEventListener("scroll", position, true);
		view.addEventListener("resize", position);
		viewport?.addEventListener("resize", position);
		viewport?.addEventListener("scroll", position);
		cleanup = () => {
			doc.removeEventListener("pointerdown", onPointerDown, true);
			doc.removeEventListener("keydown", onKeyDown, true);
			doc.removeEventListener("focusin", onFocus);
			doc.removeEventListener("scroll", position, true);
			view.removeEventListener("resize", position);
			viewport?.removeEventListener("resize", position);
			viewport?.removeEventListener("scroll", position);
		};
		input.focus();
	};
	button.addEventListener("click", open);
	setValue(value);
	return { getValue: () => value, setValue, destroy: () => { close(); button.removeEventListener("click", open); } };
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
		this.dueControl = createDueDateControl(dueField, this.plugin, this.task.dueDate, () => {});
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
			submitting = true;
			error.textContent = "";
			const fields = [title, notes, dueField.querySelector("button"), save];
			for (const field of fields) field.disabled = true;
			try {
				const result = await this.onSave(taskTitle, { dueDate: this.dueControl.getValue(), notes: notes.value });
				if (result === false) throw new Error("Task save rejected");
				this.close();
			} catch {
				error.textContent = t("task.saveFailed");
			} finally {
				submitting = false;
				for (const field of fields) field.disabled = false;
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
		this.contentEl.empty();
	}
}

module.exports = { TaskEditorModal, createDueDateControl };
