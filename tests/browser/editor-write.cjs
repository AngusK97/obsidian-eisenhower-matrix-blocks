"use strict";

// Run against scripts/ui-preview.cjs. This uses the real renderer, editor
// writer and scroll guard with a public fake Editor. It is not an iPhone or
// real Obsidian host-lifecycle test.
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const taskId = "task-1";

async function twoFrames(page) {
	await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function setDeepPaneScroll(page) {
	return page.evaluate(() => {
		const pane = document.querySelector(".markdown-preview-view");
		const board = document.querySelector("#board");
		const boardTop = pane.scrollTop + board.getBoundingClientRect().top - pane.getBoundingClientRect().top;
		const max = pane.scrollHeight - pane.clientHeight;
		pane.scrollTop = Math.min(max, Math.max(boardTop + 360, max * 0.55));
		pane.dispatchEvent(new Event("scroll"));
		return { top: pane.scrollTop, boardTop, max };
	});
}

async function runMode(browser, width, cancelEvent) {
	const page = await browser.newPage({ viewport: { width, height: 900 } });
	const errors = [];
	page.on("pageerror", error => errors.push(error.message));
	try {
		await page.goto("http://127.0.0.1:4173/?theme=dark&lang=en");
		await page.locator(".qt-layout-select").waitFor();
		await page.locator(".qt-layout-select").selectOption("vertical");
		const enabled = await page.evaluate(() => {
			const pane = document.querySelector(".markdown-preview-view");
			pane.style.height = "580px";
			pane.style.overflowY = "auto";
			pane.style.overscrollBehavior = "contain";
			const api = window.matrixPreview.enableEditorWrites({ jumpFrames: 2 });
			return { stats: api.getStats(), diskMatchesBuffer: api.getDisk() === api.getBuffer() };
		});
		assert.equal(enabled.diskMatchesBuffer, true, `${width}px: fixture starts with matching disk and editor content`);
		assert.deepEqual(enabled.stats, {
			transactions: 0, process: 0, read: 0, hostJumps: 0, guardScrolls: 0, lastJumpTarget: null,
		});

		const initial = await setDeepPaneScroll(page);
		assert.ok(initial.max > 400 && initial.top > initial.boardTop + 100, `${width}px: fixture needs meaningful outer-pane scroll`);
		const capturedTop = await page.evaluate(id => {
			const pane = document.querySelector(".markdown-preview-view");
			document.querySelector(`.qt-task-row[data-task-id="${id}"] .qt-task-checkbox`).click();
			return pane.scrollTop;
		}, taskId);
		await page.waitForFunction(id => {
			const api = window.matrixPreview.editorWrites;
			return api.getStats().hostJumps >= 1 && api.getStats().guardScrolls >= 1 &&
				Boolean(api.getBufferData().tasks.find(task => task.id === id)?.completedAt);
		}, taskId);
		await twoFrames(page);
		const restored = await page.evaluate(id => ({
			top: document.querySelector(".markdown-preview-view").scrollTop,
			stats: window.matrixPreview.editorWrites.getStats(),
			bufferCompleted: Boolean(window.matrixPreview.editorWrites.getBufferData().tasks.find(task => task.id === id)?.completedAt),
			diskCompleted: Boolean(window.matrixPreview.editorWrites.getDiskData().tasks.find(task => task.id === id)?.completedAt),
		}), taskId);
		assert.ok(Math.abs(restored.top - capturedTop) <= 1, `${width}px: guard must restore the pane after the two-frame host jump`);
		assert.equal(restored.stats.transactions, 1);
		assert.equal(restored.stats.process, 0, `${width}px: open editor writes must bypass Vault.process`);
		assert.equal(restored.stats.read, 0);
		assert.equal(restored.bufferCompleted, true);
		assert.equal(restored.diskCompleted, false, `${width}px: fake disk intentionally remains stale until host autosave`);

		const refreshed = await page.evaluate(async id => {
			const stale = window.matrixPreview.getData();
			stale.tasks.find(task => task.id === id).completedAt = null;
			window.matrixPreview.renderer.setBoardData(stale);
			await window.matrixPreview.plugin.refreshFileRenderers("Browser fixture.md");
			return {
				completed: Boolean(window.matrixPreview.getData().tasks.find(task => task.id === id)?.completedAt),
				stats: window.matrixPreview.editorWrites.getStats(),
			};
		}, taskId);
		assert.equal(refreshed.completed, true, `${width}px: refresh must recover current buffer state, not stale disk state`);
		assert.equal(refreshed.stats.read, 0, `${width}px: refresh must not read disk while the source editor is open`);

		const beforeCancel = await setDeepPaneScroll(page);
		const guardScrollsBeforeCancel = refreshed.stats.guardScrolls;
		const cancelStart = await page.evaluate(({ id, cancelEvent }) => {
			const pane = document.querySelector(".markdown-preview-view");
			window.matrixPreview.editorWrites.cancelNextWith(cancelEvent);
			document.querySelector(`.qt-completed-row[data-task-id="${id}"] .qt-task-checkbox`).click();
			return pane.scrollTop;
		}, { id: taskId, cancelEvent });
		assert.ok(Math.abs(cancelStart - beforeCancel.top) <= 1);
		await page.waitForFunction(id => {
			const api = window.matrixPreview.editorWrites;
			return api.getStats().hostJumps >= 2 && api.getStats().transactions >= 2 &&
				api.getBufferData().tasks.find(task => task.id === id)?.completedAt === null;
		}, taskId);
		await twoFrames(page);
		const cancelled = await page.evaluate(() => ({
			top: document.querySelector(".markdown-preview-view").scrollTop,
			stats: window.matrixPreview.editorWrites.getStats(),
		}));
		assert.ok(Math.abs(cancelled.top - cancelled.stats.lastJumpTarget) <= 1,
			`${width}px: ${cancelEvent} cancellation must allow the later host scroll instead of pulling the user back`);
		assert.ok(Math.abs(cancelled.top - cancelStart) > 50, `${width}px: cancellation fixture must produce a visible scroll change`);
		assert.equal(cancelled.stats.guardScrolls, guardScrollsBeforeCancel,
			`${width}px: the cancelled guard must not issue another corrective scroll`);
		assert.equal(cancelled.stats.process, 0);
		assert.equal(cancelled.stats.read, 0);
		assert.deepEqual(errors, [], `${width}px: browser page errors`);
		console.log(`${width}px: production editor write, two-frame scroll recovery, stale-disk refresh and ${cancelEvent} cancellation passed`);
	} finally {
		await page.close();
	}
}

(async () => {
	const browser = await chromium.launch({ headless: true, executablePath: process.env.QA_BROWSER || undefined });
	try {
		await runMode(browser, 1440, "wheel");
		await runMode(browser, 390, "pointerdown");
	} finally {
		await browser.close();
	}
})().catch(error => {
	console.error(error);
	process.exitCode = 1;
});
