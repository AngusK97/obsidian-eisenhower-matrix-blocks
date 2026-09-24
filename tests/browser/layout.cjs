"use strict";

// Run against scripts/ui-preview.cjs, using only its synthetic task fixture.
const assert = require("node:assert/strict");
const { mkdir } = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
	const output = process.env.QA_OUTPUT || path.join(require("node:os").tmpdir(), "matrix-qa");
	await mkdir(output, { recursive: true });
	const browser = await chromium.launch({ headless: true, executablePath: process.env.QA_BROWSER || undefined });
	const errors = [];
	try {
		for (const [width, narrow, lang] of [[1440, false, "en"], [1440, true, "zh"], [390, false, "zh"], [320, false, "en"]]) {
			const name = narrow ? "narrow" : String(width);
			const page = await browser.newPage({ viewport: { width, height: 1000 } });
			page.on("pageerror", error => errors.push(error.message));
			await page.goto(`http://127.0.0.1:4173/?theme=dark&lang=${lang}`);
			await page.locator(".qt-layout-select").waitFor();
			if (narrow) await page.locator(".qt-root").evaluate(el => { el.style.width = "560px"; });
			const columns = () => page.locator(".qt-matrix").evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").length);
			assert.equal(await columns(), width <= 720 || narrow ? 1 : 2);
			const source = await page.evaluate(() => window.matrixPreview.getMarkdown());
			const quick = page.locator(".qt-quick-add").first();
			await quick.locator(".qt-task-textarea").first().fill("Unsaved long task title 草稿");
			await quick.locator(".qt-quick-notes").fill("Unsaved notes");
			await quick.locator(".qt-native-date").fill("2026-10-02");
			await quick.locator(".qt-due-time").fill("14:30");
			await quick.locator(".qt-tag-input").fill("Unconfirmed tag");
			for (const mode of ["grid", "vertical", "auto", "grid"]) {
				await page.locator(".qt-layout-select").selectOption(mode);
				assert.equal(await columns(), mode === "grid" ? 2 : mode === "vertical" || width <= 720 || narrow ? 1 : 2);
				assert.equal(await quick.locator(".qt-task-textarea").first().inputValue(), "Unsaved long task title 草稿");
				assert.equal(await quick.locator(".qt-quick-notes").inputValue(), "Unsaved notes");
				assert.equal(await quick.locator(".qt-native-date").inputValue(), "2026-10-02");
				assert.equal(await quick.locator(".qt-due-time").inputValue(), "14:30");
				assert.equal(await quick.locator(".qt-tag-input").inputValue(), "Unconfirmed tag");
				assert.equal(await page.evaluate(() => window.matrixPreview.getMarkdown()), source);
				assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: page must not scroll sideways`);
			}
			const overflow = await page.locator(".qt-task-title").evaluateAll(elements => elements.flatMap(el => {
				const bounds = el.getBoundingClientRect();
				return [...el.querySelectorAll(".qt-due-unit, .qt-due-clock, .qt-due-relative, .qt-tag")].filter(child => child.getBoundingClientRect().right > bounds.right + 1).map(child => child.textContent);
			}));
			assert.deepEqual(overflow, [], `${name}: grid metadata must fit`);
			const viewport = page.locator(".qt-matrix-viewport");
			if (width <= 720 || narrow) {
				assert.ok(await viewport.evaluate(el => el.scrollWidth > el.clientWidth));
				await viewport.focus();
				await viewport.press("ArrowRight");
				await page.waitForFunction(() => document.querySelector(".qt-matrix-viewport").scrollLeft > 0);
				await page.locator(".qt-layout-select").focus();
				// Let the browser's keyboard-scroll animation finish before restoring the capture origin.
				await page.waitForTimeout(250);
				await viewport.evaluate(el => { el.scrollLeft = 0; });
				assert.equal(await page.locator(".qt-task-row .qt-task-more").first().isVisible(), false);
			}
			await page.locator(".qt-root").screenshot({ path: path.join(output, `2.8.1-grid-${name}.png`) });
			if (width <= 720 || narrow) {
				for (const [side, quadrant] of [["right", "schedule"], ["left", "do"]]) {
					await page.evaluate(side => {
						const renderer = window.matrixPreview.renderer;
						const row = document.querySelector('[data-task-id="task-1"]');
						row.scrollIntoView({ block: "center", inline: "nearest" });
						const viewport = document.querySelector(".qt-matrix-viewport").getBoundingClientRect();
						const bounds = row.getBoundingClientRect();
						row.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: new DataTransfer() }));
						renderer.updateDragPoint(side === "right" ? viewport.right - 4 : viewport.left + 4, bounds.top + 16, true);
					}, side);
					await page.waitForFunction(side => {
						const el = document.querySelector(".qt-matrix-viewport");
						return side === "right" ? el.scrollLeft >= el.scrollWidth - el.clientWidth - 2 : el.scrollLeft <= 1;
					}, side);
					await page.evaluate(quadrant => {
						const list = document.querySelector(`[data-quadrant="${quadrant}"] .qt-task-list`);
						const bounds = list.getBoundingClientRect();
						const viewport = document.querySelector(".qt-matrix-viewport").getBoundingClientRect();
						const x = (Math.max(bounds.left, viewport.left) + Math.min(bounds.right, viewport.right)) / 2;
						const y = bounds.top + 15;
						if (!list.contains(document.elementFromPoint(x, y))) throw new Error("Drop target must be visible");
						list.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, clientX: x, clientY: y }));
					}, quadrant);
					await page.waitForFunction(quadrant => window.matrixPreview.getData().tasks.find(task => task.id === "task-1").quadrant === quadrant, quadrant);
				}
			}
			await page.locator(".qt-layout-select").selectOption("vertical");
			assert.equal(await viewport.evaluate(el => el.scrollWidth <= el.clientWidth), true);
			await page.evaluate(() => window.matrixPreview.reload());
			assert.equal(await page.locator(".qt-layout-select").inputValue(), "auto");
			await page.close();
			console.log(`${name}: layout, draft preservation, metadata, contained scroll and keyboard passed`);
		}
		assert.deepEqual(errors, []);
	} finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
