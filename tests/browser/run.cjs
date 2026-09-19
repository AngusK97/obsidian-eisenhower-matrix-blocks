"use strict";

// Optional local browser QA; Playwright/browser are supplied by the caller, not runtime dependencies.
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
		for (const [name, width, height, theme, lang] of [["desktop", 1440, 1000, "light", "en"], ["mobile", 390, 844, "dark", "zh"], ["compact", 320, 740, "light", "zh"]]) {
			const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 500, hasTouch: width < 500 });
			page.on("pageerror", error => errors.push(error.message));
			await page.goto(`http://127.0.0.1:4173/?theme=${theme}&lang=${lang}`);
			await page.locator(".qt-task-row").first().waitFor();
			assert.equal(await page.locator(".qt-completed-row").count(), 12);
			assert.ok(await page.locator(".qt-completed-list").evaluate(el => el.scrollHeight > el.clientHeight));
			assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
			await page.screenshot({ path: path.join(output, `2.6.0-${name}.png`), fullPage: true });
			const quick = page.locator(".qt-quick-add").first();
			assert.notEqual(await quick.locator(".qt-add-button").evaluate(el => getComputedStyle(el).backgroundColor), "rgba(0, 0, 0, 0)");
			if (width === 320) assert.ok((await page.locator(".qt-task-title").first().boundingBox()).width > 100);
			await quick.locator(".qt-task-textarea").first().fill("New task with optional details");
			await quick.locator(".qt-quick-notes").fill("First line\nSecond line " + "long notes ".repeat(30));
			await quick.locator(".qt-due-picker").click();
			const popup = page.locator(".qt-date-popover");
			const bounds = await popup.boundingBox();
			assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
			await page.screenshot({ path: path.join(output, `2.6.0-${name}-date.png`) });
			await popup.locator(".qt-date-today").click();
			await quick.locator(".qt-due-picker").click();
			await popup.locator(".qt-date-input").fill("2026-12-31");
			assert.equal(await popup.count(), 1, "native date editing must remain open until confirmation");
			await popup.locator(".qt-date-apply").click();
			assert.match(await quick.locator(".qt-due-picker").textContent(), /2026-12-31/);
			await quick.locator(".qt-due-picker").click();
			await popup.locator(".qt-date-today").click();
			await quick.locator(".qt-add-button").click();
			const added = page.locator(".qt-task-title").filter({ hasText: "New task with optional details" });
			await added.waitFor();
			assert.ok(await added.locator(".qt-task-due").evaluate(el => el.classList.contains("is-urgent")));
			assert.ok(await added.locator(".qt-task-notes").evaluate(el => el.scrollWidth > el.clientWidth && getComputedStyle(el).textOverflow === "ellipsis"));
			await added.click();
			assert.equal(await page.locator(".qt-task-name-input").inputValue(), "New task with optional details");
			assert.match(await page.locator(".qt-task-notes-input").inputValue(), /Second line/);
			await page.locator(".qt-task-name-input").fill("Edited task");
			await page.locator(".qt-task-notes-input").fill("Editable\nmultiline notes");
			await page.screenshot({ path: path.join(output, `2.6.0-${name}-editor.png`) });
			await page.locator(".qt-task-notes-input").press("Control+Enter");
			await page.locator(".qt-task-editor").waitFor({ state: "detached" });
			await page.evaluate(() => window.matrixPreview.reload());
			const reloaded = page.locator(".qt-task-title").filter({ hasText: "Edited task" });
			await reloaded.waitFor();
			assert.match(await reloaded.textContent(), /Editable multiline notes/);
			await reloaded.click();
			await page.evaluate(() => window.matrixPreview.failNextSave());
			await page.locator(".qt-task-name-input").fill("Retry title");
			await page.locator(".qt-task-name-input").press("Enter");
			await page.locator(".qt-task-save-error").filter({ hasText: /.+/ }).waitFor();
			assert.equal(await page.locator(".qt-task-name-input").inputValue(), "Retry title");
			await page.locator(".qt-task-name-input").press("Enter");
			await page.locator(".qt-task-editor").waitFor({ state: "detached" });
			console.log(`${name}: layout, defaults, date, add/edit, notes truncation, reload, retry passed`);
			await page.close();
		}
		assert.deepEqual(errors, []);
	} finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
