"use strict";

// Run against scripts/ui-preview.cjs. This replaces the actual renderer root in
// an emulated pane; it validates plugin handoff behavior, not Obsidian's host lifecycle.
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const quadrants = ["do", "schedule", "delegate", "eliminate"];
const sharedTitle = `Shared handoff draft title ${"with enough text to wrap and grow the editor ".repeat(10)}`;
const sharedNotes = `Shared handoff draft notes ${"that also span several visual lines after the host replaces the renderer root. ".repeat(10)}`;

async function seedLongBoard(page) {
	await page.evaluate(async () => {
		const fixtureQuadrants = ["do", "schedule", "delegate", "eliminate"];
		const now = new Date().toISOString();
		await window.matrixPreview.plugin.mutateBoard("Browser fixture.md", "board-browser-qa", draft => {
			for (const quadrant of fixtureQuadrants) {
				for (let index = 0; index < 24; index += 1) {
					draft.tasks.push({
						id: `handoff-${quadrant}-${index}`,
						title: `Handoff ${quadrant} task ${String(index + 1).padStart(2, "0")}`,
						quadrant,
						createdAt: now,
						completedAt: null,
						order: 100 + index,
						dueDate: null,
						dueTime: null,
						tags: [],
						notes: "",
					});
				}
			}
			for (let index = 0; index < 28; index += 1) {
				draft.tasks.push({
					id: `handoff-done-${index}`,
					title: `Handoff completed task ${String(index + 1).padStart(2, "0")}`,
					quadrant: fixtureQuadrants[index % fixtureQuadrants.length],
					createdAt: now,
					completedAt: now,
					order: index,
					dueDate: null,
					dueTime: null,
					tags: [],
					notes: "",
				});
			}
			return true;
		});
	});
	await page.waitForFunction(() => ["do", "schedule", "delegate", "eliminate"].every(quadrant =>
		document.querySelectorAll(`[data-quadrant="${quadrant}"] .qt-task-row`).length >= 24,
	));
	await page.waitForFunction(() => document.querySelectorAll(".qt-completed-row").length >= 28);
}

