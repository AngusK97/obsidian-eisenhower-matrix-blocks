"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
	DEFAULT_LANGUAGE,
	DEFAULT_LANGUAGE_MODE,
	normalizeLanguage,
	normalizeLanguageMode,
	resolveLanguage,
	translate,
} = require("../src/i18n");

test("language normalization defaults to Chinese", () => {
	assert.equal(DEFAULT_LANGUAGE, "zh");
	assert.equal(normalizeLanguage("zh"), "zh");
	assert.equal(normalizeLanguage("en"), "en");
	assert.equal(normalizeLanguage("fr"), "zh");
});

test("automatic language mode follows Obsidian while explicit choices win", () => {
	assert.equal(DEFAULT_LANGUAGE_MODE, "auto");
	assert.equal(normalizeLanguageMode(undefined), "auto");
	assert.equal(normalizeLanguageMode("fr"), "auto");
	assert.equal(resolveLanguage("auto", "en"), "en");
	assert.equal(resolveLanguage("auto", "zh-CN"), "zh");
	assert.equal(resolveLanguage("zh", "en"), "zh");
	assert.equal(resolveLanguage("en", "zh-CN"), "en");
});

test("translations cover Chinese and English with variables", () => {
	assert.equal(translate("zh", "quadrant.do.description"), "重要且紧急");
	assert.equal(translate("en", "quadrant.do.description"), "Important and urgent");
	assert.equal(translate("zh", "stats.active", { count: 3 }), "3 项进行中");
	assert.equal(translate("en", "stats.active", { count: 3 }), "3 active");
});
