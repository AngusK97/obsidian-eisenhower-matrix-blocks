"use strict";

const DEFAULT_LANGUAGE = "zh";
const DEFAULT_LANGUAGE_MODE = "auto";
const SUPPORTED_LANGUAGES = new Set(["zh", "en"]);
const SUPPORTED_LANGUAGE_MODES = new Set([DEFAULT_LANGUAGE_MODE, ...SUPPORTED_LANGUAGES]);

const TRANSLATIONS = {
	zh: {
		"quadrant.do.action": "立即做",
		"quadrant.do.description": "重要且紧急",
		"quadrant.schedule.action": "安排",
		"quadrant.schedule.description": "重要不紧急",
		"quadrant.delegate.action": "委派",
		"quadrant.delegate.description": "紧急不重要",
		"quadrant.eliminate.action": "舍弃",
		"quadrant.eliminate.description": "不重要不紧急",
		"period.all": "全部",
		"period.today": "今天",
		"period.7d": "近 7 天",
		"period.30d": "近 30 天",
		"period.custom": "自定义",
		"common.cancel": "取消",
		"common.save": "保存",
		"common.undo": "撤销",
		"modal.editTask": "编辑任务",
		"modal.taskContent": "任务内容",
		"modal.editTitle": "编辑四象限标题",
		"modal.matrixTitle": "四象限标题",
		"board.invalid": "四象限代码块内容无效，请先修复源文本。",
		"board.editTitle": "编辑四象限标题",
		"stats.active": "{count} 项进行中",
		"stats.completed": "{count} 项已完成",
		"task.add": "添加任务",
		"task.addTo": "添加到{quadrant}",
		"task.empty": "暂无任务",
		"task.complete": "完成任务：{title}",
		"task.edit": "编辑任务",
		"task.more": "更多操作",
		"task.menuEdit": "编辑",
		"task.moveTo": "移至：{quadrant}",
		"task.delete": "删除",
		"task.completedNotice": "任务已完成",
		"task.restoredNotice": "任务已恢复",
		"task.deletedNotice": "任务已删除",
		"completed.title": "已完成",
		"completed.filterQuadrant": "按来源象限筛选",
		"completed.allQuadrants": "全部象限",
		"completed.timeFilter": "完成时间",
		"completed.invalidRange": "开始日期不能晚于结束日期",
		"completed.none": "还没有已完成的任务",
		"completed.noMatches": "没有符合筛选条件的任务",
		"completed.startDate": "完成时间起始日期",
		"completed.to": "至",
		"completed.endDate": "完成时间结束日期",
		"completed.restore": "恢复任务：{title}",
		"completed.delete": "删除任务",
		"command.insert": "在当前光标处插入四象限",
		"ribbon.insert": "插入四象限",
		"notice.inserted": "已插入独立四象限",
		"notice.openMarkdown": "请先打开一个可编辑的 Markdown 文件",
		"notice.fileMissing": "找不到这张四象限所在的 Markdown 文件",
		"notice.saveFailed": "四象限保存失败，请检查源文本或文件状态。",
		"notice.fileUnavailable": "所在的 Markdown 文件不可用",
		"notice.migrationComplete": "旧的全局任务已迁移为 Markdown 文件中的独立四象限",
		"notice.migrationFailed": "旧任务迁移失败，请检查控制台和备份文件。",
		"settings.language": "界面语言",
		"settings.languageDescription": "选择跟随 Obsidian，或指定四象限控件、菜单和提示信息所使用的语言。",
		"settings.followObsidian": "跟随 Obsidian",
	},
	en: {
		"quadrant.do.action": "Do now",
		"quadrant.do.description": "Important and urgent",
		"quadrant.schedule.action": "Schedule",
		"quadrant.schedule.description": "Important, not urgent",
		"quadrant.delegate.action": "Delegate",
		"quadrant.delegate.description": "Urgent, not important",
		"quadrant.eliminate.action": "Eliminate",
		"quadrant.eliminate.description": "Neither important nor urgent",
		"period.all": "All",
		"period.today": "Today",
		"period.7d": "Last 7 days",
		"period.30d": "Last 30 days",
		"period.custom": "Custom",
		"common.cancel": "Cancel",
		"common.save": "Save",
		"common.undo": "Undo",
		"modal.editTask": "Edit task",
		"modal.taskContent": "Task content",
		"modal.editTitle": "Edit matrix title",
		"modal.matrixTitle": "Matrix title",
		"board.invalid": "This matrix block contains invalid data. Fix the source before continuing.",
		"board.editTitle": "Edit matrix title",
		"stats.active": "{count} active",
		"stats.completed": "{count} completed",
		"task.add": "Add task",
		"task.addTo": "Add to {quadrant}",
		"task.empty": "No tasks",
		"task.complete": "Complete task: {title}",
		"task.edit": "Edit task",
		"task.more": "More actions",
		"task.menuEdit": "Edit",
		"task.moveTo": "Move to: {quadrant}",
		"task.delete": "Delete",
		"task.completedNotice": "Task completed",
		"task.restoredNotice": "Task restored",
		"task.deletedNotice": "Task deleted",
		"completed.title": "Completed",
		"completed.filterQuadrant": "Filter by source quadrant",
		"completed.allQuadrants": "All quadrants",
		"completed.timeFilter": "Completion date",
		"completed.invalidRange": "The start date must not be after the end date",
		"completed.none": "No completed tasks yet",
		"completed.noMatches": "No tasks match these filters",
		"completed.startDate": "Completion start date",
		"completed.to": "to",
		"completed.endDate": "Completion end date",
		"completed.restore": "Restore task: {title}",
		"completed.delete": "Delete task",
		"command.insert": "Insert matrix at cursor",
		"ribbon.insert": "Insert matrix",
		"notice.inserted": "Independent matrix inserted",
		"notice.openMarkdown": "Open an editable Markdown file first",
		"notice.fileMissing": "The Markdown file containing this matrix was not found",
		"notice.saveFailed": "The matrix could not be saved. Check the source or file state.",
		"notice.fileUnavailable": "The Markdown file containing this matrix is unavailable",
		"notice.migrationComplete": "The global task board was migrated to an independent Markdown matrix",
		"notice.migrationFailed": "Legacy task migration failed. Check the console and backup files.",
		"settings.language": "Interface language",
		"settings.languageDescription": "Follow Obsidian or choose the language used by matrix controls, menus, and messages.",
		"settings.followObsidian": "Follow Obsidian",
	},
};

