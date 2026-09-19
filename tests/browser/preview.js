"use strict";

const { MatrixBoardRenderChild, EisenhowerMatrixBlocksPlugin } = require("../../src/main");
const { normalizeData } = require("../../src/core");
const { findBoardCodeBlocks, renderBoardCodeBlock, mutateBoardDocument, renameBoardDocument, updateQuadrantLabelsDocument } = require("../../src/board-store");

const params = new URLSearchParams(location.search);
document.documentElement.lang = params.get("lang") === "en" ? "en" : "zh";
document.documentElement.classList.toggle("theme-dark", params.get("theme") === "dark");
document.body.classList.toggle("is-mobile", matchMedia("(max-width: 600px)").matches);
const today = new Date();
today.setHours(12, 0, 0, 0);
const date = (offset) => {
	const value = new Date(today);
	value.setDate(value.getDate() + offset);
	return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
};
const task = (id, title, quadrant, dueDate = null, notes = "", completedAt = null) => ({ id, title, quadrant, dueDate, notes, completedAt, createdAt: today.toISOString(), order: Number(id.replace(/\D/g, "")) || 0 });
const data = normalizeData({ version: 1, tasks: [
	task("task-1", "完善矩阵插件，准备手机端验收", "do", date(0), "确认编辑、日期选择、备注显示和完成列表都保持一致。"),
	task("task-2", "长标题：对照移动端上的每一项实际操作，确认任务文本能够完整换行并且保持圆角边界清晰", "do", date(-1), "这是一条很长很长的备注，用于检查窄屏截断。\n完整内容应该保留在编辑弹窗中，不应因为界面截断而丢失。"),
	task("task-3", "为下周的项目演示安排时间", "schedule", date(3), "距离截止日期恰好 3 天，不应标红。"),
	task("task-4", "只填写名称的旧任务", "schedule"),
	task("task-5", "请同事确认交付材料", "delegate", date(2), "发出后等待反馈。"),
	task("task-6", "整理阅读清单", "eliminate", null, "不紧急：有空再做。"),
	...Array.from({ length: 12 }, (_, index) => task(`done-${index}`, `今天完成的任务 ${index + 1}`, "do", index === 0 ? date(-1) : null, index === 0 ? "已完成，即使逾期也不显示紧急闹钟。" : "", today.toISOString())),
	task("old-1", "昨天完成的任务：切到全部才出现", "schedule", null, "用于验证默认今天筛选。", new Date(today.getTime() - 86400000).toISOString()),
] });
const boardId = "board-browser-qa";
let markdown = `# Browser QA fixture\n\n${renderBoardCodeBlock(boardId, data, "\n", "我的行动矩阵")}\n\nOutside-board content stays unchanged.\n`;
const plugin = new EisenhowerMatrixBlocksPlugin();
plugin.settings = { language: document.documentElement.lang };
plugin.app = {};
plugin.boardRenderers = new Set();
let renderer;
let failNextSave = false;
const persist = (operation) => {
	if (failNextSave) { failNextSave = false; throw new Error("Intentional preview save failure"); }
	const outcome = operation();
	markdown = outcome.content;
	renderer.setBoardData(outcome.data, outcome.title, outcome.quadrantLabels);
	return outcome;
};
plugin.mutateBoard = async (_path, id, mutator) => persist(() => mutateBoardDocument(markdown, id, mutator));
plugin.renameBoard = async (_path, id, title) => persist(() => renameBoardDocument(markdown, id, title));
plugin.updateQuadrantLabels = async (_path, id, quadrant, labels) => persist(() => updateQuadrantLabelsDocument(markdown, id, quadrant, labels));
plugin.showUndo = (message, undo) => {
	const toast = document.querySelector("#toast");
	toast.replaceChildren(document.createTextNode(message));
	const button = toast.createEl("button", { text: "Undo / 撤销" });
	button.addEventListener("click", async () => { await undo(); toast.replaceChildren(); });
};
const board = findBoardCodeBlocks(markdown)[0];
renderer = new MatrixBoardRenderChild(document.querySelector("#board"), plugin, "Browser fixture.md", board.source);
renderer.onload();
window.matrixPreview = {
	renderer, plugin,
	getMarkdown: () => markdown,
	getData: () => JSON.parse(JSON.stringify(renderer.data)),
	failNextSave: () => { failNextSave = true; },
	reload: () => {
		renderer.onunload();
		renderer = new MatrixBoardRenderChild(document.querySelector("#board"), plugin, "Browser fixture.md", findBoardCodeBlocks(markdown)[0].source);
		renderer.onload();
		window.matrixPreview.renderer = renderer;
	},
};
document.querySelector("#theme").addEventListener("click", () => document.documentElement.classList.toggle("theme-dark"));
