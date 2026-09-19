"use strict";

const { setIcon } = require("obsidian");
const { addTask } = require("./core");
const { getDueDateInfo, getDueDateTone } = require("./task-details");
const { createDeadlineFields } = require("./task-fields");
const { createTagInput, createTagChip } = require("./tag-input");

function growTextarea(input) {
	input.style.height = "auto";
	input.style.height = `${input.scrollHeight}px`;
}

function renderTaskDetails(parent, task, plugin) {
	const due = getDueDateInfo(task.dueDate, task.completedAt);
	const metadata = task.tags?.length || due ? parent.createSpan({ cls: "qt-task-meta" }) : null;
	if (task.tags?.length) {
		const tags = metadata.createSpan({ cls: "qt-task-tags", attr: { "aria-label": plugin.t("task.tags") } });
		for (const tag of task.tags) createTagChip(tags, tag);
	}
	if (due) {
		const relative = plugin.t(due.days < 0 ? "task.overdueDays" : due.days === 0 ? "task.dueToday" : "task.remainingDays", { count: Math.abs(due.days) });
		const tone = getDueDateTone(due.days, task.completedAt);
		const line = metadata.createSpan({ cls: `qt-task-due qt-due-${tone}${due.urgent ? " is-urgent" : ""}` });
		const dateUnit = line.createSpan({ cls: "qt-due-unit" });
		const icon = dateUnit.createSpan({ cls: "qt-due-icon", attr: { "aria-hidden": "true" } });
		setIcon(icon, due.urgent ? "alarm-clock" : "calendar");
		const time = dateUnit.createEl("time", { attr: { datetime: due.date + (task.dueTime ? `T${task.dueTime}` : "") } });
		time.createSpan({ text: due.date, cls: "qt-due-date" });
		// Parse the calendar components, never an implicit UTC midnight in local time.
		const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(new Date(`${due.date}T12:00:00Z`));
		time.createSpan({ text: weekday, cls: "qt-due-weekday" });
		if (task.dueTime) line.createSpan({ text: task.dueTime, cls: "qt-due-clock" });
		line.createSpan({ text: relative, cls: "qt-due-relative" });
	}
	if (task.notes) parent.createSpan({
		cls: "qt-task-notes",
		text: task.notes.replace(/\s+/g, " "),
	});
}

function renderQuickAdd(section, renderer, quadrant, quadrantName) {
	const { plugin } = renderer;
	let draft = renderer.quickAddDrafts.get(quadrant);
	if (!draft) {
		draft = { title: "", dueDate: null, dueTime: null, tags: [], notes: "", submitting: false, error: false };
		renderer.quickAddDrafts.set(quadrant, draft);
	}
	const form = section.createDiv({ cls: "qt-quick-add" });
	const title = form.createEl("textarea", {
		cls: "qt-task-textarea",
		attr: { rows: "1", placeholder: plugin.t("task.add"), "aria-label": plugin.t("task.addTo", { quadrant: quadrantName }) },
	});
	title.value = draft.title;
	const button = form.createEl("button", {
		cls: "clickable-icon qt-icon-button qt-add-button",
		attr: { type: "button", "aria-label": plugin.t("task.addTo", { quadrant: quadrantName }) },
	});
	setIcon(button, "plus");
	button.disabled = draft.submitting;
	const details = form.createDiv({ cls: "qt-quick-details" });
	const dateControl = createDeadlineFields(details, plugin, draft, (value) => { Object.assign(draft, value); });
	renderer.quickAddControls.push(dateControl);
	const notes = details.createEl("textarea", {
		cls: "qt-quick-notes qt-task-textarea",
		attr: { rows: "1", placeholder: plugin.t("task.notesPlaceholder"), "aria-label": plugin.t("task.notes") },
	});
	notes.value = draft.notes;
	const tagHost = form.createDiv({ cls: "qt-quick-tags" });
	const tagControl = createTagInput(tagHost, plugin, draft.tags, (value) => { draft.tags = value; });
	renderer.quickAddControls.push(tagControl);
	for (const [input, key] of [[title, "title"], [notes, "notes"]]) {
		input.addEventListener("input", () => {
			draft[key] = input.value;
			input.removeClass("qt-input-error");
			growTextarea(input);
		});
		if (input.value) (globalThis.requestAnimationFrame || ((callback) => callback()))(() => growTextarea(input));
	}
	if (draft.error) form.createDiv({ cls: "qt-quick-error", text: plugin.t("task.saveFailed"), attr: { role: "alert" } });
	const submit = async () => {
		if (draft.submitting) return;
		const value = title.value.replace(/\s*[\r\n]+\s*/g, " ").trim();
		if (!value) {
			title.addClass("qt-input-error");
			title.focus();
			return;
		}
		if (!dateControl.validate()) return;
		draft.submitting = true;
		button.disabled = true;
		// Capture values before awaiting persistence; edits made meanwhile belong to the next draft.
		const snapshot = { title: title.value, ...dateControl.getValue(), notes: notes.value, tags: tagControl.getValue() };
		try {
			const task = await renderer.mutate((data) => addTask(data, value, quadrant, snapshot));
			if (!task) throw new Error("Task creation did not complete");
			for (const key of ["title", "notes"]) {
				if (draft[key] === snapshot[key]) draft[key] = "";
			}
			// Date and optional time are one value: a changed time still needs its date.
			if (draft.dueDate === snapshot.dueDate && draft.dueTime === snapshot.dueTime) {
				draft.dueDate = null; draft.dueTime = null;
			}
			if (JSON.stringify(draft.tags) === JSON.stringify(snapshot.tags)) draft.tags = [];
			draft.error = false;
		} catch (error) {
			draft.error = true;
		} finally {
			draft.submitting = false;
			// Vault writes can refresh the renderer before their promise resolves.
			renderer.render();
		}
	};
	button.addEventListener("click", () => void submit());
	for (const input of [title, notes]) input.addEventListener("keydown", (event) => {
		if (event.key !== "Enter" || event.isComposing || event.keyCode === 229 || (input === notes && !event.ctrlKey && !event.metaKey)) return;
		event.preventDefault();
		event.stopPropagation();
		void submit();
	});
}

module.exports = { renderTaskDetails, renderQuickAdd };