function normalizeLanguage(value) {
	const baseLanguage = String(value || "").toLowerCase().split("-")[0];
	return SUPPORTED_LANGUAGES.has(baseLanguage) ? baseLanguage : DEFAULT_LANGUAGE;
}

function normalizeLanguageMode(value) {
	return SUPPORTED_LANGUAGE_MODES.has(value) ? value : DEFAULT_LANGUAGE_MODE;
}

function resolveLanguage(mode, appLanguage) {
	const normalizedMode = normalizeLanguageMode(mode);
	if (normalizedMode !== DEFAULT_LANGUAGE_MODE) return normalizedMode;
	const appBaseLanguage = String(appLanguage || "en").toLowerCase().split("-")[0];
	return appBaseLanguage === "zh" ? "zh" : "en";
}

function translate(language, key, variables = {}) {
	const normalized = normalizeLanguage(language);
	const template = TRANSLATIONS[normalized][key] ?? TRANSLATIONS[DEFAULT_LANGUAGE][key] ?? key;
	return template.replace(/\{([A-Za-z0-9_]+)\}/g, (match, name) =>
		Object.prototype.hasOwnProperty.call(variables, name) ? String(variables[name]) : match,
	);
}

module.exports = {
	DEFAULT_LANGUAGE,
	DEFAULT_LANGUAGE_MODE,
	normalizeLanguage,
	normalizeLanguageMode,
	resolveLanguage,
	translate,
};
