"use strict";

// Documentation only. Start scripts/ui-preview.cjs first; no personal Vault is read.
const assert = require("node:assert/strict");
const { readFile, mkdir } = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { findBoardCodeBlocks } = require("../src/board-store");

(async () => {
	const root = path.resolve(__dirname, "..");
	const [board] = findBoardCodeBlocks(await readFile(path.join(root, "docs/demo/Matrix Demo.md"), "utf8"));
	assert.ok(board && board.issues.length === 0, "Public demo must parse without errors");
	const output = path.join(root, "docs/assets");
	await mkdir(output, { recursive: true });
	const browser = await chromium.launch({ executablePath: process.env.QA_BROWSER || undefined, headless: true });
	try {
		for (const theme of ["light", "dark"]) {
			const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
			const errors = [];
			page.on("pageerror", error => errors.push(error.message));
			await page.goto(`http://127.0.0.1:4173/?theme=${theme}&lang=en`);
			await page.locator(".qt-root").waitFor();
			await page.evaluate(demo => {
				const renderer = window.matrixPreview.renderer;
				renderer.setBoardData(demo.data, demo.title, demo.quadrantLabels);
			}, board);
			await page.locator(".qt-root").screenshot({ path: path.join(output, `renderer-overview-${theme}.png`) });
			await page.locator(".qt-quadrant").first().screenshot({ path: path.join(output, `renderer-task-details-${theme}.png`) });
			await page.locator(".qt-periods").getByRole("button", { name: "All", exact: true }).click();
			assert.equal(await page.locator(".qt-completed-row").count(), 2);
			assert.equal(await page.locator(".qt-completed-label").first().textContent(), "Completed on");
			assert.equal(await page.locator(".qt-completed-row .qt-due-label").first().textContent(), "Due");
			await page.locator(".qt-completed-section").screenshot({ path: path.join(output, `renderer-completed-${theme}.png`) });
			assert.deepEqual(errors, []);
			await page.close();
		}
	} finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
