"use strict";

// Optional local browser QA; Playwright/browser are supplied by the caller, not runtime dependencies.
const assert = require("node:assert/strict");
const { mkdir } = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

function contrast(first, second) {
	const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => {
		const channel = value / 255;
		return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
	}).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
	const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
	return (values[0] + 0.05) / (values[1] + 0.05);
}

async function assertLayout(page, name) {
	assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: document overflow`);
	for (const card of await page.locator(".qt-task-row, .qt-completed-row").evaluateAll(elements => elements.map(element => {
		const style = getComputedStyle(element);
		const next = element.nextElementSibling;
		return { padding: style.paddingTop, radius: style.borderRadius, border: style.borderBottomWidth,
			background: style.backgroundColor, gap: next ? next.getBoundingClientRect().top - element.getBoundingClientRect().bottom : null };
	}))) {
		assert.equal(card.padding, "10px", `${name}: theme cannot collapse card padding`);
		assert.equal(card.radius, "6px");
		assert.equal(card.border, "0px");
		assert.notEqual(card.background, "rgba(0, 0, 0, 0)");
		if (card.gap !== null) assert.ok(card.gap >= 9 && card.gap <= 11, `${name}: cards need a distinct 10px gap`);
	}
	for (const boundary of await page.locator(".qt-quadrant").evaluateAll(sections => sections.map(section => {
		const form = section.querySelector(".qt-quick-add"), divider = section.querySelector(".qt-task-divider"), list = section.querySelector(".qt-task-list");
		if (!divider) return null;
		const bounds = divider.getBoundingClientRect();
		const top = bounds.top;
		const below = list.getBoundingClientRect().top - bounds.bottom;
		const above = bounds.top - form.getBoundingClientRect().bottom + parseFloat(getComputedStyle(form).paddingBottom);
		const savedScroll = list.scrollTop;
		list.scrollTop = 60;
		const stationary = divider.getBoundingClientRect().top === top;
		list.scrollTop = savedScroll;
		return { below, above, stationary, outside: divider.nextElementSibling === list, line: getComputedStyle(divider).borderTopWidth };
	}))) {
		assert.ok(boundary, `${name}: quick-add needs a separate list boundary`);
		assert.equal(boundary.line, "1px");
		assert.ok(Math.abs(boundary.above - 12) <= 1 && Math.abs(boundary.below - 12) <= 1, `${name}: boundary needs 12px above and below`);
		assert.ok(boundary.stationary && boundary.outside, `${name}: boundary stays outside the scrolling list`);
	}
	for (const row of await page.locator(".qt-task-row, .qt-completed-row").evaluateAll(elements => elements.map(element => {
		const box = element.querySelector(".qt-task-checkbox").getBoundingClientRect();
		const title = element.querySelector(".qt-task-name, .qt-completed-title");
		const text = title.getBoundingClientRect();
		const firstLine = parseFloat(getComputedStyle(title).lineHeight);
		const handle = element.querySelector(".qt-drag-handle")?.getBoundingClientRect();
		return { gap: text.left - box.right, offset: Math.abs(box.top + box.height / 2 - text.top - firstLine / 2), trailing: !handle || handle.left >= text.right - 1 };
	}))) {
		assert.ok(row.gap >= 6 && row.gap <= 12, `${name}: checkbox sits next to title`);
		assert.ok(row.offset <= 4, `${name}: checkbox aligns with title first line`);
		assert.ok(row.trailing, `${name}: drag handle does not indent task content`);
	}
	for (const item of await page.locator(".qt-task-row button.qt-task-title").evaluateAll(elements => elements.map(element => {
		const style = getComputedStyle(element);
		return { background: style.backgroundColor, border: style.borderTopWidth, align: style.textAlign };
	}))) {
		assert.equal(item.background, "rgba(0, 0, 0, 0)", `${name}: theme button background`);
		assert.equal(item.border, "0px", `${name}: theme button border`);
		assert.equal(item.align, "left", `${name}: theme button alignment`);
	}
	const overflow = await page.locator(".qt-task-title, .qt-completed-edit").evaluateAll(elements => elements.flatMap(element => {
		const bounds = element.getBoundingClientRect();
		return Array.from(element.querySelectorAll(".qt-due-unit, .qt-due-clock, .qt-due-relative, .qt-tag")).filter(child => {
			const rect = child.getBoundingClientRect();
			return rect.right > bounds.right + 1 || rect.left < bounds.left - 1;
		}).map(child => child.textContent);
	}));
	assert.deepEqual(overflow, [], `${name}: metadata cannot overflow task body`);
	assert.ok(await page.locator(".qt-due-unit, .qt-due-clock, .qt-due-relative").evaluateAll(elements => elements.every(element => getComputedStyle(element).whiteSpace === "nowrap")));
	const colors = await page.locator(".qt-task-tags .qt-tag").evaluateAll(elements => elements.map(element => ({
		tag: element.textContent, foreground: getComputedStyle(element).color, background: getComputedStyle(element).backgroundColor,
	})));
	const prior = new Map();
	for (const color of colors) {
		assert.ok(contrast(color.foreground, color.background) >= 4.5, `${name}: ${color.tag} contrast`);
		if (prior.has(color.tag)) assert.deepEqual(color, prior.get(color.tag), `${name}: deterministic color`);
		prior.set(color.tag, color);
	}
}

(async () => {
	const output = process.env.QA_OUTPUT || path.join(require("node:os").tmpdir(), "matrix-qa");
	await mkdir(output, { recursive: true });
	const browser = await chromium.launch({ headless: true, executablePath: process.env.QA_BROWSER || undefined });
	const errors = [];
	try {
		for (const [name, width, height, theme, lang, narrow] of [
			["desktop", 1440, 1000, "light", "en", false], ["mobile", 390, 844, "dark", "zh", false],
			["compact", 320, 740, "light", "zh", false], ["narrow-desktop", 1440, 1000, "dark", "zh", true],
			["tablet", 768, 1024, "light", "en", false], ["small-desktop", 1024, 900, "dark", "zh", false],
		]) {
			const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 500, hasTouch: width < 500 });
			page.on("pageerror", error => errors.push(error.message));
			await page.goto(`http://127.0.0.1:4173/?theme=${theme}&lang=${lang}`);
			await page.locator(".qt-task-row").first().waitFor();
			// Reproduce Minimal's list rule and ordinary Markdown list indentation,
			// loaded AFTER plugin CSS so specificity, not load order, protects cards.
			await page.addStyleTag({ content: `button { background: #49483f; border: 2px solid #80775e; text-align: center; justify-content: center; color: #fff2bf; } .markdown-preview-view ul>li { padding-top: .075em; padding-bottom: .075em; } .markdown-preview-view ul { margin-block: 1em; padding-inline-start: 40px; } ${narrow ? ".markdown-preview-sizer { max-width: 560px; padding: 16px; }" : ""}` });
			assert.equal(await page.locator(".qt-completed-row").count(), 12);
			assert.ok(await page.locator(".qt-completed-list").evaluate(el => el.scrollHeight > el.clientHeight));
			await assertLayout(page, name);
			assert.ok(await page.locator(".qt-icon-button svg").evaluateAll(icons => icons.every(icon => {
				const rect = icon.getBoundingClientRect();
				return rect.width === 0 || (rect.width === 16 && rect.height === 16);
			})), "action icons use a consistent 16px size");
			assert.ok(await page.locator('[data-task-id="task-3"] .qt-task-due').evaluate(el => el.classList.contains("qt-due-red")));
			assert.ok(await page.locator('[data-task-id="task-5"] .qt-task-due').evaluate(el => el.classList.contains("qt-due-yellow")));
			assert.ok(await page.locator('[data-task-id="task-6"] .qt-task-due').evaluate(el => el.classList.contains("qt-due-green")));
			for (const tone of ["yellow", "green"]) {
				const colors = await page.locator(`.qt-due-${tone}`).first().evaluate(el => ({ foreground: getComputedStyle(el).color, background: getComputedStyle(el.closest(".qt-task-row")).backgroundColor }));
				// Resolve color-mix() through a canvas to RGB before contrast calculation.
				const background = await page.evaluate(color => { const ctx = document.createElement("canvas").getContext("2d"); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); return `rgb(${Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3).join(",")})`; }, colors.background);
				assert.ok(contrast(colors.foreground, background) >= 4.5, `${tone} deadline must remain readable on ${theme} cards`);
			}
			assert.equal(await page.locator(".qt-completed-row .is-urgent").count(), 0);
			assert.equal(await page.locator(".qt-completed-row .qt-due-muted").count(), 1);
			assert.equal(await page.locator(".qt-completed-row .qt-due-relative").count(), 0);
			const finished = page.locator(".qt-completed-row").filter({ has: page.locator(".qt-task-due") });
			const originalDeadline = await finished.locator(".qt-due-date").textContent();
			assert.equal(await finished.locator(".qt-due-clock").textContent(), "16:00");
			assert.ok(await finished.locator(".qt-task-checkbox").isChecked());
			// Toggling moves/replaces the row; assert its destination rather than
			// asking check()/uncheck() to re-read a checkbox that no longer exists.
			await finished.locator(".qt-task-checkbox").click();
			const restored = page.locator('[data-task-id="done-0"]');
			await restored.waitFor();
			assert.match(await restored.locator(".qt-due-relative").textContent(), /overdue|已逾期/);
			assert.equal(await restored.locator(".qt-due-red.is-urgent").count(), 1);
			assert.equal(await restored.locator(".qt-task-checkbox").isChecked(), false);
			await restored.locator(".qt-task-checkbox").click();
			await finished.waitFor();
			await page.evaluate(() => window.matrixPreview.reload());
			assert.equal(await page.locator(".qt-completed-row .qt-due-relative").count(), 0);
			assert.equal(await finished.locator(".qt-due-date").textContent(), originalDeadline);
			assert.equal(await finished.locator(".qt-due-clock").textContent(), "16:00");
			assert.equal(await finished.locator(".qt-completed-meta time").count(), 1);
			assert.equal(await finished.locator(".qt-completed-label").textContent(), lang === "zh" ? "完成于" : "Completed on");
			assert.equal(await finished.locator(".qt-due-label").textContent(), lang === "zh" ? "截止" : "Due");
			assert.equal(await finished.locator(".qt-completed-icon").getAttribute("aria-hidden"), "true");
			assert.equal(await finished.locator(".qt-completed-icon svg").count(), 1);
			assert.ok(await finished.locator(".qt-completed-stamp").evaluate(el => el.scrollWidth <= el.clientWidth + 1), "completion label and time fit the card");
			await finished.scrollIntoViewIfNeeded();
			await finished.screenshot({ path: path.join(output, `2.8.1-${name}-completed.png`) });
			assert.match(await page.locator('[data-task-id="task-1"] .qt-due-weekday').textContent(), /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/);
			await page.screenshot({ path: path.join(output, `2.8.1-${name}.png`), fullPage: true });
			if (narrow) {
				const tagged = page.locator('[data-task-id="task-7"]');
				const tag = await tagged.locator(".qt-task-tags").boundingBox();
				const due = await tagged.locator(".qt-task-due").boundingBox();
				assert.ok(Math.abs(tag.y - due.y) <= 4, "short tags and deadline share a compact line");
				const expanded = await page.addStyleTag({ content: ".qt-root .qt-task-list { max-height: none; }" });
				await page.locator(".qt-quadrant").first().screenshot({ path: path.join(output, "2.8.1-quadrant-boundary.png") });
				await expanded.evaluate(el => el.remove());
			}
			await page.locator(".qt-task-title").first().focus();
			assert.notEqual(await page.locator(".qt-task-row").first().evaluate(el => getComputedStyle(el).boxShadow), "none", "card keeps keyboard focus feedback");
			await page.locator(".qt-task-title").first().evaluate(el => el.blur());
			await page.locator(".qt-task-row").first().evaluate(el => el.classList.add("qt-drop-before"));
			assert.notEqual(await page.locator(".qt-task-row").first().evaluate(el => getComputedStyle(el).boxShadow), "none", "card keeps drag insertion feedback");
			await page.locator(".qt-task-row").first().evaluate(el => el.classList.remove("qt-drop-before"));
			const quick = page.locator(".qt-quick-add").first();
			assert.notEqual(await quick.locator(".qt-add-button").evaluate(el => getComputedStyle(el).backgroundColor), "rgba(0, 0, 0, 0)");
			assert.equal(await quick.locator(".qt-due-time").isDisabled(), true);
			assert.equal(await quick.locator(".qt-clear-time").isVisible(), false, "empty times have no clear button");
			assert.ok(await quick.locator(".qt-time-control").evaluate(el => el.getBoundingClientRect().width <= el.querySelector("input").getBoundingClientRect().width + 1), "hidden clear has no reserved slot");
			await quick.locator(".qt-task-textarea").first().fill("New task with optional details");
			await quick.locator(".qt-quick-notes").fill("First line\nSecond line " + "long notes ".repeat(30));
			assert.equal(await quick.locator(".qt-date-control input").count(), 1);
			assert.equal(await quick.locator(".qt-date-control button").count(), 0);
			assert.equal(await quick.locator(".qt-native-date").getAttribute("type"), "date");
			assert.ok(await quick.locator(".qt-native-date").getAttribute("aria-label"));
			assert.equal(await quick.locator(".qt-add-button").getAttribute("title"), await quick.locator(".qt-add-button").getAttribute("aria-label"));
			assert.equal(await page.locator(".qt-date-popover").count(), 0);
			const today = await page.evaluate(() => {
				const date = new Date();
				return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
			});
			await quick.locator(".qt-native-date").fill(today);
			await quick.locator(".qt-native-date").dispatchEvent("change");
			await quick.locator(".qt-due-time").focus();
			await quick.locator(".qt-due-time").press("ArrowUp");
			assert.ok(await quick.locator(".qt-due-time").evaluate(el => el.value === "" && el.validity.badInput), "real native partial time");
			assert.equal(await quick.locator(".qt-clear-time").isVisible(), true, "partial native time can be cleared without an input event");
			await quick.locator(".qt-clear-time").click();
			assert.ok(await quick.locator(".qt-due-time").evaluate(el => !el.value && !el.validity.badInput));
			assert.equal(await quick.locator(".qt-clear-time").isVisible(), false);
			await quick.locator(".qt-due-time").fill("23:59");
			assert.equal(await quick.locator(".qt-clear-time").isVisible(), true, "live input reveals clear before blur");
			const clearSize = await quick.locator(".qt-clear-time").boundingBox();
			if (width < 500) assert.ok(clearSize.width >= 44 && clearSize.height >= 44, "mobile clear-time target remains 44px");
			assert.ok(await quick.locator(".qt-time-control").evaluate(el => {
				const box = el.getBoundingClientRect(), input = el.querySelector("input").getBoundingClientRect(), button = el.querySelector("button").getBoundingClientRect();
				return button.right <= box.right + 1 && button.left >= input.right - 1 && button.top >= box.top - 1 && button.bottom <= box.bottom + 1 && getComputedStyle(el).boxShadow !== "none" && getComputedStyle(el.querySelector("input")).borderTopWidth === "0px";
			}), "clear and native time input share one surface without overlap");
			await quick.locator(".qt-clear-time").click();
			assert.equal(await quick.locator(".qt-clear-time").isVisible(), false);
			assert.equal(await quick.locator(".qt-native-date").inputValue(), today);
			assert.ok(await quick.locator(".qt-due-time").evaluate(el => el === document.activeElement));
			await quick.locator(".qt-due-time").fill("23:59");
			await quick.locator(".qt-due-time").dispatchEvent("change");
			await quick.locator(".qt-tag-input").fill("工作,设计，待验收");
			await quick.locator(".qt-tag-input").press("Enter");
			await quick.locator(".qt-tag-remove").first().click();
			await quick.locator(".qt-tag-input").fill("尚未按回车的标签");
			await quick.locator(".qt-add-button").click();
			const added = page.locator(".qt-task-title").filter({ hasText: "New task with optional details" });
			await added.waitFor();
			assert.ok(await added.locator(".qt-task-due").evaluate(el => el.classList.contains("is-urgent")));
			assert.equal(await added.locator(".qt-due-clock").textContent(), "23:59");
			assert.deepEqual(await added.locator(".qt-tag-label").allTextContents(), ["#设计", "#待验收", "#尚未按回车的标签"]);
			assert.ok(await added.locator(".qt-task-notes").evaluate(el => el.scrollWidth > el.clientWidth && getComputedStyle(el).textOverflow === "ellipsis"));
			assert.equal(await quick.locator(".qt-tag-input").inputValue(), "");
			await added.click();
			const editor = page.locator(".qt-task-editor");
			assert.equal(await editor.locator(".qt-task-name-input").inputValue(), "New task with optional details");
			assert.equal(await editor.locator(".qt-due-time").inputValue(), "23:59");
			assert.match(await editor.locator(".qt-task-notes-input").inputValue(), /Second line/);
			await editor.locator(".qt-task-name-input").fill("Edited task");
			await editor.locator(".qt-task-notes-input").fill("Editable\nmultiline notes");
			await editor.locator(".qt-due-time").fill("00:00");
			await editor.locator(".qt-due-time").dispatchEvent("change");
			await editor.locator(".qt-tag-input").fill(Array.from({ length: 14 }, (_, index) => `标签${index}`).join(","));
			await page.screenshot({ path: path.join(output, `2.8.1-${name}-editor.png`) });
			await editor.locator(".qt-task-notes-input").press("Control+Enter");
			await editor.waitFor({ state: "detached" });
			await page.evaluate(() => window.matrixPreview.reload());
			const reloaded = page.locator(".qt-task-title").filter({ hasText: "Edited task" });
			await reloaded.waitFor();
			assert.match(await reloaded.textContent(), /Editable multiline notes/);
			assert.equal(await reloaded.locator(".qt-due-clock").textContent(), "00:00");
			assert.equal(await reloaded.locator(".qt-tag").count(), 17, "no artificial tag-count cap");
			await assertLayout(page, `${name} many tags`);
			await reloaded.click();
			await page.evaluate(() => window.matrixPreview.failNextSave());
			await editor.locator(".qt-task-name-input").fill("Retry title");
			await editor.locator(".qt-task-name-input").press("Enter");
			await editor.locator(".qt-task-save-error").filter({ hasText: /.+/ }).waitFor();
			assert.equal(await editor.locator(".qt-task-name-input").inputValue(), "Retry title");
			assert.equal(await editor.locator(".qt-due-time").inputValue(), "00:00");
			await editor.locator(".qt-clear-time").click();
			assert.equal(await editor.locator(".qt-due-time").inputValue(), "");
			assert.equal(await editor.locator(".qt-clear-time").isVisible(), false);
			assert.equal(await editor.locator(".qt-native-date").inputValue(), today);
			assert.ok(await editor.locator(".qt-due-time").evaluate(el => el === document.activeElement));
			await editor.locator(".qt-task-name-input").press("Enter");
			await editor.waitFor({ state: "detached" });
			assert.equal(await page.locator(".qt-task-title").filter({ hasText: "Retry title" }).locator(".qt-due-clock").count(), 0);
			await quick.locator(".qt-task-textarea").first().fill("Name only is valid");
			await quick.locator(".qt-add-button").click();
			await page.locator(".qt-task-title").filter({ hasText: "Name only is valid" }).waitFor();
			const targetList = page.locator(".qt-task-list").first();
			await targetList.evaluate(el => { el.scrollTop = 0; el.scrollIntoView({ block: "center" }); });
			await page.evaluate(() => {
				const list = document.querySelector(".qt-task-list");
				const rows = list.querySelectorAll(".qt-task-row");
				const first = rows[0].getBoundingClientRect(), second = rows[1].getBoundingClientRect();
				const x = first.left + first.width / 2, y = (first.bottom + second.top) / 2;
				if (document.elementFromPoint(x, y) !== list) throw new Error("Drop must hit the actual visible gap");
				const transfer = new DataTransfer();
				document.querySelector('[data-task-id="task-6"]').dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: transfer }));
				list.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: transfer }));
			});
			await page.waitForFunction(() => document.querySelectorAll(".qt-task-list")[0].querySelectorAll(".qt-task-row")[1]?.dataset.taskId === "task-6");
			console.log(`${name}: labeled timestamps, icons, native date field, theme resilience, responsive metadata, tags, completion/restore, reload and retry passed`);
			await page.close();
		}
		assert.deepEqual(errors, []);
	} finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
