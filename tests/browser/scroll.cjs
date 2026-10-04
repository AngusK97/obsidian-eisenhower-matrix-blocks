"use strict";

// Actual-renderer scroll continuity QA. Run against scripts/ui-preview.cjs.
// Drag cases call finishDrag(true) after installing a real renderer drag target;
// they cover the drag commit/render path, not mouse/touch gesture recognition.
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const quadrants = ["do", "schedule", "delegate", "eliminate"];

async function seedLongBoard(page) {
	await page.evaluate(async () => {
		const now = new Date();
		const createdAt = now.toISOString();
		const completedAt = createdAt;
		const fixtureQuadrants = ["do", "schedule", "delegate", "eliminate"];
		await window.matrixPreview.plugin.mutateBoard("Browser fixture.md", "board-browser-qa", (draft) => {
			for (const quadrant of fixtureQuadrants) {
				for (let index = 0; index < 28; index += 1) {
					draft.tasks.push({
						id: `scroll-${quadrant}-${index}`,
						title: `Scroll QA ${quadrant} task ${String(index + 1).padStart(2, "0")}`,
						quadrant,
						createdAt,
						completedAt: null,
						order: 100 + index,
						dueDate: null,
						dueTime: null,
						tags: [],
						notes: "",
					});
				}
			}
			for (let index = 0; index < 32; index += 1) {
				draft.tasks.push({
					id: `scroll-done-${index}`,
					title: `Scroll QA completed task ${String(index + 1).padStart(2, "0")}`,
					quadrant: fixtureQuadrants[index % fixtureQuadrants.length],
					createdAt,
					completedAt,
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
		document.querySelectorAll(`[data-quadrant="${quadrant}"] .qt-task-row`).length >= 28,
	));
	await page.waitForFunction(() => document.querySelectorAll(".qt-completed-row").length >= 32);
}

async function prepareContinuityState(page, mode) {
	await page.locator(".qt-layout-select").selectOption(mode);
	await page.evaluate((quadrantIds) => {
		const pane = document.querySelector(".markdown-preview-view");
		pane.style.height = "620px";
		pane.style.overflowY = "auto";
		pane.style.overscrollBehavior = "contain";
		pane.scrollTop = 180;

		const viewport = document.querySelector(".qt-matrix-viewport");
		if (viewport.scrollWidth > viewport.clientWidth) {
			viewport.scrollLeft = Math.min(240, viewport.scrollWidth - viewport.clientWidth);
		}
		const quickForms = {};
		const lists = {};
		for (const quadrant of quadrantIds) {
			const section = document.querySelector(`[data-quadrant="${quadrant}"]`);
			quickForms[quadrant] = section.querySelector(".qt-quick-add");
			lists[quadrant] = section.querySelector(".qt-task-list");
			lists[quadrant].scrollTop = 173;
		}
		const completed = document.querySelector(".qt-completed-list");
		completed.scrollTop = 187;
		const scheduleTag = quickForms.schedule.querySelector(".qt-tag-input");
		scheduleTag.value = "unconfirmed-scroll-tag";
		scheduleTag.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: "g" }));
		scheduleTag.focus();
		window.__scrollQa = { pane, viewport, quickForms, lists, completed, scheduleTag };
	}, quadrants);

	assert.equal(await page.locator('[data-quadrant="schedule"] .qt-tag-input').inputValue(), "unconfirmed-scroll-tag");
	assert.ok(await page.evaluate(() => [
		...Object.values(window.__scrollQa.lists).map(list => list.scrollTop),
		window.__scrollQa.completed.scrollTop,
		window.__scrollQa.pane.scrollTop,
	].every(value => value > 0)), "fixture must start with every tested vertical scroller away from its top");
	if (mode === "grid") {
		assert.ok(await page.evaluate(() => window.__scrollQa.viewport.scrollLeft > 0), "narrow grid must start horizontally scrolled");
	}
}

async function captureState(page) {
	return page.evaluate((quadrantIds) => {
		const qa = window.__scrollQa;
		const anchor = (list, name) => {
			const listTop = list.getBoundingClientRect().top;
			const rows = [...list.querySelectorAll(".qt-task-row, .qt-completed-row")];
			const row = rows.find(candidate => {
				const offset = candidate.getBoundingClientRect().top - listTop;
				return offset + candidate.getBoundingClientRect().height > 1 && offset < list.clientHeight - 1;
			});
			if (!row) throw new Error(`Expected a visible task anchor in ${name} (${rows.length} rows, scrollTop ${list.scrollTop}, clientHeight ${list.clientHeight})`);
			const taskId = row.getAttribute("data-task-id");
			return {
				key: taskId || row.querySelector(".qt-completed-title")?.textContent,
				byId: Boolean(taskId),
				offset: row.getBoundingClientRect().top - listTop,
			};
		};
		return {
			anchors: Object.fromEntries(quadrantIds.map(quadrant => [quadrant, anchor(qa.lists[quadrant], quadrant)])),
			completedAnchor: anchor(qa.completed, "completed"),
			viewportLeft: qa.viewport.scrollLeft,
			paneTop: qa.pane.scrollTop,
		};
	}, quadrants);
}

async function assertContinuity(page, before, label) {
	const result = await page.evaluate(({ before, quadrantIds }) => {
		const qa = window.__scrollQa;
		const offset = (list, anchor) => {
			const row = anchor.byId
				? list.querySelector(`[data-task-id="${CSS.escape(anchor.key)}"]`)
				: [...list.querySelectorAll(".qt-completed-row")].find(candidate => candidate.querySelector(".qt-completed-title")?.textContent === anchor.key);
			return row ? row.getBoundingClientRect().top - list.getBoundingClientRect().top : null;
		};
		return {
			stableViewport: document.querySelector(".qt-matrix-viewport") === qa.viewport,
			stableCompleted: document.querySelector(".qt-completed-list") === qa.completed,
			stableForms: quadrantIds.every(quadrant => document.querySelector(`[data-quadrant="${quadrant}"] .qt-quick-add`) === qa.quickForms[quadrant]),
			stableLists: quadrantIds.every(quadrant => document.querySelector(`[data-quadrant="${quadrant}"] .qt-task-list`) === qa.lists[quadrant]),
			focusedDraft: document.activeElement === qa.scheduleTag,
			draftValue: qa.scheduleTag.value,
			listOffsets: Object.fromEntries(quadrantIds.map(quadrant => [quadrant, offset(qa.lists[quadrant], before.anchors[quadrant])])),
			listScrolls: Object.fromEntries(quadrantIds.map(quadrant => [quadrant, qa.lists[quadrant].scrollTop])),
			completedOffset: offset(qa.completed, before.completedAnchor),
			completedScroll: qa.completed.scrollTop,
			viewportLeft: qa.viewport.scrollLeft,
			paneTop: qa.pane.scrollTop,
		};
	}, { before, quadrantIds: quadrants });

	assert.ok(result.stableViewport, `${label}: matrix viewport DOM must remain stable`);
	assert.ok(result.stableForms, `${label}: quick-add form DOM must remain stable`);
	assert.ok(result.stableLists, `${label}: quadrant list DOM must remain stable`);
	assert.ok(result.stableCompleted, `${label}: completed list DOM must remain stable`);
	assert.ok(result.focusedDraft, `${label}: focused input must remain focused`);
	assert.equal(result.draftValue, "unconfirmed-scroll-tag", `${label}: unconfirmed tag text must remain in the input`);
	for (const quadrant of quadrants) {
		assert.ok(result.listScrolls[quadrant] > 0, `${label}: ${quadrant} list must not jump to top`);
		assert.notEqual(result.listOffsets[quadrant], null, `${label}: ${quadrant} visible anchor must remain rendered`);
		assert.ok(Math.abs(result.listOffsets[quadrant] - before.anchors[quadrant].offset) <= 1,
			`${label}: ${quadrant} visible anchor offset changed (${before.anchors[quadrant].offset} -> ${result.listOffsets[quadrant]})`);
	}
	assert.ok(result.completedScroll > 0, `${label}: completed list must not jump to top`);
	assert.notEqual(result.completedOffset, null, `${label}: completed visible anchor must remain rendered`);
	assert.ok(Math.abs(result.completedOffset - before.completedAnchor.offset) <= 1,
		`${label}: completed visible anchor offset changed (${before.completedAnchor.offset} -> ${result.completedOffset})`);
	assert.ok(Math.abs(result.viewportLeft - before.viewportLeft) <= 1, `${label}: matrix grid horizontal scroll changed`);
	assert.ok(Math.abs(result.paneTop - before.paneTop) <= 1, `${label}: outer note pane scroll changed`);
}

async function addAtTop(page, mode) {
	await page.locator('[data-quadrant="do"] .qt-task-textarea').first().fill(`Added without jumping (${mode})`);
	await page.locator('[data-quadrant="schedule"] .qt-tag-input').focus();
	const before = await captureState(page);
	await page.evaluate(() => document.querySelector('[data-quadrant="do"] .qt-add-button').click());
	await page.waitForFunction(title => window.matrixPreview.getData().tasks.some(task => task.title === title), `Added without jumping (${mode})`);
	await assertContinuity(page, before, `${mode} add-at-top`);
	assert.equal(await page.locator('[data-quadrant="do"] .qt-task-textarea').first().inputValue(), "", `${mode}: submitted title must clear`);
}

async function commitDrag(page, sourceId, targetId, targetQuadrant, placement) {
	await page.evaluate(({ sourceId, targetId, targetQuadrant, placement }) => {
		const renderer = window.matrixPreview.renderer;
		const source = document.querySelector(`[data-task-id="${sourceId}"]`);
		const target = document.querySelector(`[data-task-id="${targetId}"]`);
		renderer.beginDrag(sourceId, source, "mouse");
		renderer.dragTarget = { quadrant: targetQuadrant, taskId: targetId, placement, element: target };
		renderer.finishDrag(true);
	}, { sourceId, targetId, targetQuadrant, placement });
}

async function reorderWithinQuadrant(page, mode) {
	const sourceId = "scroll-do-27";
	const targetId = "scroll-do-25";
	const before = await captureState(page);
	await commitDrag(page, sourceId, targetId, "do", "before");
	await page.waitForFunction(({ sourceId, targetId }) => {
		const tasks = window.matrixPreview.getData().tasks.filter(task => task.quadrant === "do" && !task.completedAt).sort((a, b) => a.order - b.order);
		return tasks.findIndex(task => task.id === sourceId) === tasks.findIndex(task => task.id === targetId) - 1;
	}, { sourceId, targetId });
	await assertContinuity(page, before, `${mode} same-quadrant drag commit`);
}

async function moveAcrossQuadrants(page, mode) {
	const sourceId = "scroll-delegate-27";
	const targetId = "scroll-schedule-27";
	const before = await captureState(page);
	await commitDrag(page, sourceId, targetId, "schedule", "after");
	await page.waitForFunction(sourceId => window.matrixPreview.getData().tasks.find(task => task.id === sourceId)?.quadrant === "schedule", sourceId);
	await assertContinuity(page, before, `${mode} cross-quadrant drag commit`);
}

async function completeAndRestore(page, mode) {
	const taskId = "scroll-eliminate-27";
	let before = await captureState(page);
	await page.evaluate(taskId => document.querySelector(`[data-task-id="${taskId}"] .qt-task-checkbox`).click(), taskId);
	await page.waitForFunction(taskId => Boolean(window.matrixPreview.getData().tasks.find(task => task.id === taskId)?.completedAt), taskId);
	await assertContinuity(page, before, `${mode} complete`);

	before = await captureState(page);
	await page.evaluate(taskId => {
		const row = document.querySelector(`.qt-completed-row[data-task-id="${taskId}"]`);
		if (!row) throw new Error("Completed task must be available for restore");
		row.querySelector(".qt-task-checkbox").click();
	}, taskId);
	await page.waitForFunction(taskId => window.matrixPreview.getData().tasks.find(task => task.id === taskId)?.completedAt === null, taskId);
	await assertContinuity(page, before, `${mode} restore`);
}

async function deleteVisibleAnchor(page, mode) {
	const deletion = await page.evaluate(() => {
		const list = window.__scrollQa.lists.do;
		const top = list.getBoundingClientRect().top;
		const visible = [...list.querySelectorAll(".qt-task-row")].filter(row => {
			const bounds = row.getBoundingClientRect();
			return bounds.bottom > top + 1 && bounds.top < top + list.clientHeight - 1;
		});
		if (visible.length < 2) throw new Error("Deletion fallback needs two visible task anchors");
		return {
			deleteId: visible[0].getAttribute("data-task-id"),
			fallback: {
				key: visible[1].getAttribute("data-task-id"),
				byId: true,
				offset: visible[1].getBoundingClientRect().top - top,
			},
		};
	});
	const before = await captureState(page);
	// The primary visible row is intentionally removed. Its next visible sibling
	// must become the restoration anchor instead of letting the list jump.
	before.anchors.do = deletion.fallback;
	await page.evaluate(async taskId => { await window.matrixPreview.renderer.remove(taskId); }, deletion.deleteId);
	await page.waitForFunction(taskId => !window.matrixPreview.getData().tasks.some(task => task.id === taskId), deletion.deleteId);
	await assertContinuity(page, before, `${mode} deleted-anchor fallback`);
}

async function recoverFailedDraft(page, mode) {
	const form = page.locator('[data-quadrant="do"] .qt-quick-add');
	const title = `Failed draft (${mode})`;
	const notes = `Notes kept after rejected save (${mode})`;
	const tag = `unconfirmed-failure-${mode}`;
	await form.locator(".qt-task-textarea").first().fill(title);
	await form.locator(".qt-quick-notes").fill(notes);
	await form.locator(".qt-tag-input").fill(tag);
	await page.locator('[data-quadrant="schedule"] .qt-tag-input').focus();
	const before = await captureState(page);
	await page.evaluate(() => {
		window.matrixPreview.failNextSave();
		document.querySelector('[data-quadrant="do"] .qt-add-button').click();
	});
	await form.locator(".qt-quick-error").waitFor();
	await assertContinuity(page, before, `${mode} rejected-save draft recovery`);
	assert.equal(await form.locator(".qt-task-textarea").first().inputValue(), title);
	assert.equal(await form.locator(".qt-quick-notes").inputValue(), notes);
	assert.equal(await form.locator(".qt-tag-input").inputValue(), tag, `${mode}: rejected save must retain raw unconfirmed tag text`);
	assert.equal(await page.evaluate(title => window.matrixPreview.getData().tasks.some(task => task.title === title), title), false,
		`${mode}: rejected save must not mutate board data`);
}

async function fullRenderPreservesView(page, mode) {
	const before = await captureState(page);
	const result = await page.evaluate(({ before, quadrantIds }) => {
		window.matrixPreview.renderer.render();
		const pane = document.querySelector(".markdown-preview-view");
		const viewport = document.querySelector(".qt-matrix-viewport");
		const quickForms = {};
		const lists = {};
		for (const quadrant of quadrantIds) {
			const section = document.querySelector(`[data-quadrant="${quadrant}"]`);
			quickForms[quadrant] = section.querySelector(".qt-quick-add");
			lists[quadrant] = section.querySelector(".qt-task-list");
		}
		const completed = document.querySelector(".qt-completed-list");
		const scheduleTag = quickForms.schedule.querySelector(".qt-tag-input");
		const offset = (list, anchor) => {
			const row = anchor.byId
				? list.querySelector(`[data-task-id="${CSS.escape(anchor.key)}"]`)
				: [...list.querySelectorAll(".qt-completed-row")].find(candidate => candidate.querySelector(".qt-completed-title")?.textContent === anchor.key);
			return row ? row.getBoundingClientRect().top - list.getBoundingClientRect().top : null;
		};
		const state = {
			listOffsets: Object.fromEntries(quadrantIds.map(quadrant => [quadrant, offset(lists[quadrant], before.anchors[quadrant])])),
			listScrolls: Object.fromEntries(quadrantIds.map(quadrant => [quadrant, lists[quadrant].scrollTop])),
			completedOffset: offset(completed, before.completedAnchor),
			completedScroll: completed.scrollTop,
			viewportLeft: viewport.scrollLeft,
			paneTop: pane.scrollTop,
			focusMapped: document.activeElement === scheduleTag,
			semanticDraftTag: [...quickForms.schedule.querySelectorAll(".qt-tag-label")].some(label => label.textContent === "#unconfirmed-scroll-tag"),
		};
		window.__scrollQa = { pane, viewport, quickForms, lists, completed, scheduleTag };
		return state;
	}, { before, quadrantIds: quadrants });

	for (const quadrant of quadrants) {
		assert.ok(result.listScrolls[quadrant] > 0, `${mode} full render: ${quadrant} list must not jump to top`);
		assert.notEqual(result.listOffsets[quadrant], null, `${mode} full render: ${quadrant} anchor must remain rendered`);
		assert.ok(Math.abs(result.listOffsets[quadrant] - before.anchors[quadrant].offset) <= 1,
			`${mode} full render: ${quadrant} visible anchor offset changed`);
	}
	assert.ok(result.completedScroll > 0, `${mode} full render: completed list must not jump to top`);
	assert.notEqual(result.completedOffset, null, `${mode} full render: completed anchor must remain rendered`);
	assert.ok(Math.abs(result.completedOffset - before.completedAnchor.offset) <= 1, `${mode} full render: completed anchor offset changed`);
	assert.ok(Math.abs(result.viewportLeft - before.viewportLeft) <= 1, `${mode} full render: horizontal grid scroll changed`);
	assert.ok(Math.abs(result.paneTop - before.paneTop) <= 1, `${mode} full render: outer pane scroll changed`);
	assert.ok(result.focusMapped, `${mode} full render: focus must map back to the corresponding input`);
	assert.ok(result.semanticDraftTag, `${mode} full render: draft tag must remain represented after rebuilding controls`);
}

async function refreshSameData(page, mode) {
	const before = await captureState(page);
	await page.evaluate(() => {
		const renderer = window.matrixPreview.renderer;
		renderer.setBoardData(JSON.parse(JSON.stringify(renderer.data)), renderer.boardTitle, JSON.parse(JSON.stringify(renderer.quadrantLabels)));
	});
	await assertContinuity(page, before, `${mode} same-data setBoardData`);
}

async function runMode(browser, width, mode) {
	const page = await browser.newPage({ viewport: { width, height: mode === "grid" ? 844 : 1000 }, isMobile: width < 500, hasTouch: width < 500 });
	const errors = [];
	page.on("pageerror", error => errors.push(error.message));
	try {
		await page.goto("http://127.0.0.1:4173/?theme=dark&lang=en");
		await page.locator(".qt-layout-select").waitFor();
		await seedLongBoard(page);
		await prepareContinuityState(page, mode);
		await addAtTop(page, mode);
		await reorderWithinQuadrant(page, mode);
		await moveAcrossQuadrants(page, mode);
		await completeAndRestore(page, mode);
		await deleteVisibleAnchor(page, mode);
		await refreshSameData(page, mode);
		await recoverFailedDraft(page, mode);
		await fullRenderPreservesView(page, mode);
		assert.deepEqual(errors, [], `${mode}: browser page errors`);
		console.log(`${width}px ${mode}: stable DOM, focus/draft, inner/grid/completed/pane scroll continuity passed`);
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