async function prepareHandoff(page, mode) {
	await page.locator(".qt-layout-select").selectOption(mode);
	await page.evaluate(quadrantIds => {
		const pane = document.querySelector(".markdown-preview-view");
		pane.style.height = "620px";
		pane.style.overflowY = "auto";
		pane.style.overscrollBehavior = "contain";
		pane.scrollTop = 190;
		const viewport = document.querySelector(".qt-matrix-viewport");
		if (viewport.scrollWidth > viewport.clientWidth) viewport.scrollLeft = Math.min(230, viewport.scrollWidth - viewport.clientWidth);
		for (const quadrant of quadrantIds) document.querySelector(`[data-quadrant="${quadrant}"] .qt-task-list`).scrollTop = 169;
		document.querySelector(".qt-completed-list").scrollTop = 181;
	}, quadrants);
	const schedule = page.locator('[data-quadrant="schedule"] .qt-quick-add');
	await schedule.locator(".qt-task-textarea").first().fill(sharedTitle);
	await schedule.locator(".qt-quick-notes").fill(sharedNotes);
	await schedule.locator(".qt-tag-input").fill("shared-unconfirmed-tag");
	await schedule.locator(".qt-tag-input").focus();
	await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function captureHandoffState(page) {
	return page.evaluate(quadrantIds => {
		const anchor = list => {
			const top = list.getBoundingClientRect().top;
			const row = [...list.querySelectorAll("[data-task-id]")].find(candidate => {
				const bounds = candidate.getBoundingClientRect();
				return bounds.bottom > top + 1 && bounds.top < top + list.clientHeight - 1;
			});
			if (!row) throw new Error("Handoff fixture needs a visible task anchor");
			return { id: row.getAttribute("data-task-id"), offset: row.getBoundingClientRect().top - top };
		};
		const oldRoot = document.querySelector("#board");
		const oldRenderer = window.matrixPreview.renderer;
		const drafts = oldRenderer.quickAddDrafts;
		const pane = document.querySelector(".markdown-preview-view");
		const viewport = oldRoot.querySelector(".qt-matrix-viewport");
		window.__handoffQa = { oldRoot, oldRenderer, drafts };
		return {
			anchors: Object.fromEntries(quadrantIds.map(quadrant => [quadrant, anchor(oldRoot.querySelector(`[data-quadrant="${quadrant}"] .qt-task-list`))])),
			completed: anchor(oldRoot.querySelector(".qt-completed-list")),
			viewportLeft: viewport.scrollLeft,
			paneTop: pane.scrollTop,
		};
	}, quadrants);
}

async function replaceAndAssert(page, before, mode) {
	const result = await page.evaluate(async ({ before, quadrantIds }) => {
		window.matrixPreview.replaceForWrite();
		await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
		const qa = window.__handoffQa;
		const root = document.querySelector("#board");
		const renderer = window.matrixPreview.renderer;
		const offset = (list, anchor) => {
			const row = list.querySelector(`[data-task-id="${CSS.escape(anchor.id)}"]`);
			return row ? row.getBoundingClientRect().top - list.getBoundingClientRect().top : null;
		};
		const schedule = root.querySelector('[data-quadrant="schedule"] .qt-quick-add');
		const state = {
			rootReplaced: root !== qa.oldRoot && !qa.oldRoot.isConnected,
			rendererReplaced: renderer !== qa.oldRenderer,
			draftsShared: renderer.quickAddDrafts === qa.drafts,
			listOffsets: {},
			listScrolls: {},
			completedOffset: offset(root.querySelector(".qt-completed-list"), before.completed),
			completedScroll: root.querySelector(".qt-completed-list").scrollTop,
			viewportLeft: root.querySelector(".qt-matrix-viewport").scrollLeft,
			paneTop: document.querySelector(".markdown-preview-view").scrollTop,
			title: schedule.querySelector(".qt-task-textarea").value,
			notes: schedule.querySelector(".qt-quick-notes").value,
			tagRepresented: [...schedule.querySelectorAll(".qt-tag-label")].some(label => label.textContent === "#shared-unconfirmed-tag"),
			focusMapped: document.activeElement === schedule.querySelector(".qt-tag-input"),
			activeFocus: {
				tag: document.activeElement?.tagName,
				className: document.activeElement?.className,
				label: document.activeElement?.getAttribute?.("aria-label"),
				quadrant: document.activeElement?.closest?.("[data-quadrant]")?.getAttribute("data-quadrant"),
			},
		};
		for (const quadrant of quadrantIds) {
			const list = root.querySelector(`[data-quadrant="${quadrant}"] .qt-task-list`);
			state.listOffsets[quadrant] = offset(list, before.anchors[quadrant]);
			state.listScrolls[quadrant] = list.scrollTop;
		}
		return state;
	}, { before, quadrantIds: quadrants });

	assert.ok(result.rootReplaced, `${mode}: helper must replace the code-block root`);
	assert.ok(result.rendererReplaced, `${mode}: helper must mount a new renderer`);
	assert.ok(result.draftsShared, `${mode}: replacement renderer must adopt the same draft map`);
	for (const quadrant of quadrants) {
		assert.ok(result.listScrolls[quadrant] > 0, `${mode}: ${quadrant} list must not jump to top during handoff`);
		assert.notEqual(result.listOffsets[quadrant], null, `${mode}: ${quadrant} handoff anchor must survive`);
		assert.ok(Math.abs(result.listOffsets[quadrant] - before.anchors[quadrant].offset) <= 1, `${mode}: ${quadrant} handoff anchor offset changed`);
	}
	assert.ok(result.completedScroll > 0, `${mode}: completed list must not jump to top during handoff`);
	assert.notEqual(result.completedOffset, null, `${mode}: completed handoff anchor must survive`);
	assert.ok(Math.abs(result.completedOffset - before.completed.offset) <= 1, `${mode}: completed handoff anchor offset changed`);
	assert.ok(Math.abs(result.viewportLeft - before.viewportLeft) <= 1, `${mode}: grid scrollLeft changed during handoff`);
	assert.ok(Math.abs(result.paneTop - before.paneTop) <= 1, `${mode}: outer pane scroll changed during handoff`);
	assert.equal(result.title, sharedTitle);
	assert.equal(result.notes, sharedNotes);
	assert.ok(result.tagRepresented, `${mode}: shared tag draft must survive as semantic draft state`);
	return result;
}

async function assertSubmittingUnlock(page, mode) {
	const title = `Handoff pending save (${mode})`;
	await page.locator('[data-quadrant="do"] .qt-task-textarea').first().fill(title);
	await page.locator('[data-quadrant="do"] .qt-quick-notes').fill("Pending notes shared with replacement");
	await page.locator('[data-quadrant="do"] .qt-tag-input').fill("pending-shared-tag");
	await page.evaluate(() => {
		const plugin = window.matrixPreview.plugin;
		const original = plugin.mutateBoard;
		window.__pendingOldRenderer = window.matrixPreview.renderer;
		window.__pendingDrafts = window.matrixPreview.renderer.quickAddDrafts;
		plugin.mutateBoard = async (...args) => {
			const outcome = await original(...args);
			window.matrixPreview.replaceForWrite();
			await new Promise(resolve => { window.__releasePendingWrite = resolve; });
			plugin.mutateBoard = original;
			return outcome;
		};
		document.querySelector('[data-quadrant="do"] .qt-add-button').click();
	});
	await page.waitForFunction(() => window.matrixPreview.renderer !== window.__pendingOldRenderer && typeof window.__releasePendingWrite === "function");
	const pending = await page.evaluate(() => {
		const form = document.querySelector('[data-quadrant="do"] .qt-quick-add');
		return {
			draftsShared: window.matrixPreview.renderer.quickAddDrafts === window.__pendingDrafts,
			submitting: window.matrixPreview.renderer.quickAddDrafts.get("do").submitting,
			disabled: form.querySelector(".qt-add-button").disabled,
			title: form.querySelector(".qt-task-textarea").value,
			notes: form.querySelector(".qt-quick-notes").value,
			tagRepresented: [...form.querySelectorAll(".qt-tag-label")].some(label => label.textContent === "#pending-shared-tag"),
		};
	});
	assert.ok(pending.draftsShared, `${mode}: in-flight replacement must share the draft map`);
	assert.ok(pending.submitting && pending.disabled, `${mode}: replacement add button remains locked while write is pending`);
	assert.equal(pending.title, title);
	assert.equal(pending.notes, "Pending notes shared with replacement");
	assert.ok(pending.tagRepresented, `${mode}: pending tag draft must be available in replacement form`);

	await page.evaluate(() => window.__releasePendingWrite());
	await page.waitForFunction(() => {
		const form = document.querySelector('[data-quadrant="do"] .qt-quick-add');
		return !form.querySelector(".qt-add-button").disabled && !window.matrixPreview.renderer.quickAddDrafts.get("do").submitting;
	});
	assert.equal(await page.locator('[data-quadrant="do"] .qt-task-textarea').first().inputValue(), "", `${mode}: settled write clears submitted title`);
	assert.equal(await page.evaluate(title => window.matrixPreview.getData().tasks.some(task => task.title === title), title), true);
}

async function assertNewDraftWinsAfterOldWrite(page, mode) {
	const submittedTitle = `Older in-flight submission (${mode})`;
	const replacementTitle = `New draft typed after replacement (${mode})`;
	const replacementNotes = `New notes typed while the old renderer still awaits (${mode})`;
	const replacementTag = `new-pending-${mode}`;
	const form = page.locator('[data-quadrant="do"] .qt-quick-add');
	await form.locator(".qt-task-textarea").first().fill(submittedTitle);
	await form.locator(".qt-quick-notes").fill("Older submitted notes");
	await form.locator(".qt-tag-input").fill("older-submitted-tag");
	await page.evaluate(() => {
		const plugin = window.matrixPreview.plugin;
		const original = plugin.mutateBoard;
		window.__pendingOldRenderer = window.matrixPreview.renderer;
		plugin.mutateBoard = async (...args) => {
			const outcome = await original(...args);
			window.matrixPreview.replaceForWrite();
			await new Promise(resolve => { window.__releasePendingWrite = resolve; });
			plugin.mutateBoard = original;
			return outcome;
		};
		document.querySelector('[data-quadrant="do"] .qt-add-button').click();
	});
	await page.waitForFunction(() => window.matrixPreview.renderer !== window.__pendingOldRenderer && typeof window.__releasePendingWrite === "function");

	const replacement = page.locator('[data-quadrant="do"] .qt-quick-add');
	await replacement.locator(".qt-task-textarea").first().fill(replacementTitle);
	await replacement.locator(".qt-quick-notes").fill(replacementNotes);
	await replacement.locator(".qt-tag-input").fill(replacementTag);
	await replacement.locator(".qt-native-date").fill("2030-12-31");
	await replacement.locator(".qt-native-date").dispatchEvent("change");
	if (mode === "vertical") {
		await replacement.locator(".qt-due-time").focus();
		await replacement.locator(".qt-due-time").press("ArrowUp");
		assert.ok(await replacement.locator(".qt-due-time").evaluate(input => input.value === "" && input.validity.badInput),
			`${mode}: fixture must establish a real native partial-time state before the older write settles`);
		const deferred = await page.evaluate(() => {
			const renderer = window.matrixPreview.renderer;
			const root = document.querySelector("#board");
			const form = root.querySelector('[data-quadrant="do"] .qt-quick-add');
			const input = form.querySelector(".qt-due-time");
			renderer.render();
			return {
				rootSame: document.querySelector("#board") === root,
				formSame: document.querySelector('[data-quadrant="do"] .qt-quick-add') === form,
				inputSame: document.querySelector('[data-quadrant="do"] .qt-due-time') === input,
				pending: renderer.pendingRender,
			};
		});
		assert.deepEqual(deferred, { rootSame: true, formSame: true, inputSame: true, pending: true },
			`${mode}: a real native badInput must defer full render without replacing live editor nodes`);
	}

	await page.evaluate(() => window.__releasePendingWrite());
	await page.waitForFunction(() => {
		const current = document.querySelector('[data-quadrant="do"] .qt-quick-add');
		return !current.querySelector(".qt-add-button").disabled && !window.matrixPreview.renderer.quickAddDrafts.get("do").submitting;
	});
	assert.equal(await replacement.locator(".qt-task-textarea").first().inputValue(), replacementTitle,
		`${mode}: older completion must not clear the replacement title draft`);
	assert.equal(await replacement.locator(".qt-quick-notes").inputValue(), replacementNotes,
		`${mode}: older completion must not clear replacement notes`);
	assert.equal(await replacement.locator(".qt-tag-input").inputValue(), replacementTag,
		`${mode}: older completion must not confirm or clear the new raw tag`);
	assert.equal(await replacement.locator(".qt-native-date").inputValue(), "2030-12-31");
	if (mode === "vertical") {
		assert.ok(await replacement.locator(".qt-due-time").evaluate(input => input.value === "" && input.validity.badInput),
			`${mode}: older completion must not replace a live partial native time`);
		assert.equal(await replacement.locator(".qt-clear-time").isVisible(), true, `${mode}: partial time remains clearable`);
	}
	assert.equal(await page.evaluate(({ submittedTitle, replacementTitle }) => {
		const titles = window.matrixPreview.getData().tasks.map(task => task.title);
		return titles.includes(submittedTitle) && !titles.includes(replacementTitle);
	}, { submittedTitle, replacementTitle }), true, `${mode}: only the older submitted snapshot is persisted`);
	if (mode === "vertical") {
		await replacement.locator(".qt-clear-time").click();
		await replacement.locator(".qt-due-time").dispatchEvent("input");
		await page.waitForFunction(() => !window.matrixPreview.renderer.pendingRender);
	}
}

async function assertKeyboardCheckboxFocus(page, mode) {
	const taskId = "handoff-do-19";
	let checkbox = page.locator(`.qt-task-row[data-task-id="${taskId}"] .qt-task-checkbox`);
	await checkbox.focus();
	await checkbox.press("Space");
	await page.waitForFunction(taskId => Boolean(window.matrixPreview.getData().tasks.find(task => task.id === taskId)?.completedAt), taskId);
	const completedFocused = await page.evaluate(taskId =>
		document.activeElement === document.querySelector(`.qt-completed-row[data-task-id="${taskId}"] .qt-task-checkbox`), taskId);

	checkbox = page.locator(`.qt-completed-row[data-task-id="${taskId}"] .qt-task-checkbox`);
	await checkbox.press("Space");
	await page.waitForFunction(taskId => window.matrixPreview.getData().tasks.find(task => task.id === taskId)?.completedAt === null, taskId);
	const activeFocused = await page.evaluate(taskId =>
		document.activeElement === document.querySelector(`.qt-task-row[data-task-id="${taskId}"] .qt-task-checkbox`), taskId);
	return { completedFocused, activeFocused };
}

async function runMode(browser, width, mode) {
	const page = await browser.newPage({ viewport: { width, height: mode === "grid" ? 844 : 1000 } });
	const errors = [];
	page.on("pageerror", error => errors.push(error.message));
	try {
		await page.goto("http://127.0.0.1:4173/?theme=dark&lang=en");
		await page.locator(".qt-layout-select").waitFor();
		await seedLongBoard(page);
		await prepareHandoff(page, mode);
		const before = await captureHandoffState(page);
		const handoff = await replaceAndAssert(page, before, mode);
		await assertSubmittingUnlock(page, mode);
		await assertNewDraftWinsAfterOldWrite(page, mode);
		const keyboard = await assertKeyboardCheckboxFocus(page, mode);
		assert.deepEqual(errors, [], `${mode}: browser page errors`);
		const focusRegressions = [];
		if (!handoff.focusMapped) focusRegressions.push(`handoff focus stayed at ${JSON.stringify(handoff.activeFocus)}`);
		if (!keyboard.completedFocused) focusRegressions.push("keyboard completion did not focus moved completed checkbox");
		if (!keyboard.activeFocused) focusRegressions.push("keyboard restore did not focus moved active checkbox");
		assert.deepEqual(focusRegressions, [], `${mode}: focus continuity regressions`);
		console.log(`${width}px ${mode}: simulated host handoff, shared pending drafts and keyboard checkbox focus passed`);
	} finally {
		await page.close();
	}
}

(async () => {
	const browser = await chromium.launch({ headless: true, executablePath: process.env.QA_BROWSER || undefined });
	try {
		await runMode(browser, 1440, "vertical");
		await runMode(browser, 390, "grid");
	} finally {
		await browser.close();
	}
})().catch(error => {
	console.error(error);
	process.exitCode = 1;
});
